# Multi-stage build for Cloud Storage App

# ============ Stage 1: Build Client ============
FROM node:20-alpine AS client-builder

WORKDIR /app/client

# Copy client package files
COPY client/package*.json ./

# Install ALL dependencies (including devDependencies for build)
RUN npm ci

# Copy client source
COPY client/ ./

# Build client
RUN npm run build

# ============ Stage 2: Production Server ============
FROM node:20-alpine AS production

# Install build dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy server package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Remove build dependencies to reduce image size
RUN apk del python3 make g++

# Copy server source
COPY server/ ./server/

# Copy built client from stage 1
COPY --from=client-builder /app/client/dist ./client/dist

# Create necessary directories
RUN mkdir -p server/logs server/backups server/cache/thumbnails uploads

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Run as non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs && \
    chown -R nodejs:nodejs /app

USER nodejs

# Start server
CMD ["node", "server/index.js"]
