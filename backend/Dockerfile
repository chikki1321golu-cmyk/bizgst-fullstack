FROM node:20-slim

WORKDIR /app

# Install dependencies first (layer cache)
COPY package*.json ./
RUN npm install

# Copy source
COPY . .

# Generate Prisma client
RUN npx prisma generate

EXPOSE 5000

CMD ["npm", "start"]
