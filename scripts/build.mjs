import { build } from "vite-plus";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const watch = process.argv.includes("--watch");
const alias = { "@": path.join(root, "src") };

const watchConfig = watch ? { watch: {} } : {};
const watchWarn = (label, err) => {
  console.error(`[${label}] 构建失败：`, err);
  if (!watch) process.exitCode = 1;
};

// 1. popup / options（读取根目录 vite.config.ts，会清空 dist 并拷贝 public/）
await build({ root, ...(watch ? { build: watchConfig } : {}) }).catch((err) => {
  watchWarn("ui", err);
  throw err;
});

// 2. 内容脚本：IIFE 单文件
await build({
  root,
  configFile: false,
  publicDir: false,
  resolve: { alias },
  build: {
    ...watchConfig,
    outDir: path.join(root, "dist"),
    emptyOutDir: false,
    target: "chrome120",
    lib: {
      entry: path.join(root, "src/content/index.ts"),
      formats: ["iife"],
      name: "FontReplacerContent",
      fileName: () => "content.js",
    },
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
}).catch((err) => {
  watchWarn("content", err);
  throw err;
});

// 3. service worker：ESM
await build({
  root,
  configFile: false,
  publicDir: false,
  resolve: { alias },
  build: {
    ...watchConfig,
    outDir: path.join(root, "dist"),
    emptyOutDir: false,
    target: "chrome120",
    lib: {
      entry: path.join(root, "src/background/index.ts"),
      formats: ["es"],
      fileName: () => "background.js",
    },
  },
}).catch((err) => {
  watchWarn("background", err);
  throw err;
});

if (!existsSync(path.join(root, "dist/manifest.json"))) {
  throw new Error("构建结束但 dist/manifest.json 不存在");
}

console.log(watch ? "已启动监听构建（Ctrl+C 结束）" : "构建完成：dist/");
