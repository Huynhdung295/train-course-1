# Tối ưu hóa cho môi trường Node.js Production
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
# Cài cả dev dependencies để build Typescript
RUN npm ci

COPY . .
# Compile TS sang JS
RUN npm run build

# Image thật để chạy
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Chỉ copy package.json và cài gói production
COPY package*.json ./
RUN npm ci --only=production

# Copy thư mục dist từ builder
COPY --from=builder /app/dist ./dist

# Không chạy bằng quyền root để bảo mật
USER node

EXPOSE 3001
CMD ["node", "dist/app.js"]
