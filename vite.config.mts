import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// The game server (server/bootstrap.ts) hosts this app:
// - dev:   Vite runs as middleware inside the game server (HMR through the same port)
// - build: `vite build` emits the static client into client-dist/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  build: {
    outDir: "client-dist",
    target: "es2017",
    chunkSizeWarningLimit: 2500,
  },
  server: {
    // Not used for listening in dev (middleware mode), but Vite injects this
    // port into the HMR client config, so it must match the game server port.
    port: Number(process.env.PORT || 3000),
  },
});

