import { createApp } from 'vue'
import { store, key } from './components/store'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import QueryBuilder from './QueryBuilder.vue'

const app = createApp(QueryBuilder)
app.use(store, key)
app.use(ElementPlus)
app.mount('#app')
