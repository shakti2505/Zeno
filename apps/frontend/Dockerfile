# Stage 1: Build React SPA
FROM node:18-alpine AS builder
WORKDIR /app

# Copy root workspace configuration files
COPY package*.json ./
COPY apps/backend/package.json ./apps/backend/
COPY apps/frontend/package.json ./apps/frontend/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies from root
RUN npm install

# Copy source code
COPY . .

# Build frontend
WORKDIR /app/apps/frontend
RUN npm run build

# Stage 2: Serve with NGINX
FROM nginx:alpine
COPY --from=builder /app/apps/frontend/dist /usr/share/nginx/html
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
