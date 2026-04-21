# Stage 1: Build React app
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Serve with nginx (static only — FE calls BE directly via window.BACKEND_URL)
FROM nginx:alpine AS runner
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 3000
# Inject BACKEND_URL into /config.js at startup so browser JS can call BE directly.
# Team BE sets: BACKEND_URL=http://their-be-host:port (must be publicly accessible)
ENV BACKEND_URL=http://chat-backend:3001
CMD ["/bin/sh", "-c", "printf 'window.BACKEND_URL=\"%s\";' \"$BACKEND_URL\" > /usr/share/nginx/html/config.js && nginx -g 'daemon off;'"]
