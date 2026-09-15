# CSIS Platform — Backend

API em NestJS + Prisma + PostgreSQL. Instruções de instalação e execução (com ou sem Docker)
estão no [README da raiz do repositório](../README.md) — este arquivo cobre só o que é
específico de trabalhar dentro desta pasta.

## Comandos úteis

```bash
npm run start:dev    # modo watch (hot-reload)
npm run build         # build de produção
npm run lint           # ESLint com --fix
npm run test            # testes unitários (Jest)
npm run test:e2e         # testes end-to-end
npm run test:cov          # cobertura de testes
```

## Prisma

```bash
npx prisma migrate dev --name <nome>   # cria e aplica uma migration a partir de mudanças no schema
npx prisma migrate deploy               # aplica migrations pendentes (usado no boot do Docker)
npx prisma db seed                       # popula o usuário admin inicial (prisma/seed.ts)
npx prisma studio                         # interface visual pra inspecionar o banco
```

> Se o backend estiver rodando em modo watch (`start:dev`) e você rodar uma migration/`npm
> install` de pacote do Prisma enquanto ele está de pé, o compilador do watch pode ficar com uma
> resolução de módulo obsoleta (`Cannot find module '@prisma/client'`, mesmo com os pacotes
> corretos em disco). Recuperação: matar o processo, rodar `npx nest build` uma vez (one-shot,
> sem watch), e então `npm run start:dev` de novo.
