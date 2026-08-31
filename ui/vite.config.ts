import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // Backend (server/index.ts) runs on port 3000. Proxying /api here means
      // the UI can call relative "/api/chat" in both dev and the eventual
      // single-container production setup (ticket #10), no env-specific base
      // URL needed in application code.
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
