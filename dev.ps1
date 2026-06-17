<#
.SYNOPSIS
  Clears the Turbopack dev cache, then starts the backend (server) and
  frontend (client) dev servers together.

.DESCRIPTION
  Automates the "nuclear option" from docs/troubleshooting-turbopack-404.md:
    1. Stops any stray `next dev` / nodemon node processes.
    2. Deletes client\.next so the app-paths-manifest is rebuilt from scratch.
    3. Launches `npm run dev` for the server and the client.

  By default each dev server opens in its own window so logs stream live and
  Ctrl+C in either window stops only that process. Pass -SameWindow to run both
  inside this terminal as background jobs with combined output instead.

.PARAMETER SkipClean
  Skip stopping processes and deleting client\.next (just start the servers).

.PARAMETER SameWindow
  Run both servers in this terminal (background jobs, combined logs) instead of
  separate windows.

.EXAMPLE
  ./dev.ps1
  ./dev.ps1 -SkipClean
  ./dev.ps1 -SameWindow
#>
[CmdletBinding()]
param(
  [switch]$SkipClean,
  [switch]$SameWindow
)

$ErrorActionPreference = 'Stop'
$root   = $PSScriptRoot
$client = Join-Path $root 'client'
$server = Join-Path $root 'server'

function Write-Step($msg) { Write-Host "==> $msg" -ForegroundColor Cyan }

if (-not $SkipClean) {
  Write-Step 'Stopping stray next dev / nodemon node processes...'
  Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
    Where-Object { $_.CommandLine -match 'next(\\|/)dist.*dev|start-server\.js|nodemon' } |
    ForEach-Object {
      Write-Host "    killing PID $($_.ProcessId)" -ForegroundColor DarkGray
      try { Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop } catch {}
    }

  $next = Join-Path $client '.next'
  if (Test-Path $next) {
    Write-Step "Deleting $next ..."
    Remove-Item -Recurse -Force $next
  } else {
    Write-Step 'No client\.next to delete (already clean).'
  }
}

if ($SameWindow) {
  Write-Step 'Starting server + client as background jobs (combined logs, Ctrl+C to stop)...'
  $jobs = @(
    Start-Job -Name 'server' -ScriptBlock { Set-Location $using:server; npm run dev 2>&1 }
    Start-Job -Name 'client' -ScriptBlock { Set-Location $using:client; npm run dev 2>&1 }
  )
  try {
    while ($true) {
      Receive-Job -Job $jobs | ForEach-Object { Write-Host $_ }
      if ($jobs.State -contains 'Failed' -or $jobs.State -contains 'Completed') { break }
      Start-Sleep -Milliseconds 400
    }
  } finally {
    Write-Step 'Stopping jobs...'
    $jobs | Stop-Job -PassThru | Remove-Job -Force
  }
} else {
  Write-Step 'Launching server dev server (new window)...'
  Start-Process pwsh -ArgumentList '-NoExit', '-Command', "Set-Location '$server'; npm run dev"

  Write-Step 'Launching client dev server (new window)...'
  Start-Process pwsh -ArgumentList '-NoExit', '-Command', "Set-Location '$client'; npm run dev"

  Write-Step 'Both dev servers started in separate windows.'
}
