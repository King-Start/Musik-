# Auralys — image produksi
FROM node:20-alpine

WORKDIR /app

# hanya manifest dulu agar layer cache efisien
COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://127.0.0.1:8080/api/health || exit 1

CMD ["node", "server.mjs"]
