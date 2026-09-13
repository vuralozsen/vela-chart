# Vela Chart — kendi kendine yeten üretim imajı
# (volume-mount yerine kod imaja gömülür: dokploy "0 mounts" durumunda bile tam çalışır)
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY server.mjs ./
COPY public ./public
EXPOSE 3010
CMD ["node", "server.mjs"]
