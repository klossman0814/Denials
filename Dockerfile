# ===== Backend =====
FROM node:18-alpine AS backend
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --only=production
COPY backend/src ./src
EXPOSE 3000
CMD ["node", "src/server.js"]

# ===== Frontend (dev) =====
FROM node:18-alpine AS frontend-dev
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
EXPOSE 5173
CMD ["npx", "vite", "--host", "0.0.0.0"]

# ===== Frontend (build only) =====
FROM node:18-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ===== Nginx =====
FROM nginx:alpine
COPY --from=frontend-builder /app/frontend/dist /usr/share/nginx/html
COPY --from=backend /app/backend /app/backend
RUN apk add --no-cache nodejs npm
WORKDIR /app/backend
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD sh -c "node server.js & nginx -g 'daemon off;'"
