#!/bin/bash
# =================================================================
# NEXUS REMOTE OPS SCRIPT (Runs on VPS)
# =================================================================

# Color Codes
GREEN='\033[0;32m'
CYAN='\033[0;36m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

NEXUS_DIR="/opt/nexus/source_infra/vps_deploy"
APPS_DIR="/apps"

case $1 in
    "setup_ssh_github")
        if [ ! -f ~/.ssh/id_rsa ]; then
            ssh-keygen -t rsa -b 4096 -C "nexus_deploy_key" -N "" -f ~/.ssh/id_rsa
        fi
        ssh-keyscan -t rsa github.com >> ~/.ssh/known_hosts 2>/dev/null
        echo -e "${CYAN}--- YOUR VPS PUBLIC KEY ---${NC}"
        cat ~/.ssh/id_rsa.pub
        echo -e "${CYAN}---------------------------${NC}"
        echo -e "${YELLOW}Please add this key to GitHub (Settings -> SSH and GPG keys)${NC}"
        ;;
        
    "clone_repo")
        # $2: git_url, $3: folder_name, $4: branch_name
        mkdir -p $APPS_DIR && cd $APPS_DIR
        ssh-keyscan -t rsa github.com >> ~/.ssh/known_hosts 2>/dev/null
        
        if [ -d "$3" ]; then
            echo -e "${RED}Error: Directory $APPS_DIR/$3 already exists!${NC}"
        else
            BNAME=${4:-main}
            echo -e "${CYAN}Cloning branch '$BNAME' from '$2' into folder '$3'...${NC}"
            git clone -b "$BNAME" "$2" "$3"
            echo -e "${GREEN}[SUCCESS] Repository Cloned.${NC}"
        fi
        ;;

    "setup_ssl")
        echo -e "${CYAN}--- REQUESTING SSL FOR: $2 ---${NC}"
        certbot --nginx -d "$2" --non-interactive --agree-tos --register-unsafely-without-email
        systemctl reload nginx
        echo -e "${GREEN}[SUCCESS] SSL Issued and Nginx Reloaded.${NC}"
        ;;

    "docker_list")
        echo -e "${CYAN}--- NEXUS CONTAINERS ---${NC}"
        docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
        ;;

    "docker_logs")
        docker logs --tail 50 "$2"
        ;;

    "deploy_nexus")
        echo -e "${CYAN}--- DEPLOYING NEXUS ECOSYSTEM ---${NC}"
        if [ -d "$NEXUS_DIR" ]; then
            cd "$NEXUS_DIR"
            ./scripts/deploy.sh
        else
            echo -e "${RED}Error: Directory $NEXUS_DIR not found. Did you clone source_infra to /opt/nexus?${NC}"
            exit 1
        fi
        ;;

    "deploy_app")
        echo -e "${CYAN}--- DEPLOYING STANDALONE APP: $APPS_DIR/$2 ---${NC}"
        if [ -d "$APPS_DIR/$2" ]; then
            cd "$APPS_DIR/$2"
            docker system prune -f
            if docker compose up -d --build --remove-orphans; then
                echo -e "${GREEN}DEPLOYMENT FINISHED SUCCESSFULLY!${NC}"
            else
                echo -e "${RED}DEPLOYMENT FAILED!${NC}"
                exit 1
            fi
        else
            echo -e "${RED}Error: Directory $APPS_DIR/$2 not found!${NC}"
        fi
        ;;

    "env_pull")
        if [ -f "$NEXUS_DIR/.env" ]; then
            cat "$NEXUS_DIR/.env"
        else
            echo "ERROR: .env not found at $NEXUS_DIR"
        fi
        ;;
        
    "env_sync")
        cat > "$NEXUS_DIR/.env"
        echo -e "${GREEN}Successfully synced .env to $NEXUS_DIR/.env${NC}"
        ;;

    "nginx_sync")
        cat > "/etc/nginx/nginx.conf"
        nginx -t && systemctl reload nginx
        echo -e "${GREEN}Successfully synced Nginx config and reloaded.${NC}"
        ;;

    "system")
        echo -e "${CYAN}--- RAM USAGE ---${NC}"
        free -h
        echo -e "\n${CYAN}--- TOP PROCESSES ---${NC}"
        top -n 1 -b | head -n 10
        ;;
esac
