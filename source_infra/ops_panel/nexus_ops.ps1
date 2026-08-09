<#
.SYNOPSIS
Nexus Ops Control Panel (PowerShell Edition)
.DESCRIPTION
Quản lý Hạ tầng, triển khai mã nguồn, và theo dõi Server từ xa không cần Agent.
#>

$ScriptPath = $MyInvocation.MyCommand.Path
$ScriptDir = Split-Path $ScriptPath
$ListFile = Join-Path $ScriptDir "vps_list.json"
$RemoteScript = Join-Path $ScriptDir "remote_nexus.sh"
$EnvDir = Join-Path $ScriptDir "env_configs"
$NginxDir = Join-Path $ScriptDir "nginx_configs"

# Đảm bảo cấu trúc
if (-not (Test-Path $EnvDir)) { New-Item -ItemType Directory -Path $EnvDir | Out-Null }
if (-not (Test-Path $NginxDir)) { New-Item -ItemType Directory -Path $NginxDir | Out-Null }
if (-not (Test-Path $ListFile)) { "[]" | Out-File -FilePath $ListFile -Encoding UTF8 }

# Load Danh sách VPS
$VpsList = Get-Content $ListFile -Raw | ConvertFrom-Json

function Show-Header ($Title) {
    Clear-Host
    Write-Host "===================================================" -ForegroundColor Cyan
    Write-Host "   $Title" -ForegroundColor Yellow -NoNewline
    Write-Host "`n===================================================" -ForegroundColor Cyan
}

function Invoke-Remote ($Vps, $Command) {
    $User = $Vps.User
    $Ip = $Vps.Ip
    $Port = $Vps.Port
    # Pipe remote script to ssh and execute function
    $Content = Get-Content $RemoteScript -Raw
    $Content = $Content -replace "`r", "" # Remove Windows line endings
    
    # Run via ssh using standard input
    $Content | ssh -p $Port $User@$Ip "bash -s -- $Command"
}

function Main-Menu {
    while ($true) {
        Show-Header "NEXUS OPS CONTROL PANEL - SELECT VPS"
        $i = 1
        foreach ($v in $VpsList) {
            Write-Host "  $i. $($v.Name) ($($v.Ip))" -ForegroundColor White
            $i++
        }
        Write-Host "  -------------------------------------------------" -ForegroundColor Gray
        Write-Host "  A. Add New VPS" -ForegroundColor Green
        Write-Host "  0. Exit" -ForegroundColor Red
        Write-Host "===================================================" -ForegroundColor Cyan
        
        $Choice = Read-Host "Select Option"
        
        if ($Choice -eq '0') { exit }
        if ($Choice -eq 'a' -or $Choice -eq 'A') { Add-Vps; continue }
        
        if ([int]$Choice -gt 0 -and [int]$Choice -le $VpsList.Count) {
            $SelectedVps = $VpsList[[int]$Choice - 1]
            Vps-Menu $SelectedVps
        }
    }
}

function Add-Vps {
    $Name = Read-Host "VPS Name (e.g., Production-01)"
    $Ip = Read-Host "IP Address"
    $User = Read-Host "Username [root]"
    if ([string]::IsNullOrWhiteSpace($User)) { $User = "root" }
    $Port = Read-Host "SSH Port [22]"
    if ([string]::IsNullOrWhiteSpace($Port)) { $Port = "22" }

    $NewVps = [PSCustomObject]@{
        Name = $Name
        Ip = $Ip
        User = $User
        Port = $Port
    }
    $script:VpsList += $NewVps
    $script:VpsList | ConvertTo-Json -Depth 10 | Out-File $ListFile -Encoding UTF8
    Write-Host "[SUCCESS] Added $Name to the list!" -ForegroundColor Green
    Start-Sleep -Seconds 2
}

function Vps-Menu ($Vps) {
    while ($true) {
        Show-Header "MANAGING: $($Vps.Name) ($($Vps.Ip))"
        Write-Host "  1. SSH Terminal        7. DEPLOY Nexus Ecosystem" -ForegroundColor White
        Write-Host "  2. Docker List All     8. PUSH Nexus .env" -ForegroundColor White
        Write-Host "  3. View Docker Logs    9. PULL Nexus .env" -ForegroundColor White
        Write-Host "  4. SYNC Nginx (Push)   10. Setup GitHub SSH Key" -ForegroundColor White
        Write-Host "  5. System Status       11. ISSUE SSL (Certbot)" -ForegroundColor White
        Write-Host "  6. CLONE Repo (Apps)   0. Back to VPS List" -ForegroundColor White
        Write-Host "===================================================" -ForegroundColor Cyan
        
        $Choice = Read-Host "Select Action"
        
        switch ($Choice) {
            '0' { return }
            '1' { ssh -p $($Vps.Port) "$($Vps.User)@$($Vps.Ip)" -t "bash --login" }
            '2' { Invoke-Remote $Vps "docker_list"; Read-Host "Press Enter" }
            '3' { 
                $Container = Read-Host "Enter Container Name"
                Invoke-Remote $Vps "docker_logs $Container"
                Read-Host "Press Enter" 
            }
            '4' {
                $LocalNginx = Join-Path $NginxDir "$($Vps.Name).conf"
                if (Test-Path $LocalNginx) {
                    Write-Host "Pushing Nginx Config..." -ForegroundColor Cyan
                    Get-Content $LocalNginx -Raw | ssh -p $($Vps.Port) "$($Vps.User)@$($Vps.Ip)" "cat > /tmp/nexus_nginx.conf && tr -d '\r' < /tmp/nexus_nginx.conf > /etc/nginx/nginx.conf && nginx -t && systemctl reload nginx"
                    Write-Host "Sync Complete!" -ForegroundColor Green
                } else {
                    Write-Host "ERROR: File not found at $LocalNginx" -ForegroundColor Red
                }
                Read-Host "Press Enter"
            }
            '5' { Invoke-Remote $Vps "system"; Read-Host "Press Enter" }
            '6' {
                $Repo = Read-Host "Git SSH URL"
                $Folder = Read-Host "Folder Name"
                $Branch = Read-Host "Branch [main]"
                Invoke-Remote $Vps "clone_repo '$Repo' '$Folder' '$Branch'"
                Read-Host "Press Enter"
            }
            '7' { Invoke-Remote $Vps "deploy_nexus"; Read-Host "Press Enter" }
            '8' {
                $LocalEnv = Join-Path $EnvDir "$($Vps.Name).env"
                if (Test-Path $LocalEnv) {
                    Write-Host "Pushing .env Config..." -ForegroundColor Cyan
                    Get-Content $LocalEnv -Raw | ssh -p $($Vps.Port) "$($Vps.User)@$($Vps.Ip)" "tr -d '\r' > /opt/nexus/source_infra/vps_deploy/.env"
                    Invoke-Remote $Vps "deploy_nexus"
                    Write-Host "Sync and Deploy Complete!" -ForegroundColor Green
                } else {
                    Write-Host "ERROR: File not found at $LocalEnv" -ForegroundColor Red
                }
                Read-Host "Press Enter"
            }
            '9' {
                $LocalEnv = Join-Path $EnvDir "$($Vps.Name).env"
                Invoke-Remote $Vps "env_pull" | Out-File $LocalEnv -Encoding UTF8
                Write-Host "Successfully Pulled .env to $LocalEnv" -ForegroundColor Green
                Read-Host "Press Enter"
            }
            '10' { Invoke-Remote $Vps "setup_ssh_github"; Read-Host "Press Enter" }
            '11' {
                $Domain = Read-Host "Enter Domain (e.g. nexus.com)"
                Invoke-Remote $Vps "setup_ssl $Domain"
                Read-Host "Press Enter"
            }
        }
    }
}

Main-Menu
