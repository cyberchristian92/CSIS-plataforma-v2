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
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ""),
      },
    },
  },
});
