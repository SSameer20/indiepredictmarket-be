FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies needed for prisma and native bindings
RUN apk add --no-cache openssl

# Copy package management files
COPY package*.json ./
COPY tsconfig.json ./

# Install all dependencies (including dev)
RUN npm ci

# Copy full source and schema
COPY src ./src
COPY prisma ./prisma

# Generate Prisma Client & Build TypeScript
RUN npx prisma generate
RUN npm run build

# --- Production Image ---
FROM node:20-alpine AS runner

WORKDIR /app

RUN apk add --no-cache openssl

COPY package*.json ./
# ONLY install production dependencies
RUN npm ci --omit=dev

# Copy generated prisma files & compiled dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src/generated/prisma ./src/generated/prisma
COPY --from=builder /app/dist ./dist

# Run migrations if you like, but usually ran directly inside CI/CD or platform command.
# CMD npx prisma migrate deploy && node dist/index.js

EXPOSE 3000

# Start server
CMD ["node", "dist/index.js"]
