# syntax=docker/dockerfile:1
FROM node:20-alpine AS base
WORKDIR /app

# Dependencias (se cachean mientras no cambie package*.json)
COPY package*.json ./
RUN npm ci

# Prisma necesita el schema presente antes de generar el client
COPY prisma ./prisma
RUN npx prisma generate

# Resto del código fuente
COPY . .

# Compilar TypeScript -> dist (ajustar si el proyecto usa otro build step)
RUN npm run build

ENV NODE_ENV=production
EXPOSE 4000

# En el contenedor `migrate` este CMD se sobreescribe con
# ["npx", "prisma", "migrate", "deploy"] desde docker-compose.yml
CMD ["node", "dist/index.js"]
