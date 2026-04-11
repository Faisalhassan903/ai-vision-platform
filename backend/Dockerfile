# ================================
# BACKEND DOCKERFILE
# ================================
# Node.js Express + Socket.io

FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build TypeScript (if using)
RUN npm run build || true

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget --quiet --tries=1 --spider http://localhost:5000/ || exit 1

# Start server
CMD ["node", "dist/server.js"]
