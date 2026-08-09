#!/bin/bash
# =================================================================
# AUTOMATED POSTGRESQL BACKUP SCRIPT
# Tự động nén và dọn dẹp các bản backup cũ
# =================================================================

# Đọc file biến môi trường để lấy mật khẩu
source /opt/nexus/source_infra/vps_deploy/.env

BACKUP_DIR="/var/backups/nexus_db"
DATE=$(date +%Y-%m-%d_%H-%M-%S)
FILE_NAME="nexus_erp_backup_$DATE.sql.gz"

# Tạo thư mục nếu chưa tồn tại
mkdir -p "$BACKUP_DIR"

echo "[$(date)] Bắt đầu quá trình Backup Database..."

# Dùng Docker exec để gọi lệnh pg_dump bên trong container
docker exec -t nexus_postgres pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_DIR/$FILE_NAME"

if [ $? -eq 0 ]; then
  echo "[$(date)] Backup thành công: $BACKUP_DIR/$FILE_NAME"
else
  echo "[$(date)] LỖI: Không thể backup Database!"
  exit 1
fi

# Dọn dẹp: Xóa các file backup cũ hơn 7 ngày
echo "[$(date)] Đang dọn dẹp các bản backup cũ hơn 7 ngày..."
find "$BACKUP_DIR" -type f -name "*.sql.gz" -mtime +7 -exec rm {} \;

echo "[$(date)] Quá trình Backup & Cleanup hoàn tất."
