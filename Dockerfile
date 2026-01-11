# Simple Dockerfile for Cloud Storage App
FROM node:20-alpine

# Install build dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++ sqlite

WORKDIR /app

# Copy all package files
COPY package*.json ./
COPY client/package*.json ./client/

# Install server dependencies
RUN npm install

# Install client dependencies
WORKDIR /app/client
RUN npm install

# Go back to app root
WORKDIR /app

# Copy all source code
COPY . .

# Build client
WORKDIR /app/client
RUN npm run build

# Go back to app root
WORKDIR /app

# Create necessary directories
RUN mkdir -p server/logs server/backups server/cache/thumbnails uploads

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Start server
CMD ["node", "server/index.js"]
