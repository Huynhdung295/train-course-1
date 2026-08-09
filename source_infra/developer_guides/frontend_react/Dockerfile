# Build stage
FROM node:18-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Run stage (Dùng Nginx để host file tĩnh SPA)
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
# Chú ý: Cần copy file cấu hình nginx (có try_files $uri /index.html) để React Router không bị lỗi 404 khi F5
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
