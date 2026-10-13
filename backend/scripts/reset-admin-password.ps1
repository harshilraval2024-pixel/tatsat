<#
  Reset the admin password on a hosted database (use if you forgot it).

  1. Copy the connection string in Neon (Connect panel, pooling OFF).
  2. From the backend folder run:
         .\scripts\reset-admin-password.ps1 -FromClipboard
  3. Type the new password (12+ characters). Input is hidden.

  Does not touch any other data. The username stays 'admin'.
#>
param(
    [string]$DatabaseUrl,
    [string]$NewPassword,
    [string]$Username = "admin",
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

$raw = $DatabaseUrl
if ($FromClipboard) { $raw = (Get-Clipboard -Raw) }
if (-not $raw) { $raw = Read-Secret "Paste the connection string (postgresql://...)" }
if ($raw -match "postgres(?:ql)?://[^\s'`"]+") { $DatabaseUrl = $Matches[0] }
else { throw "No postgresql:// connection string found (received $($raw.Trim().Length) characters)." }

if (-not $NewPassword) { $NewPassword = Read-Secret "New admin password (12+ characters)" }
if ($NewPassword.Length -lt 12) { throw "Password must be at least 12 characters." }
if ($NewPassword -eq "changeme") { throw "Do not use the default password." }

$python = Join-Path $backend ".venv\Scripts\python.exe"
if (-not (Test-Path $python)) { throw "Missing .venv - run: python -m venv .venv ; .venv\Scripts\pip install -r requirements.txt" }

$env:DATABASE_URL = $DatabaseUrl
$env:RESET_USERNAME = $Username
$env:RESET_PASSWORD = $NewPassword

$code = @'
import os
from sqlalchemy import select
from app.database import SessionLocal
from app.models.tables import AdminUser
from app.utils.security import get_password_hash

name = os.environ["RESET_USERNAME"]
with SessionLocal() as s:
    user = s.execute(select(AdminUser).where(AdminUser.username == name)).scalar_one_or_none()
    if user is None:
        user = AdminUser(username=name, password_hash=get_password_hash(os.environ["RESET_PASSWORD"]), is_active=True)
        s.add(user)
        print(f"Created admin user '{name}'.")
    else:
        user.password_hash = get_password_hash(os.environ["RESET_PASSWORD"])
        user.is_active = True
        print(f"Password updated for '{name}'.")
    s.commit()
'@
$code | & $python -
$ok = ($LASTEXITCODE -eq 0)

Remove-Item Env:DATABASE_URL, Env:RESET_USERNAME, Env:RESET_PASSWORD -ErrorAction SilentlyContinue
if (-not $ok) { throw "Reset failed." }
Write-Host "`nDone. Log in with username '$Username' and the new password." -ForegroundColor Green
