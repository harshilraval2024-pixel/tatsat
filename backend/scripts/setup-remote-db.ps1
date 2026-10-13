<#
  One-shot setup for a hosted Postgres (Neon, Render, Supabase, ...):
  creates the tables (alembic) and loads the starting data (seed).

  Usage (from the backend folder):
      .\scripts\setup-remote-db.ps1

  It asks for the connection string and the admin password with hidden input,
  so neither is written to disk or to your shell history.
#>
param(
    [string]$DatabaseUrl,
    [string]$AdminPassword,
    # Read the connection string from the clipboard (copy it in Neon first). Most reliable.
    [switch]$FromClipboard
)

$ErrorActionPreference = "Stop"
$backend = Split-Path -Parent $PSScriptRoot
Set-Location $backend

function Read-Secret([string]$prompt) {
    $s = Read-Host -Prompt $prompt -AsSecureString
    $b = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringAuto($b) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b) }
}

function Find-PostgresUrl([string]$text) {
    # Accepts a bare URL, a quoted URL, or a whole  psql 'postgresql://...'  command.
    if ($text -match "postgres(?:ql)?://[^\s'`"]+") { return $Matches[0] }
    return $null
}

$raw = $DatabaseUrl
if ($FromClipboard) { $raw = (Get-Clipboard -Raw) }
if (-not $raw) { $raw = Read-Secret "Paste the connection string (postgresql://...)" }
$DatabaseUrl = Find-PostgresUrl $raw
if (-not $DatabaseUrl) {
    $n = if ($raw) { $raw.Trim().Length } else { 0 }
    Write-Host "Received $n characters, but no postgresql:// connection string was found in it." -ForegroundColor Yellow
    Write-Host "A Neon connection string is about 100-140 characters and starts with postgresql://" -ForegroundColor Yellow
    Write-Host "Tip: copy it in Neon (Connect panel -> 'Connection string'), then run:" -ForegroundColor Yellow
    Write-Host "     .\scripts\setup-remote-db.ps1 -FromClipboard" -ForegroundColor Yellow
    throw "No Postgres connection string found."
}
try {
    Write-Host ("Using host: " + ([Uri]($DatabaseUrl -replace '^postgres(ql)?://','http://')).Host) -ForegroundColor DarkGray
} catch { }
if (-not $AdminPassword) { $AdminPassword = Read-Secret "Choose the admin password (12+ characters)" }
if ($AdminPassword.Length -lt 12) { throw "Admin password must be at least 12 characters." }
if ($AdminPassword -eq "changeme") { throw "Do not use the default password." }

$python = Join-Path $backend ".venv\Scripts\python.exe"
if (-not (Test-Path $python)) { throw "Missing .venv - run: python -m venv .venv ; .venv\Scripts\pip install -r requirements.txt" }

$env:DATABASE_URL = $DatabaseUrl
$env:ADMIN_INITIAL_PASSWORD = $AdminPassword

Write-Host "`n[1/3] Creating tables (alembic upgrade head)..." -ForegroundColor Cyan
& $python -m alembic upgrade head
if ($LASTEXITCODE -ne 0) { throw "Migrations failed." }

Write-Host "`n[2/3] Loading starting data (seed)..." -ForegroundColor Cyan
& $python -m app.scripts.seed_data
if ($LASTEXITCODE -ne 0) { throw "Seeding failed." }

Write-Host "`n[3/3] Checking the database from the app..." -ForegroundColor Cyan
$check = @'
import asyncio
from sqlalchemy import text
from app.database import AsyncSessionLocal
async def main():
    async with AsyncSessionLocal() as s:
        states = (await s.execute(text("select count(*) from states"))).scalar_one()
        admins = (await s.execute(text("select count(*) from admin_users"))).scalar_one()
        print(f"OK - states: {states}, admin users: {admins}")
asyncio.run(main())
'@
$check | & $python -
if ($LASTEXITCODE -ne 0) { throw "Connection check failed." }

Remove-Item Env:DATABASE_URL, Env:ADMIN_INITIAL_PASSWORD -ErrorAction SilentlyContinue
Write-Host "`nDone. Admin login: username 'admin' + the password you just chose." -ForegroundColor Green
Write-Host "Now set DATABASE_URL (same connection string) and JWT_SECRET on your Render service."
