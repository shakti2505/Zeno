FROM node:18-alpine AS builder
WORKDIR /app

# Copy root workspace configuration files
COPY package*.json ./
COPY apps/backend/package.json ./apps/backend/
COPY apps/frontend/package.json ./apps/frontend/
COPY packages/shared/package.json ./packages/shared/

# Install all dependencies from root
RUN npm install

# Copy source code
COPY . .

# Build backend
WORKDIR /app/apps/backend
RUN npm run build

# Runtime working directory
WORKDIR /app/apps/backend
EXPOSE 3000
CMD ["npm", "start"]
