# 📖 Entity Relationship Diagram — Nexus ERP Database

## Master Schema (public)

```
tenants
├── id (UUID PK)
├── code (UNIQUE) ──────────────────> schema_name format: "tenant_{code}"
├── name
├── plan (basic | professional | enterprise)
├── status (active | suspended | trial | deleted)
├── schema_name (UNIQUE)
├── domain
├── config (JSONB)
├── created_at
├── expires_at
└── updated_at
        │
        │ 1:N
        ▼
subscriptions
├── id (UUID PK)
├── tenant_id (FK → tenants.id) [CASCADE DELETE]
├── plan
├── amount
├── billing_cycle (monthly | yearly)
├── started_at
├── expires_at
└── status

system_users
├── id (UUID PK)
├── email (UNIQUE)
├── hashed_password
├── role (superadmin | support | finance)
├── is_active
└── last_login_at

audit_log (PARTITIONED BY RANGE(occurred_at))
├── id (BIGSERIAL PK)
├── tenant_id (nullable — NULL = system action)
├── actor_id
├── actor_email
├── action (e.g., "tenant.created", "user.login")
├── resource_type
├── resource_id
├── payload (JSONB)
├── ip_address (INET)
└── occurred_at
```

---

## Tenant Schema (tenant_{code}) — Per-customer isolated schema

```
users
├── id (UUID PK)
├── keycloak_id (UUID UNIQUE) ──────> Keycloak external identity
├── email (UNIQUE)
├── full_name
├── phone
├── role (owner | manager | employee | cashier)
├── is_active
├── version (Optimistic Lock)
└── created_at

categories (self-referential tree)
├── id (UUID PK)
├── parent_id (FK → categories.id) ──> NULL = root category
├── name
├── slug (UNIQUE)
├── sort_order
└── is_active

products
├── id (UUID PK)
├── category_id (FK → categories.id)
├── sku (UNIQUE)
├── name
├── description
├── base_price (NUMERIC 15,2)
├── unit (pcs | kg | litre)
├── barcode (UNIQUE)
├── image_urls (TEXT[])
├── metadata (JSONB) ──────────────> Flexible product attributes
├── is_active
└── version (Optimistic Lock)
        │
        │ 1:N (via inventory)
        ▼
warehouses
├── id (UUID PK)
├── name
├── address
└── is_default

inventory (junction: products × warehouses)
├── id (UUID PK)
├── product_id (FK → products.id)
├── warehouse_id (FK → warehouses.id)
├── quantity ──────────────────────> Available stock
├── reserved_qty ──────────────────> Locked by open orders
├── reorder_point ─────────────────> Alert threshold
├── version (Optimistic Lock) ─────> Prevents overselling
└── UNIQUE (product_id, warehouse_id)

orders (PARTITIONED BY RANGE(created_at))
├── id (UUID PK)
├── order_number (UNIQUE) ─────────> Human-readable: ORD-20240101-001
├── customer_id (FK → users.id)
├── cashier_id (FK → users.id)
├── status (pending|confirmed|shipped|delivered|cancelled|refunded)
├── channel (pos | online | mobile)
├── subtotal / discount_amount / tax_amount / total_amount
├── currency
├── metadata (JSONB)
└── version (Optimistic Lock)
        │
        │ 1:N
        ▼
order_items
├── id (UUID PK)
├── order_id (FK → orders.id)
├── product_id (FK → products.id)
├── product_name (snapshot) ───────> Denormalized: preserves price at time of order
├── sku (snapshot)
├── unit_price (snapshot)
├── quantity
├── discount
└── total_price
        │
        │ 1:N
        ▼
payments
├── id (UUID PK)
├── order_id (FK → orders.id)
├── method (cash | card | qr_code | bank_transfer)
├── gateway (vnpay | momo | zalopay | stripe)
├── gateway_ref ───────────────────> External transaction ID for reconciliation
├── amount
├── status (pending | completed | failed | refunded)
└── metadata (JSONB)
```

---

## Key Design Decisions

| Decision | Rationale |
|---|---|
| `@Version` (Optimistic Lock) on orders, inventory, products | Prevents lost updates in concurrent scenarios without database-level locks |
| Partitioned `orders` and `audit_log` by month | PostgreSQL only scans relevant partition → queries on large tables stay fast |
| JSONB `metadata` on orders and products | Flexible schema for tenant-specific custom fields without ALTER TABLE |
| Snapshot `product_name` and `sku` in `order_items` | Order history remains accurate even if products are renamed or deleted |
| Separate `reserved_qty` in inventory | Enables real-time stock reservation without immediately decrementing `quantity` |
