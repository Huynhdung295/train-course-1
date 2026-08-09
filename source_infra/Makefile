# =================================================================
# NEXUS INFRASTRUCTURE MAKEFILE
# Tiêu chuẩn Vận hành tự động cho Enterprise
# =================================================================

.PHONY: help provision deploy logs backup clean

help:
	@echo "NEXUS INFRA OPS"
	@echo "----------------------------------------------------"
	@echo "make provision    - Dùng Ansible setup trắng Server (Docker, Nginx, SSL)"
	@echo "make deploy       - Kéo code mới và khởi động toàn bộ Hệ sinh thái"
	@echo "make deploy-app   - Deploy từng microservice riêng lẻ (Ví dụ: make deploy-app APP=frontend)"
	@echo "make logs         - Xem log thời gian thực của toàn hệ thống"
	@echo "make backup       - Nén và sao lưu Database thủ công"
	@echo "make clean        - Dọn dẹp Docker Image rác"

provision:
	@echo "Bắt đầu chạy Ansible Playbook cấu hình Server..."
	ansible-playbook -i ansible/inventory.ini ansible/provision.yml

deploy:
	@echo "Deploying Nexus Ecosystem..."
	cd vps_deploy && docker compose pull && docker compose up -d --remove-orphans
	@echo "Đang dọn dẹp ổ cứng..."
	docker image prune -f

deploy-app:
	@if [ -z "$(APP)" ]; then echo "Lỗi: Xin hãy cung cấp tên APP (VD: make deploy-app APP=backend)"; exit 1; fi
	@echo "Deploying $(APP)..."
	cd vps_deploy && docker compose up -d --no-deps --build $(APP)

logs:
	cd vps_deploy && docker compose logs -f

backup:
	@echo "Chạy kịch bản Backup thủ công..."
	cd vps_deploy && ./scripts/cronjob_backup.sh

clean:
	@echo "Xóa bỏ toàn bộ Docker system rác..."
	docker system prune -a --volumes -f
