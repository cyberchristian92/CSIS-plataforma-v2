import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    // 5173 colide com o container Docker "sinarca_frontend" (outro projeto
    // deste mesmo ambiente) — 5174 evita a ambiguidade de resolução de
    // "localhost" entre IPv4/IPv6 quando as duas portas ficam ocupadas.
    port: 5174,
    strictPort: true,
    // Dentro do Docker Compose (serviço "web") a porta do container precisa
    // aceitar conexões de fora dele, e o arquivo muda no host — o evento de
    // arquivo nem sempre atravessa o volume (Windows/WSL), daí o polling.
    host: process.env.VITE_HOST ?? "localhost",
    watch: process.env.VITE_POLLING === "true" ? { usePolling: true } : undefined,
    proxy: {
      "/api": {
        // No Compose o backend é "backend:3000"; rodando o Vite direto na
        // máquina, localhost:3000.
        target: process.env.API_PROXY_TARGET ?? "http://localhost:3000",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ""),
      },
    },
  },
});
