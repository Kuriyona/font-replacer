import { defineConfig } from "vite-plus";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  build: {
    target: "chrome120",
    rollupOptions: { input: { popup: "popup.html", options: "options.html" } },
  },
  fmt: { ignorePatterns: ["dist/**"] },
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
});
