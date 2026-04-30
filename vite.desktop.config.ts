import { defineConfig } from "vite";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    outDir: "desktop-web-dist",
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      input: {
        desktopShell: resolve(__dirname, "desktop-shell.html"),
      },
    },
  },
});