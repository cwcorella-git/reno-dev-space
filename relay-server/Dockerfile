FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy server code
COPY server.js ./

# Create data directory for SQLite
RUN mkdir -p /data

ENV DATABASE_PATH=/data/chat.db
ENV PORT=8080

EXPOSE 8080

CMD ["node", "server.js"]
