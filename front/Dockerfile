# syntax=docker/dockerfile:1

# ── Etapa 1: build de la SPA con Vite ──────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

ARG VITE_API_URL=/api
ENV VITE_API_URL=${VITE_API_URL}

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build   # genera /app/dist

# ── Etapa 2: servir el build estático ──────────────────────────────
# Este nginx interno SOLO sirve archivos estáticos al nginx "edge" del
# docker-compose (que es el único con el puerto 80 publicado al host).
FROM nginx:1.27-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.spa.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
