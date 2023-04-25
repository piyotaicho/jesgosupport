# Ctrl+C を押したときのシグナルをキャッチするためのハンドラ関数を登録する
[console]::TreatControlCAsInput = $false
$null = Register-ObjectEvent -InputObject $Host -EventName 'Exiting' -Action { Unregister-Event $eventsubscriber.SourceIdentifier; Exit } -MessageData $null
$null = Register-ObjectEvent -InputObject $Host -EventName 'KeyPress' -Action {
    if (($eventargs.KeyChar -eq [char]3)) {
        HandleSigint
    }
} -MessageData $null

$global:interrupted = $false
function HandleSigint {
    $global:interrupted = $true
}

# HTTPサーバーを起動
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:10080/")
$listener.Start()

while ($listener.IsListening) {
  if ($global:interrupted) {
    Write-Host "User break. Terminate server."
    break
  } 
  $context = $listener.GetContext()
  $response = $context.Response
  $response.ContentType = "text/html"
  $file = Get-ChildItem -Path $context.Request.Url.LocalPath
  if ($file) {
    $content = Get-Content $file.FullName
    $buffer = [System.Text.Encoding]::UTF8.GetBytes($content)
    $response.OutputStream.Write($buffer, 0, $buffer.Length)
  } else {
    $response.StatusCode = 404
  }
  $response.Close()
}

$listener.Stop()

# ハンドラの解放
Unregister-Event $Host | Out-Null


