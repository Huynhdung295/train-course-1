# ♻️ High Availability & Replication (Patroni)

> **Category**: PostgreSQL | **Complexity**: Expert | **PostgreSQL**: 16+ | **Patroni**: 3.3+

---

## 📖 Core Technical Mechanics & Deep-Dive

### WAL (Write-Ahead Logging)
Cơ chế cốt lõi của PostgreSQL (và mọi CSDL Relational) là WAL. 
Khi bạn chạy `UPDATE`, thay vì ghi trực tiếp vào Data Files trên ổ cứng (rất chậm), Postgres ghi sự thay đổi đó vào một file log gọi là WAL (rất nhanh vì ghi tuần tự - sequential I/O). Sau đó, một tiến trình background (Checkpointer) sẽ từ từ đồng bộ WAL vào Data Files.
Nếu server sập, khi khởi động lại, Postgres đọc WAL và "phát lại" (replay) để khôi phục dữ liệu.

### Streaming Replication
Dựa trên cơ chế WAL, Postgres hỗ trợ Streaming Replication.
1. **Primary Node**: Nơi nhận lệnh Đọc/Ghi (Read/Write).
2. **Replica Node(s)**: Nơi nhận lệnh Đọc (Read-only).
Primary liên tục gửi các bản ghi WAL qua mạng sang Replica. Replica nhận WAL và replay nó vào Database của mình. Kết quả: Replica có bản sao dữ liệu y hệt Primary với độ trễ (lag) cực thấp.

### Bài toán High Availability (HA) - Split Brain
Replication giúp bạn có bản sao dữ liệu. Nhưng khi Primary chết, làm sao để:
1. Promote (Thăng cấp) một Replica lên làm Primary mới?
2. Báo cho Ứng dụng biết địa chỉ IP của Primary mới?
3. Ngăn chặn Primary cũ (nếu nó sống lại) tiếp tục nhận write (hiện tượng **Split Brain** - Vỡ não, ghi vào 2 node song song gây hỏng data vĩnh viễn).

### Giải pháp: Patroni + etcd / ZooKeeper
Patroni (phát triển bởi Zalando) là một template cluster manager cho Postgres.
- Cài Patroni lên cùng server với Postgres (như một Daemon).
- Patroni liên tục "giao tiếp" với một Distributed Key-Value Store (như `etcd`, `Consul`, `ZooKeeper`) để bầu cử (Leader Election).
- Nếu Primary chết, etcd mất khóa (lock), các Replica sẽ bầu cử. Node nào có dữ liệu WAL mới nhất sẽ thắng và trở thành Primary mới.
- Primary cũ sống lại sẽ tự động biến thành Replica.

---

## 🌐 Real-World GitHub Patterns & Industry Reference

- **[zalando/patroni](https://github.com/zalando/patroni)** — Trái tim của mọi hệ thống Postgres HA hiện đại (Kể cả GitLab, Zalando, v.v.).
- **[etcd-io/etcd](https://github.com/etcd-io/etcd)** — Hệ thống quản lý trạng thái phân tán (DCS).

---

## 📐 System Design Blueprint

### Kiến trúc Patroni HA (3 Nodes)

```mermaid
graph TD
    subgraph K8s / Load Balancer
        ProxyW[HAProxy / PgBouncer - Write Port 5000]
        ProxyR[HAProxy / PgBouncer - Read Port 5001]
    end

    subgraph DCS (Distributed Consensus Store)
        etcd1[(etcd Node 1)]
        etcd2[(etcd Node 2)]
        etcd3[(etcd Node 3)]
    end

    subgraph Database Cluster
        P1[Patroni + Postgres Node A<br/>PRIMARY]
        P2[Patroni + Postgres Node B<br/>REPLICA]
        P3[Patroni + Postgres Node C<br/>REPLICA]
    end

    ProxyW -->|Route to Leader| P1
    ProxyR -->|Round Robin to Replicas| P2
    ProxyR -->|Round Robin to Replicas| P3

    P1 -.->|Heartbeat & Leader Lock| etcd1
    P2 -.->|Heartbeat & Follower state| etcd2
    P3 -.->|Heartbeat & Follower state| etcd3

    P1 ===|Streaming WAL| P2
    P1 ===|Streaming WAL| P3
```

---

## ⚙️ Production Configuration (Patroni YML)

### patroni.yml (Node 1)

```yaml
scope: postgres-cluster
namespace: /db/
name: pg-node-1

restapi:
  listen: 0.0.0.0:8008         # Patroni REST API (Dùng cho HAProxy check)
  connect_address: 10.0.0.1:8008

etcd:
  hosts: 10.0.0.1:2379, 10.0.0.2:2379, 10.0.0.3:2379

bootstrap:
  dcs:
    ttl: 30                    # Nếu Leader không ping etcd trong 30s, mất Leader
    loop_wait: 10
    retry_timeout: 10
    maximum_lag_on_failover: 1048576 # 1MB WAL. Nếu Replica tụt hậu quá 1MB, không được thăng cấp!
    postgresql:
      use_pg_rewind: true      # BẮT BUỘC để Primary cũ có thể sync lại làm Replica
      use_slots: true          # Chống Primary xóa WAL khi Replica bị ngắt mạng
      parameters:
        wal_level: replica
        max_wal_senders: 10
        max_replication_slots: 10

postgresql:
  listen: 0.0.0.0:5432
  connect_address: 10.0.0.1:5432
  data_dir: /var/lib/postgresql/data
  pg_hba:
    - host replication replicator 10.0.0.0/8 md5
    - host all all 0.0.0.0/0 md5
```

### HAProxy Cấu hình Routing
Để ứng dụng không cần biết IP của từng Node, ta dùng HAProxy làm Routing Layer.
HAProxy sẽ gọi HTTP tới Patroni REST API trên cổng 8008 để kiểm tra ai là Master, ai là Replica.

```haproxy
listen postgres-write
    bind *:5000
    option httpchk GET /master
    # Chỉ node nào trả về HTTP 200 ở /master mới nhận request write
    server pg1 10.0.0.1:5432 check port 8008
    server pg2 10.0.0.2:5432 check port 8008
    server pg3 10.0.0.3:5432 check port 8008

listen postgres-read
    bind *:5001
    option httpchk GET /replica
    balance roundrobin
    # Các node trả về HTTP 200 ở /replica sẽ nhận request read
    server pg1 10.0.0.1:5432 check port 8008
    server pg2 10.0.0.2:5432 check port 8008
    server pg3 10.0.0.3:5432 check port 8008
```

---

## 🧪 Verification Commands

```powershell
# Gửi REST API query đến Patroni để xem Cluster Status (Cực kỳ xịn xò của Patroni)
curl -s http://10.0.0.1:8008/patroni | jq .

# Hoặc dùng CLI tool của Patroni
patronictl -c /etc/patroni.yml topology

# Ép chuyển đổi Leader (Manual Failover) để test
patronictl -c /etc/patroni.yml failover
```

---

## ⚡ Best Practices & Anti-Patterns

### ✅ Best Practices
1. **Sử dụng Replication Slots**: Khi mạng chập chờn, Replica mất kết nối. Nếu Primary sinh ra quá nhiều WAL, nó sẽ tự xóa WAL cũ. Khi Replica kết nối lại, WAL đã mất -> Xóa DB làm lại từ đầu (Base Backup). Bật `use_slots: true`, Primary sẽ giữ WAL lại cho đến khi Replica xác nhận đã nhận!
2. **Luôn có số lẻ node DCS (etcd/ZK)**: 3 node là tối thiểu (Quorum = 2). Nếu dùng 2 node, đứt mạng 1 node thì cluster tê liệt vì không đạt quá bán để bầu leader.
3. **Sử dụng pg_rewind**: Khi Split Brain xảy ra tạm thời, Primary cũ có thể có 1 vài transaction chưa kip gửi sang Replica. `pg_rewind` giúp Primary cũ "tua lại" dữ liệu của mình, xóa bỏ các transaction lệch pha, để gia nhập lại cluster với vai trò Replica.

### ❌ Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| Dùng VIP (Virtual IP) thay vì HAProxy+Patroni API | VIP failover chậm (ARP propagation delays) và dễ gây Split Brain nếu config Pacemaker/Corosync sai. | Patroni API đảm bảo state thật của DB 100%. |
| Phụ thuộc hoàn toàn vào Synchronous Replication | Ghi vào Primary phải chờ Replica xác nhận mới Commit. Nếu mạng chậm hoặc Replica sập, Primary "treo" vĩnh viễn không ghi được (Outage toàn hệ thống). | Dùng Asynchronous (mặc định) cho hiệu năng cao. Chỉ dùng Sync cho DB Tín dụng/Ngân hàng với tối thiểu 3 Node. |
| Mở pool kết nối trực tiếp vào IPs | Node thay đổi vai trò (Failover), app vẫn cố ghi vào node cũ -> Lỗi Read-Only. | Luôn nối qua HAProxy/PgBouncer hoặc dùng JDBC config `targetServerType=master`. |
