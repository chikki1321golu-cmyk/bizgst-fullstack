FROM node:20-slim

# Install OpenSSL 1.1 — required by Prisma 5 engine
RUN apt-get update -y && \
    apt-get install -y openssl libssl-dev && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files and prisma schema first (layer cache)
COPY package*.json ./
COPY prisma ./prisma

# Install dependencies
RUN npm install

# Copy rest of source
COPY . .

# Generate Prisma client
RUN npx prisma generate

EXPOSE 5000

CMD ["sh", "-c", "npx prisma migrate deploy && node src/server.js"]
