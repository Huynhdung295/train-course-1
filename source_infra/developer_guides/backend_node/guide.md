# 🚀 HƯỚNG DẪN KHỞI TẠO BACKEND NODE.JS (EXPRESS/NEST)
Dành cho: Các Microservice phụ trợ, Realtime (Socket.io), API Gateway nhẹ, hoặc các tác vụ xử lý IO cường độ cao, BFF (Backend-for-Frontend).

---

## 1. KHỞI TẠO KHUNG DỰ ÁN (TYPESCRIPT BẮT BUỘC)
Chúng ta sẽ dựng Express.js với TypeScript để đảm bảo tính an toàn dữ liệu ngang ngửa Java.

```bash
mkdir nexus-node-service
cd nexus-node-service

# Khởi tạo package.json
npm init -y

# Cài đặt Typescript & Môi trường dev
npm install -D typescript ts-node nodemon @types/node @types/express
npx tsc --init
```

## 2. CÀI ĐẶT THƯ VIỆN LÕI
Cài đặt Express và các middleware cực kỳ quan trọng cho Enterprise.

```bash
# Core Express
npm install express cors helmet morgan dotenv

# Types cho core
npm install -D @types/cors @types/morgan

# Tương tác Database (Prisma ORM) & Redis
npm install prisma @prisma/client redis

# Khởi tạo Prisma ORM
npx prisma init
```

## 3. THIẾT LẬP APP.TS MẪU (BỘ KHUNG BOILERPLATE)
Tạo file `src/app.ts` và paste đoạn code chuẩn mực sau:

```typescript
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import 'dotenv/config';

const app = express();

// Security & Middlewares
app.use(helmet()); // Chống tấn công XSS, Clickjacking
app.use(cors());   // Xử lý CORS
app.use(express.json()); // Parse JSON body
app.use(morgan('dev'));  // Ghi Log request

// Health Check cho Kubernetes
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'UP', timestamp: new Date() });
});

// Xử lý lỗi toàn cục (Global Error Handler)
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error(err.stack);
    res.status(500).json({
        type: "about:blank",
        title: "Internal Server Error",
        status: 500,
        traceId: req.headers['x-trace-id'] || "unknown"
    });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`🚀 Node.js Service đang chạy tại port ${PORT}`);
});
```

## 4. KÍCH HOẠT (CHẠY LOCAL)

Tạo file `nodemon.json` ở thư mục gốc:
```json
{
  "watch": ["src"],
  "ext": "ts",
  "exec": "ts-node src/app.ts"
}
```

Và thêm dòng sau vào phần `scripts` trong `package.json`:
```json
"scripts": {
  "dev": "nodemon",
  "build": "tsc",
  "start": "node dist/app.js"
}
```

Chạy Server:
```bash
npm run dev
```
> Server sẽ nóng lên tại `http://localhost:3001`. Sẵn sàng cho mọi cuộc chiến I/O Realtime!
