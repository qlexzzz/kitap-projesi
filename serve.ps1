param([int]$Port = 8777)

# Kitap Odası — yerel geliştirme sunucusu
# ES modülleri ve fetch kullanıldığı için bir HTTP sunucusu şart;
# dosyayı çift tıklayıp çalıştırman yeterli.

$root = $PSScriptRoot
$log  = Join-Path $env:TEMP 'kitap-odasi-sunucu.log'

$mime = @{
    '.html'  = 'text/html; charset=utf-8'
    '.js'    = 'text/javascript; charset=utf-8'
    '.mjs'   = 'text/javascript; charset=utf-8'
    '.css'   = 'text/css; charset=utf-8'
    '.json'  = 'application/json; charset=utf-8'
    '.txt'   = 'text/plain; charset=utf-8'
    '.svg'   = 'image/svg+xml'
    '.png'   = 'image/png'
    '.jpg'   = 'image/jpeg'
    '.jpeg'  = 'image/jpeg'
    '.webp'  = 'image/webp'
    '.woff2' = 'font/woff2'
    '.ico'   = 'image/x-icon'
}

function Write-Log($line) {
    $stamp = Get-Date -Format 'HH:mm:ss'
    Add-Content -LiteralPath $log -Value "$stamp  $line"
}

# Eski dinleyici varsa temizle. Kendi sürecimizi hariç tutmak şart:
# eşleşme kendimizi de yakalayıp sunucuyu anında kapatıyor.
$me = $PID
Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" |
    Where-Object { $_.ProcessId -ne $me -and $_.CommandLine -like '*serve.ps1*' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

'' | Out-File -LiteralPath $log -Encoding utf8
Write-Log "basladi: $root"

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
try {
    $listener.Start()
} catch {
    Write-Log "HATA: $($_.Exception.Message)"
    Write-Host "Sunucu baslatilamadi. Port $Port mesgul olabilir.`nAyrinti: $log"
    Read-Host 'Cikmak icin Enter'
    exit 1
}

Write-Host ''
Write-Host '  Kitap Odası calisiyor' -ForegroundColor Green
Write-Host "  http://localhost:$Port/" -ForegroundColor Cyan
Write-Host "  Durdurmak icin bu pencereyi kapat veya Ctrl+C"
Write-Host "  Log: $log"
Write-Host ''

while ($listener.IsListening) {
    try {
        $ctx = $listener.GetContext()
        $path = [System.Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath)
        $path = $path.TrimStart('/')
        if ([string]::IsNullOrWhiteSpace($path)) { $path = 'index.html' }

        $full = Join-Path $root ($path -replace '/', '\')

        # dizin dışına çıkmayı engelle
        if (-not $full.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) {
            $ctx.Response.StatusCode = 403
            $ctx.Response.Close()
            Write-Log "403 $path"
            continue
        }

        if (Test-Path -LiteralPath $full -PathType Leaf) {
            $ext  = [System.IO.Path]::GetExtension($full).ToLower()
            $type = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' }
            $bytes = [System.IO.File]::ReadAllBytes($full)

            $ctx.Response.ContentType = $type
            $ctx.Response.ContentLength64 = $bytes.Length
            # Önbelleksiz: geliştirme sırasında eski ES modülü önbelleğe
            # girip yeni kodu sessizce gölgeliyordu.
            $ctx.Response.Headers.Add('Cache-Control', 'no-store, must-revalidate')
            $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
            Write-Log "200 $path"
        } else {
            $ctx.Response.StatusCode = 404
            $body = [System.Text.Encoding]::UTF8.GetBytes("Bulunamadi: $path")
            $ctx.Response.ContentType = 'text/plain; charset=utf-8'
            $ctx.Response.ContentLength64 = $body.Length
            $ctx.Response.OutputStream.Write($body, 0, $body.Length)
            Write-Log "404 $path"
        }
        $ctx.Response.Close()
    } catch {
        Write-Log "HATA: $_"
    }
}
