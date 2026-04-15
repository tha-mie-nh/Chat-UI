# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Optional: bake env vars at build time via ARG
ARG VITE_API_BASE_URL=https://api.openai.com
ARG VITE_API_MODEL=gpt-4o
ARG VITE_API_KEY=""

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_API_MODEL=$VITE_API_MODEL
ENV VITE_API_KEY=$VITE_API_KEY

RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:alpine AS runner
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
