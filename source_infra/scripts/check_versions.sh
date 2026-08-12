#!/usr/bin/env bash
# =================================================================
# check_versions.sh — Kiểm tra tất cả công cụ cần thiết cho Nexus ERP
#
# Chạy script này trước khi bắt đầu setup:
#   ./check_versions.sh
#
# Script sẽ kiểm tra và báo cáo: ✅ OK / ❌ Thiếu / ⚠️ Cần nâng cấp
# =================================================================

PASS=0
WARN=0
FAIL=0

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

ok()   { echo -e "  ${GREEN}✅ $1${NC}";   PASS=$((PASS+1)); }
warn() { echo -e "  ${YELLOW}⚠️  $1${NC}"; WARN=$((WARN+1)); }
fail() { echo -e "  ${RED}❌ $1${NC}";    FAIL=$((FAIL+1)); }

version_ge() {
    # Returns 0 (true) if version $1 >= version $2
    printf '%s\n' "$2" "$1" | sort -V -C
}

echo ""
echo -e "${CYAN}========================================================${NC}"
echo -e "${CYAN}   Nexus ERP — Developer Environment Check${NC}"
echo -e "${CYAN}========================================================${NC}"
echo ""

# ── Java ──────────────────────────────────────────────────────────────────────
echo -e "${CYAN}[Java]${NC}"
if command -v java &>/dev/null; then
    JAVA_VER=$(java -version 2>&1 | awk -F '"' '/version/ {print $2}' | cut -d. -f1)
    if [ -z "$JAVA_VER" ]; then JAVA_VER=$(java -version 2>&1 | grep -oP '(?<=version ")[^"]+' | cut -d. -f1); fi
    if version_ge "$JAVA_VER" "21"; then
        ok "Java $JAVA_VER (cần: 21+)"
    elif version_ge "$JAVA_VER" "17"; then
        warn "Java $JAVA_VER — CẦN NÂNG CẤP lên Java 21! (cần: 21+)"
    else
        fail "Java $JAVA_VER — QUÁ CŨ! Cần Java 21+"
    fi
    # Kiểm tra JAVA_HOME
    if [ -n "$JAVA_HOME" ]; then
        ok "JAVA_HOME được set: $JAVA_HOME"
    else
        warn "JAVA_HOME chưa được set (khuyến nghị nên set)"
    fi
else
    fail "Java chưa cài → Tải tại https://adoptium.net/ (chọn Java 21 LTS)"
fi

echo ""

# ── Maven ─────────────────────────────────────────────────────────────────────
echo -e "${CYAN}[Maven]${NC}"
if command -v mvn &>/dev/null; then
    MVN_VER=$(mvn -v 2>/dev/null | grep "Apache Maven" | awk '{print $3}')
    MVN_JAVA=$(mvn -v 2>/dev/null | grep "Java version" | awk -F': ' '{print $2}' | cut -d. -f1 | tr -d ',')
    if version_ge "$MVN_VER" "3.9"; then
        ok "Maven $MVN_VER (cần: 3.9+)"
    else
        warn "Maven $MVN_VER — Khuyến nghị nâng lên 3.9+"
    fi
    if version_ge "$MVN_JAVA" "21"; then
        ok "Maven đang dùng Java $MVN_JAVA ✓"
    else
        warn "Maven đang dùng Java $MVN_JAVA — Nên set JAVA_HOME trỏ vào Java 21"
    fi
else
    fail "Maven chưa cài → sudo apt install maven (Linux) | brew install maven (macOS)"
fi

echo ""

# ── Docker ────────────────────────────────────────────────────────────────────
echo -e "${CYAN}[Docker]${NC}"
if command -v docker &>/dev/null; then
    DOCKER_VER=$(docker -v | awk '{print $3}' | tr -d ',')
    if version_ge "$DOCKER_VER" "24"; then
        ok "Docker $DOCKER_VER (cần: 24+)"
    else
        warn "Docker $DOCKER_VER — Khuyến nghị nâng lên 24+"
    fi

    if docker info &>/dev/null; then
        ok "Docker daemon đang chạy"
    else
        fail "Docker daemon không chạy → Mở Docker Desktop"
    fi
else
    fail "Docker chưa cài → https://www.docker.com/products/docker-desktop"
fi

echo ""

# ── Docker Compose ────────────────────────────────────────────────────────────
echo -e "${CYAN}[Docker Compose]${NC}"
if docker compose version &>/dev/null; then
    COMPOSE_VER=$(docker compose version | grep -oP '[\d.]+' | head -1)
    ok "Docker Compose v$COMPOSE_VER"
else
    fail "Docker Compose v2 không có → Cập nhật Docker Desktop lên phiên bản mới nhất"
fi

echo ""

# ── Node.js ───────────────────────────────────────────────────────────────────
echo -e "${CYAN}[Node.js (dùng cho FE)]${NC}"
if command -v node &>/dev/null; then
    NODE_VER=$(node -v | tr -d 'v')
    if version_ge "$NODE_VER" "18"; then
        ok "Node.js v$NODE_VER (cần: 18+)"
    else
        warn "Node.js v$NODE_VER — Cần nâng lên v18+ (khuyến nghị v20 LTS)"
    fi
    NPM_VER=$(npm -v)
    ok "npm v$NPM_VER"
else
    warn "Node.js chưa cài — Chỉ cần nếu làm Frontend → https://nodejs.org"
fi

echo ""

# ── Git ───────────────────────────────────────────────────────────────────────
echo -e "${CYAN}[Git]${NC}"
if command -v git &>/dev/null; then
    GIT_VER=$(git --version | awk '{print $3}')
    ok "Git $GIT_VER"
    # Check git identity
    GIT_USER=$(git config --global user.name 2>/dev/null)
    GIT_EMAIL=$(git config --global user.email 2>/dev/null)
    if [ -n "$GIT_USER" ] && [ -n "$GIT_EMAIL" ]; then
        ok "Git identity: $GIT_USER <$GIT_EMAIL>"
    else
        warn "Git identity chưa được set → Chạy: git config --global user.name 'Tên Bạn' && git config --global user.email 'email@company.com'"
    fi
else
    fail "Git chưa cài → https://git-scm.com"
fi

echo ""

# ── SSH ───────────────────────────────────────────────────────────────────────
echo -e "${CYAN}[SSH Key (dùng cho kết nối VPS)]${NC}"
if [ -f ~/.ssh/id_rsa ] || [ -f ~/.ssh/id_ed25519 ]; then
    ok "SSH key tồn tại"
    if [ -f ~/.ssh/id_ed25519 ]; then
        ok "Dùng ed25519 (khuyến nghị)"
    else
        warn "Đang dùng RSA — Khuyến nghị tạo ed25519 mới: ssh-keygen -t ed25519 -C 'email@company.com'"
    fi
else
    warn "Chưa có SSH key → Tạo bằng: ssh-keygen -t ed25519 -C 'email@company.com'"
fi

echo ""

# ── Summary ───────────────────────────────────────────────────────────────────
echo -e "${CYAN}========================================================${NC}"
echo -e "${CYAN}   Kết quả:${NC}"
echo -e "   ${GREEN}✅ Đạt yêu cầu: $PASS${NC}"
echo -e "   ${YELLOW}⚠️  Cảnh báo:    $WARN${NC}"
echo -e "   ${RED}❌ Cần cài:      $FAIL${NC}"
echo -e "${CYAN}========================================================${NC}"

if [ "$FAIL" -gt 0 ]; then
    echo -e "\n${RED}❌ Vui lòng cài đặt các công cụ bị thiếu trước khi tiếp tục.${NC}"
    echo -e "   Xem hướng dẫn chi tiết trong: ${CYAN}source_infra/docs/DEVELOPER_GUIDE.md${NC}\n"
    exit 1
elif [ "$WARN" -gt 0 ]; then
    echo -e "\n${YELLOW}⚠️  Hệ thống có thể chạy được nhưng có một số cảnh báo cần xem xét.${NC}\n"
    exit 0
else
    echo -e "\n${GREEN}🎉 Tất cả công cụ đã sẵn sàng! Hãy bắt đầu với SETUP_AND_RUN.md${NC}\n"
    exit 0
fi
