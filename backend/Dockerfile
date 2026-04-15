# Stage 1: Build Hono/Node.js backend
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY src ./src
COPY tsconfig.json ./
RUN npm run build
# CSV data files must live alongside compiled JS (csv-data-loader uses __dirname)
RUN cp src/mock/*.csv dist/mock/

# Stage 2: Production — only dist + prod deps
FROM node:20-alpine AS runner
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
EXPOSE 3001
CMD ["node", "dist/index.js"]
