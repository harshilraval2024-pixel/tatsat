import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/manage/",
  build: {
    outDir: "../static/admin",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      "/admin": "http://127.0.0.1:8000",
      "/estimate": "http://127.0.0.1:8000",
      "/states": "http://127.0.0.1:8000",
      "/districts": "http://127.0.0.1:8000",
      "/export-leads": "http://127.0.0.1:8000",
    },
  },
});