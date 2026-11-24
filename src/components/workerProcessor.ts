import { pulledDocument, processorOutput } from './types'
import { parseJesgo } from './utilities'

export type WorkerProgress = {
  completed: number
  total: number
  index: number
  hash: string
  stopped: boolean
}

export type WorkerProcessorCallbacks = {
  onProgress?: (progress: WorkerProgress) => void
  onResult?: (index: number, document: pulledDocument, result: processorOutput) => void
  onError?: (index: number, error: Error) => void
}

type WorkerProcessorMessage =
  | { type: 'progress', progress: WorkerProgress }
  | { type: 'result', index: number, result: processorOutput }
  | { type: 'complete', completed: number, stopped: boolean }
  | { type: 'error', index: number, message: string }
  | { type: 'jsonpath-request', requestId: number, source: unknown, jsonpath: string | string[], mode: 'value' | 'pointer' }

type WorkerProcessorRequest =
  | { type: 'jsonpath-response', requestId: number, result: unknown }

export class WorkerProcessor {
  private worker: Worker
  private blobUrl: string
  private running = false
  private resolveRun: ((results: processorOutput[]) => void) | undefined
  private rejectRun: ((error: Error) => void) | undefined
  private results: processorOutput[] = []
  private callbacks: WorkerProcessorCallbacks
  private documents: pulledDocument[] = []

  constructor (source: string, callbacks: WorkerProcessorCallbacks = {}) {
    if (typeof Worker === 'undefined' || typeof Blob === 'undefined' || typeof URL.createObjectURL !== 'function') {
      throw new Error('このブラウザー環境ではWeb Workerが利用できません.')
    }

    this.callbacks = callbacks
    this.blobUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }))
    this.worker = new Worker(this.blobUrl)
    this.worker.onmessage = event => this.handleMessage(event.data as WorkerProcessorMessage)
    this.worker.onerror = event => {
      const error = new Error(event.message || 'Web Worker実行中にエラーが発生しました.')
      if (this.rejectRun) {
        this.rejectRun(error)
        this.resolveRun = undefined
        this.rejectRun = undefined
      }
    }
  }

  public async run (documents: pulledDocument[], skipUnmatchedRecord = false): Promise<processorOutput[]> {
    if (this.running) {
      throw new Error('WorkerProcessorは現在実行中です.')
    }

    this.running = true
    this.results = []
    let documentsToRun: pulledDocument[]
    try {
      documentsToRun = JSON.parse(JSON.stringify(documents)) as pulledDocument[]
    } catch (error) {
      this.running = false
      throw new Error('Workerへ送信できないドキュメントがあります: ' + ((error as Error).message || String(error)))
    }
    this.documents = documentsToRun

    return await new Promise<processorOutput[]>((resolve, reject) => {
      this.resolveRun = resolve
      this.rejectRun = reject
      try {
        this.worker.postMessage({
          type: 'run',
          documents: documentsToRun,
          skipUnmatchedRecord
        })
      } catch (error) {
        this.running = false
        this.resolveRun = undefined
        this.rejectRun = undefined
        reject(error instanceof Error ? error : new Error(String(error)))
      }
    })
  }

  public stop (): void {
    if (this.running) {
      this.worker.postMessage({ type: 'stop' })
    }
  }

  public terminate (): void {
    this.worker.terminate()
    this.running = false
    if (this.rejectRun) {
      this.rejectRun(new Error('WorkerProcessorを停止しました.'))
      this.resolveRun = undefined
      this.rejectRun = undefined
    }
    URL.revokeObjectURL(this.blobUrl)
  }

  private handleMessage (message: WorkerProcessorMessage): void {
    switch (message.type) {
      case 'jsonpath-request': {
        try {
          const result = parseJesgo(
            message.source as never,
            message.jsonpath,
            message.mode
          )
          this.worker.postMessage({
            type: 'jsonpath-response',
            requestId: message.requestId,
            result
          } as WorkerProcessorRequest)
        } catch (error) {
          this.worker.postMessage({
            type: 'jsonpath-response',
            requestId: message.requestId,
            result: []
          } as WorkerProcessorRequest)
        }
        break
      }
      case 'progress':
        this.callbacks.onProgress?.(message.progress)
        break
      case 'result': {
        this.results.push(message.result)
        this.callbacks.onResult?.(message.index, this.documents[message.index], message.result)
        break
      }
      case 'error': {
        const error = new Error(message.message)
        this.callbacks.onError?.(message.index, error)
        break
      }
      case 'complete':
        this.running = false
        this.resolveRun?.(this.results)
        this.resolveRun = undefined
        this.rejectRun = undefined
        break
    }
  }
}

export function createWorkerProcessorSource (
  transpiledRules: { title: string, code: string[], source: { path: string, subpath?: string }[] }[],
  globalVariables: string[] = []
): string {
  const runtime = `
const workerState = { stopRequested: false };
const documentVariableNames = ['$hash', '$his_id', '$name', '$date_of_birth', '$error'];
const transpiledRules = __TRANSPILED_RULES__;
const globalVariables = __GLOBAL_VARIABLES__;
const jsonpathRequests = new Map();
let jsonpathRequestId = 0;
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

function parseJesgo(jesgoDocument, jsonpath, mode = 'value') {
  const requestId = ++jsonpathRequestId;
  return new Promise(resolve => {
    jsonpathRequests.set(requestId, resolve);
    self.postMessage({
      type: 'jsonpath-request',
      requestId,
      source: jesgoDocument,
      jsonpath,
      mode
    });
  });
}

const storeProxyHandler = {
  has(target, property) { return property in target; },
  get(target, property) {
    if (!(property in target)) throw new TypeError(property === 'undefined' || property === '' ? '変数名の指定がありません.' : '変数"' + property + '"は未定義です.');
    return target[property] || [];
  },
  set(target, property, value) {
    if (!(property in target)) throw new TypeError(property === 'undefined' || property === '' ? '変数名の指定がありません.' : '変数"' + property + '"は未定義です.');
    const descriptor = Object.getOwnPropertyDescriptor(target, property);
    if (!(descriptor && descriptor.writable)) throw new TypeError('変数"' + property + '"は定数です.');
    target[property].splice(0, Infinity, ...value.map(item => {
      if (typeof item === 'string' || typeof item === 'number') return item.toString();
      if (typeof item === 'object') return JSON.stringify(item);
      throw new TypeError(typeof item + 'は変数に代入出来ません.');
    }));
    return true;
  },
  defineProperty(target, property, descriptor) {
    if (property in target) throw new TypeError('変数"' + property + '"は既に定義されています.');
    if (property.charAt(0) !== '@' && property.charAt(0) !== '$') throw new SyntaxError('変数名は$で開始されている必要があります.');
    const arrayedValue = [descriptor && descriptor.value || ''].flat(Infinity);
    Object.defineProperty(target, property, {
      enumerable: descriptor && descriptor.enumerable !== undefined ? descriptor.enumerable : true,
      writable: descriptor && descriptor.writable !== undefined ? descriptor.writable : true,
      configurable: descriptor && descriptor.configurable !== undefined ? descriptor.configurable : true,
      value: arrayedValue
    });
    return true;
  },
  deleteProperty(target, property) {
    if (!(property in target)) throw new TypeError('変数"' + property + '"は未定義です.');
    delete target[property];
    return true;
  }
};

class Processor {
  constructor(globalVariables) {
    this.variableStore = {};
    this.variables = new Proxy(this.variableStore, storeProxyHandler);
    this.errorMessages = [];
    this.csvRow = [];
    this.initVariables();
    const now = new Date();
    Object.defineProperty(this.variables, '$now', {
      value: [now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0')],
      writable: false
    });
    for (const name of globalVariables || []) {
      if (name.charAt(0) === '$') Object.defineProperty(this.variables, name, { writable: true });
    }
  }

  initRegister() {
    for (let index = 0; index < 10; index++) {
      const name = '$' + index;
      if (!(name in this.variables)) Object.defineProperty(this.variables, name, {});
      this.variables[name] = [];
    }
  }

  initVariables(hash = '', hisId = '', name = '', dateOfBirth = '') {
    for (const variableName of Object.keys(this.variables)) {
      if (variableName.charAt(0) === '$') {
        if (documentVariableNames.includes(variableName)) delete this.variables[variableName];
        else try { this.variables[variableName] = []; } catch {}
      }
    }
    try {
      Object.defineProperties(this.variables, {
        $hash: { value: [hash || ''], writable: false },
        $his_id: { value: [hisId || ''], writable: false },
        $name: { value: [name || ''], writable: false },
        $date_of_birth: { value: [dateOfBirth || ''], writable: false },
        $error: { value: [], writable: true }
      });
    } catch {}
  }

  async run(content) {
    if (!content) throw new Error('ドキュメントが指定されていません.');
    this.errorMessages.splice(0);
    this.csvRow.splice(0);
    this.initRegister();
    this.initVariables(content.hash, content.his_id, content.name, content.date_of_birth);

    for (let ruleIndex = 0; ruleIndex < transpiledRules.length; ruleIndex++) {
      if (workerState.stopRequested) return { stopped: true, csv: this.csvRow, errors: this.errorMessages };
      const rule = transpiledRules[ruleIndex];
      this.initRegister();
      for (const name of Object.keys(this.variables).filter(value => value.charAt(0) === '@')) delete this.variables[name];
      for (let sourceIndex = 0; sourceIndex < (rule.source || []).length; sourceIndex++) {
        const sourceName = '@' + (sourceIndex + 1);
        const source = rule.source[sourceIndex];
        const path = source.path || '';
        if (path === '') continue;
        if (['$hash', '$his_id', '$name', '$date_of_birth'].includes(path)) {
          Object.defineProperty(this.variables, sourceName, { value: this.variables[path], writable: false });
        } else {
          Object.defineProperty(this.variables, sourceName, {
            value: await parseJesgo(content.documentList, source.subpath ? [path, source.subpath] : path),
            writable: false
          });
        }
      }
      // Object.entries(this.variableStore).forEach(vars => console.log(vars[0] + ' = ' + JSON.stringify(vars[1])));

      instructionLoop: for (let counter = 0; counter < rule.code.length;) {
        if (workerState.stopRequested) return { stopped: true, csv: this.csvRow, errors: this.errorMessages };
        let instruction;
        try {
          const workerCode = rule.code[counter]
            .replace(/processor\\.commandQuery\\(/g, 'await processor.commandQuery(')
            .replace(/processor\\.commandSort\\(/g, 'await processor.commandSort(');
          const instruction = new AsyncFunction('processor', workerCode);
          const result = await instruction(this);
          if (result.behavior === 'Exit') {
            if (result.success) throw new SyntaxError('不正な返り値を取得しました.');
            return { stopped: false, csv: this.csvRow, errors: this.errorMessages };
          }
          if (result.behavior === 'Abort') break instructionLoop;
          if (!Number.isNaN(Number(result.behavior))) counter += Number(result.behavior);
          else counter++;
        } catch (error) {
          throw new Error("'" + rule.title + "' @" + (counter + 1) + " でエラー\\n" + error.message);
        }
      }
    }
    return { stopped: false, csv: this.csvRow, errors: this.errorMessages };
  }

  commandVariables(value = [], variableName = '', variableType = 'value') {
    if (!variableName) throw new SyntaxError('変数名が未指定です.');
    let newvalue = [];
    if (variableType === 'length' || variableType === 'count') newvalue = [value.length.toString()];
    else if (variableType === 'number') newvalue = value.map(item => Number(item).toString());
    else newvalue = value;
    this.variables[variableName] = newvalue;
    return true;
  }

  commandOperators(valueA = [], valueAtype = 'value', valueB = [], operator) {
    let valueOfA = valueA;
    let valueOfB = valueB;
    if (valueAtype === 'length' || valueAtype === 'count') {
      valueOfA = [valueA.length];
      valueOfB = valueB.map(item => Number(item)).filter(item => !Number.isNaN(item));
    } else if (valueAtype === 'number') {
      valueOfA = valueA.map(item => Number(item)).filter(item => !Number.isNaN(item));
      valueOfB = valueB.map(item => Number(item)).filter(item => !Number.isNaN(item));
    }
    switch (operator) {
      case 'eq': case '=': return valueOfA[0] == valueOfB[0];
      case 'gt': case '>': return valueOfA[0] > valueOfB[0];
      case 'ge': case '>=': return valueOfA[0] >= valueOfB[0];
      case 'lt': case '<': return valueOfA[0] < valueOfB[0];
      case 'le': case '<=': return valueOfA[0] <= valueOfB[0];
      case 'in': return valueOfA.some(item => valueOfB.includes(item));
      case 'incl': return valueOfB.some(item => valueOfA.includes(item));
      case 're': case 'regexp': return valueOfA.some(item => {
        const source = item.toString();
        const expression = valueB[0].toString();
        const match = expression.match(/^\\/((?:[^/\\\\]+|\\\\.)*)\\/([gimy]{0,4})$/);
        return match ? RegExp(match[1], match[2].replace('g', '')).test(source) : RegExp(expression).test(source);
      });
      default: throw new SyntaxError('不正な演算子' + operator + 'です.');
    }
  }

  async commandQuery(values, query = '', variableName = '') {
    if (!query) return this.commandVariables(values, variableName);
    const sourceValues = values.map(item => {
      try { return JSON.parse(item); } catch { return item; }
    });
    const result = await parseJesgo(sourceValues, query);
    return this.commandVariables(result, variableName);
  }

  createTranslationTable(table) {
    const result = [];
    for (const [pattern, newvalue] of table) {
      const unquotedNewValue = newvalue.replace(/^((["'\\\`])(.*)\\2)$/, '$3');
      const patternMatch = pattern.match(/^\\/((?:[^/\\\\]+|\\\\.)*)\\/([gimy]{0,4})$/);
      if (patternMatch) {
        const re = new RegExp(patternMatch[1], patternMatch[2]);
        if (unquotedNewValue.includes('$')) {
          result.push({ match: value => value.search(re) !== -1, func: value => value.replace(re, unquotedNewValue) });
        } else {
          result.push({ match: value => value.search(re) !== -1, func: () => unquotedNewValue });
        }
      } else {
        const unquotedPattern = pattern.replace(/^((["'\\\`])(.*)\\2)$/, '$3');
        result.push({ match: value => value === unquotedPattern, func: () => unquotedNewValue });
      }
    }
    return result;
  }

  commandTranslation(variableName = '', translationTable) {
    const newValues = [];
    for (const sourceValue of this.variables[variableName]) {
      let replacedValue;
      for (const translation of translationTable) {
        if (translation.match(sourceValue)) {
          replacedValue = translation.func(sourceValue);
          break;
        }
      }
      newValues.push(replacedValue === undefined ? sourceValue : replacedValue);
    }
    return this.commandVariables(newValues, variableName);
  }

  async commandSort(variableName = '', indexPath = '', mode = 'asc') {
    if (indexPath.trim() === '') {
      const sorted = this.variables[variableName].sort();
      return this.commandVariables(mode === 'asc' || mode === 'ascend' ? sorted : sorted.reverse(), variableName);
    }
    const parsedItems = [];
    for (const item of [...this.variables[variableName]]) {
      let parsedItem;
      try { parsedItem = JSON.parse(item); } catch { parsedItem = item; }
      const key = await parseJesgo([parsedItem], indexPath);
      parsedItems.push({ item: JSON.stringify(parsedItem), key: JSON.stringify(key) });
    }
    parsedItems.sort((a, b) => a.key === b.key ? 0 : (a.key > b.key ? 1 : -1));
    const sortedItems = parsedItems.map(item => item.item);
    return this.commandVariables(mode === 'asc' || mode === 'ascend' ? sortedItems : sortedItems.reverse(), variableName);
  }

  commandSets(valueA, valueB, operator = 'add', variableName = '') {
    let resultArray;
    if (operator === 'union') resultArray = valueB.reduce((accum, item) => [...accum, ...(accum.includes(item) ? [] : [item])], [...valueA]);
    else if (operator === 'intersect') resultArray = valueA.filter(item => valueB.includes(item));
    else if (operator === 'difference') resultArray = valueA.filter(item => !valueB.includes(item));
    else if (operator === 'xor') resultArray = [...valueA, ...valueB].reduce((accum, item, index, original) => [...accum, ...(original.filter(value => value === item).length > 1 ? [] : [item])], []);
    else resultArray = [...valueA, ...valueB];
    return this.commandVariables(resultArray, variableName);
  }

  commandPeroid(valueA, valueB, operator = 'months', variableName = '') {
    const result = [];
    const datePattern = /(?<year>\\d{4})[-/](?<month>1[0-2]|0?[1-9])[-/](?<date>[12][0-9]|3[01]|0?[1-9])/;
    let baseDate;
    const baseMatch = (valueA[0] || '').toString().match(datePattern);
    if (!baseMatch) {
      for (const targetValue of valueB) result.push('-1');
    } else {
      baseDate = new Date(Number(baseMatch.groups.year), Number(baseMatch.groups.month) - 1, Number(baseMatch.groups.date));
      for (const targetValue of valueB) {
        let difference = -1;
        const targetMatch = (targetValue || '').toString().match(datePattern);
        if (targetMatch) {
          const targetDate = new Date(Number(targetMatch.groups.year), Number(targetMatch.groups.month) - 1, Number(targetMatch.groups.date));
          const roundup = operator.includes(',roundup');
          if (operator === 'age' || operator === 'age,roundup') {
            difference = targetDate.getFullYear() - baseDate.getFullYear();
            if (roundup) difference += 1;
            else difference += targetDate.getMonth() > baseDate.getMonth() || (targetDate.getMonth() === baseDate.getMonth() && targetDate.getDate() >= baseDate.getDate()) ? 0 : -1;
            if (difference < 0) difference = 0;
          } else if (operator.startsWith('years')) {
            difference = targetDate.getFullYear() - baseDate.getFullYear();
            if (roundup) difference += targetDate.getMonth() > baseDate.getMonth() || (targetDate.getMonth() === baseDate.getMonth() && targetDate.getDate() >= baseDate.getDate()) ? 1 : 0;
          } else if (operator.startsWith('months')) {
            difference = (targetDate.getFullYear() - baseDate.getFullYear()) * 12 + targetDate.getMonth() - baseDate.getMonth();
            if (roundup) difference += targetDate.getDate() >= baseDate.getDate() ? 1 : 0;
          } else if (operator.startsWith('weeks')) {
            const millis = (targetDate.getTime() - baseDate.getTime()) / 604800000;
            difference = roundup ? Math.ceil(millis) : Math.floor(millis);
          } else if (operator === 'days') {
            difference = Math.floor((targetDate.getTime() - baseDate.getTime()) / 86400000);
          }
        }
        result.push(difference.toString());
      }
    }
    return this.commandVariables(result, variableName);
  }

  commandStore(values, target = '$error', mode = 'first') {
    const collabelToNum = col => {
      let num = Number(col);
      if (Number.isNaN(num)) {
        num = 0;
        for (let pos = 0; pos < col.length; pos++) num = num * 26 + col.toUpperCase().charCodeAt(pos) - 64;
        return num - 1;
      }
      if (num > 0) return num - 1;
      throw new SyntaxError('列表記 ' + col + ' は不正です.');
    };
    let colIndexes = [];
    if (target.charAt(0) !== '$') {
      const targets = target.split(',').map(item => item.replace(/\\s/g, '').toUpperCase());
      for (const targetItem of targets) {
        const match = targetItem.match(/^([0-9A-Z]+)(:([0-9A-Z]+))?$/);
        if (!match) throw new SyntaxError('列表記 ' + target + ' は不正です.');
        const start = collabelToNum(match[1]);
        if (match[3] !== undefined) {
          const end = collabelToNum(match[3]);
          if (start <= end) for (let index = start; index <= end; index++) colIndexes.push(index);
          else for (let index = start; index >= end; index--) colIndexes.push(index);
        } else colIndexes.push(start);
      }
    }
    const colValues = values.flat(Infinity).map(item => item.toString() !== '[object Object]' ? item.toString() : JSON.stringify(item));
    if (mode === 'whitespace') { colValues.splice(0, 0, colValues.join(' ')); colValues.splice(1); }
    else if (mode === 'colon') { colValues.splice(0, 0, colValues.join(':')); colValues.splice(1); }
    else if (mode === 'comma') { colValues.splice(0, 0, colValues.join(',')); colValues.splice(1); }
    else if (mode === 'semicolon') { colValues.splice(0, 0, colValues.join(';')); colValues.splice(1); }
    else if (mode === 'first' || mode === undefined) colValues.splice(1);
    if (target.charAt(0) === '$') {
      if (target === '$error') this.variables['$error'].push(...colValues);
      else this.variables[target] = [...colValues];
    } else {
      for (let index = 0; index < colIndexes.length; index++) this.csvRow[colIndexes[index]] = colValues[index] || '';
    }
    return true;
  }

  storeErrors() {
    if (this.variables['$error'].length > 0) this.errorMessages.push(...this.variables['$error']);
  }
}

self.onmessage = async event => {
  const message = event.data;
  if (message.type === 'jsonpath-response') {
    const resolve = jsonpathRequests.get(message.requestId);
    if (resolve) {
      jsonpathRequests.delete(message.requestId);
      resolve(message.result);
    }
    return;
  }
  if (message.type === 'stop') {
    workerState.stopRequested = true;
    return;
  }
  if (message.type !== 'run') return;
  workerState.stopRequested = false;
  const documents = Array.isArray(message.documents) ? message.documents : [];
  const processor = new Processor(globalVariables);
  let completed = 0;
  for (let index = 0; index < documents.length; index++) {
    if (workerState.stopRequested) break;
    const document = documents[index];
    if (message.skipUnmatchedRecord && (!document.documentList || document.documentList.length === 0)) {
      completed++;
      self.postMessage({ type: 'progress', progress: { completed, total: documents.length, index, hash: document.hash || '', stopped: false } });
      continue;
    }
    try {
      const runResult = await processor.run(document);
      completed++;
      self.postMessage({ type: 'progress', progress: { completed, total: documents.length, index, hash: document.hash || '', stopped: workerState.stopRequested } });
      self.postMessage({ type: 'result', index, result: { csv: runResult.csv, errors: runResult.errors } });
      if (workerState.stopRequested) break;
    } catch (error) {
      completed++;
      self.postMessage({ type: 'progress', progress: { completed, total: documents.length, index, hash: document.hash || '', stopped: workerState.stopRequested } });
      self.postMessage({ type: 'error', index, message: error.message || String(error) });
    }
  }
  self.postMessage({ type: 'complete', completed, stopped: workerState.stopRequested });
};
`

  return runtime
    .replace('__TRANSPILED_RULES__', JSON.stringify(transpiledRules))
    .replace('__GLOBAL_VARIABLES__', JSON.stringify(globalVariables))
}
