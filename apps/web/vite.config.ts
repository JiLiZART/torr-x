import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const server = process.env.TORRENTX_SERVER ?? "http://127.0.0.1:9977";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    proxy: {
      "/api": {
        target: server,
        changeOrigin: true,
        // The server rejects writes whose Origin differs from its own host;
        // the dev origin (localhost:1420) would trip that check.
        configure: (proxy) => {
          proxy.on("proxyReq", (req) => req.removeHeader("origin"));
        },
      },
    },
  },
});
