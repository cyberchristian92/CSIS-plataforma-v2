FROM node:20-alpine

WORKDIR /app

# Instala dependências primeiro (cache de camada — só reinstala se package*.json mudar)
COPY package.json package-lock.json ./
RUN npm ci

# Copia o resto do código e builda
COPY . .
RUN npx prisma generate
RUN npm run build

EXPOSE 3000

# Ao subir o container: aplica migrations pendentes, garante o usuário ADMIN
# padrão (seed é idempotente — não faz nada se já existir gente cadastrada),
# e só então inicia a API. Assim `docker compose up` sozinho deixa tudo
# pronto, sem passo manual.
CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma db seed && node dist/src/main"]
