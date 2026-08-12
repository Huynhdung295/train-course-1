# ✅ Nexus Version Checker (Windows PowerShell)
# Chạy: .\check_versions.ps1
# Kiểm tra tất cả công cụ cần thiết để chạy Nexus ERP

$pass = 0
$warn = 0
$fail = 0

function Check-OK   { param($msg) Write-Host "  ✅ $msg" -ForegroundColor Green;  $script:pass++ }
function Check-Warn { param($msg) Write-Host "  ⚠️  $msg" -ForegroundColor Yellow; $script:warn++ }
function Check-Fail { param($msg) Write-Host "  ❌ $msg" -ForegroundColor Red;    $script:fail++ }

Write-Host ""
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "   Nexus ERP — Developer Environment Check (Windows)" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

# ── Java ──────────────────────────────────────────────────────────────────────
Write-Host "[Java]" -ForegroundColor Cyan
try {
    $javaOutput = java -version 2>&1
    $javaVer = ($javaOutput | Select-String -Pattern 'version "(\d+)' -AllMatches).Matches[0].Groups[1].Value
    if ([int]$javaVer -ge 21) {
        Check-OK "Java $javaVer (cần: 21+)"
    } elseif ([int]$javaVer -ge 17) {
        Check-Warn "Java $javaVer — CẦN NÂNG CẤP lên Java 21! Tải tại: https://adoptium.net"
    } else {
        Check-Fail "Java $javaVer — QUÁ CŨ! Cần Java 21+"
    }
} catch {
    Check-Fail "Java chưa cài → Tải tại https://adoptium.net (Java 21 LTS, Windows x64)"
}
Write-Host ""

# ── Maven ─────────────────────────────────────────────────────────────────────
Write-Host "[Maven]" -ForegroundColor Cyan
try {
    $mvnOutput = mvn -v 2>&1
    $mvnVer = ($mvnOutput | Select-String -Pattern "Apache Maven (\S+)").Matches[0].Groups[1].Value
    $mvnJava = ($mvnOutput | Select-String -Pattern "Java version: (\d+)").Matches[0].Groups[1].Value
    
    $mvnMajor = [int]($mvnVer.Split('.')[0])
    $mvnMinor = [int]($mvnVer.Split('.')[1])
    if ($mvnMajor -gt 3 -or ($mvnMajor -eq 3 -and $mvnMinor -ge 9)) {
        Check-OK "Maven $mvnVer (cần: 3.9+)"
    } else {
        Check-Warn "Maven $mvnVer — Khuyến nghị nâng lên 3.9+"
    }
    
    if ([int]$mvnJava -ge 21) {
        Check-OK "Maven đang dùng Java $mvnJava ✓"
    } else {
        Check-Warn "Maven đang dùng Java $mvnJava — Nên đặt JAVA_HOME trỏ vào Java 21"
    }
} catch {
    Check-Fail "Maven chưa cài → Tải tại https://maven.apache.org/download.cgi"
}
Write-Host ""

# ── Docker ────────────────────────────────────────────────────────────────────
Write-Host "[Docker]" -ForegroundColor Cyan
try {
    $dockerVer = (docker -v) -replace "Docker version (\S+),.*", '$1'
    $dockerMajor = [int]($dockerVer.Split('.')[0])
    if ($dockerMajor -ge 24) {
        Check-OK "Docker $dockerVer (cần: 24+)"
    } else {
        Check-Warn "Docker $dockerVer — Cập nhật Docker Desktop lên mới nhất"
    }
    
    docker ps 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Check-OK "Docker daemon đang chạy"
    } else {
        Check-Fail "Docker daemon chưa chạy → Mở Docker Desktop"
    }
} catch {
    Check-Fail "Docker chưa cài → https://www.docker.com/products/docker-desktop"
}
Write-Host ""

# ── Docker Compose ────────────────────────────────────────────────────────────
Write-Host "[Docker Compose]" -ForegroundColor Cyan
try {
    $composeVer = docker compose version 2>&1
    Check-OK "Docker Compose: $composeVer"
} catch {
    Check-Fail "Docker Compose v2 không có → Cập nhật Docker Desktop"
}
Write-Host ""

# ── Node.js ───────────────────────────────────────────────────────────────────
Write-Host "[Node.js (cho Frontend)]" -ForegroundColor Cyan
try {
    $nodeVer = (node -v).TrimStart('v')
    $nodeMajor = [int]($nodeVer.Split('.')[0])
    if ($nodeMajor -ge 18) {
        Check-OK "Node.js v$nodeVer (cần: 18+)"
    } else {
        Check-Warn "Node.js v$nodeVer — Cần nâng lên v18+ → https://nodejs.org (v20 LTS)"
    }
    $npmVer = npm -v
    Check-OK "npm v$npmVer"
} catch {
    Check-Warn "Node.js chưa cài (chỉ cần nếu làm Frontend) → https://nodejs.org"
}
Write-Host ""

# ── Git ───────────────────────────────────────────────────────────────────────
Write-Host "[Git]" -ForegroundColor Cyan
try {
    $gitVer = git --version
    Check-OK $gitVer
    
    $gitUser = git config --global user.name 2>&1
    $gitEmail = git config --global user.email 2>&1
    if ($gitUser -and $gitEmail) {
        Check-OK "Git identity: $gitUser <$gitEmail>"
    } else {
        Check-Warn "Git identity chưa được set. Chạy:`n     git config --global user.name 'Tên Bạn'`n     git config --global user.email 'email@company.com'"
    }
} catch {
    Check-Fail "Git chưa cài → https://git-scm.com"
}
Write-Host ""

# ── SSH ───────────────────────────────────────────────────────────────────────
Write-Host "[SSH Key]" -ForegroundColor Cyan
$sshKeyPath = "$env:USERPROFILE\.ssh"
if ((Test-Path "$sshKeyPath\id_ed25519") -or (Test-Path "$sshKeyPath\id_rsa")) {
    Check-OK "SSH key tồn tại tại $sshKeyPath"
    if (Test-Path "$sshKeyPath\id_ed25519") {
        Check-OK "Đang dùng ed25519 (khuyến nghị)"
    } else {
        Check-Warn "Đang dùng RSA — Khuyến nghị dùng ed25519: ssh-keygen -t ed25519"
    }
} else {
    Check-Warn "Chưa có SSH key. Tạo bằng: ssh-keygen -t ed25519 -C 'email@company.com'"
}
Write-Host ""

# ── PowerShell Version ────────────────────────────────────────────────────────
Write-Host "[PowerShell]" -ForegroundColor Cyan
$psVer = $PSVersionTable.PSVersion
if ($psVer.Major -ge 7) {
    Check-OK "PowerShell $psVer (Ops Panel cần: 7+)"
} else {
    Check-Warn "PowerShell $psVer — Cài PowerShell 7: winget install Microsoft.PowerShell"
}
Write-Host ""

# ── Summary ───────────────────────────────────────────────────────────────────
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "   Kết quả:" -ForegroundColor Cyan
Write-Host "   ✅ Đạt yêu cầu: $pass" -ForegroundColor Green
Write-Host "   ⚠️  Cảnh báo:    $warn" -ForegroundColor Yellow
Write-Host "   ❌ Cần cài:      $fail" -ForegroundColor Red
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

if ($fail -gt 0) {
    Write-Host "❌ Cài đặt các công cụ bị thiếu trước khi tiếp tục." -ForegroundColor Red
    Write-Host "   Xem hướng dẫn: source_infra\docs\DEVELOPER_GUIDE.md" -ForegroundColor Cyan
    exit 1
} elseif ($warn -gt 0) {
    Write-Host "⚠️  Hệ thống có thể chạy được nhưng có cảnh báo cần xem xét." -ForegroundColor Yellow
} else {
    Write-Host "🎉 Tất cả công cụ sẵn sàng! Xem SETUP_AND_RUN.md để bắt đầu." -ForegroundColor Green
}
