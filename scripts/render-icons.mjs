import { Resvg } from "@resvg/resvg-js";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const iconsDir = path.join(root, "public", "icons");
const svg = readFileSync(path.join(iconsDir, "icon.svg"), "utf8");

mkdirSync(iconsDir, { recursive: true });

for (const size of [16, 32, 48, 128]) {
  const png = new Resvg(svg, { fitTo: { mode: "width", value: size } }).render().asPng();
  const target = path.join(iconsDir, `icon-${size}.png`);
  writeFileSync(target, png);
  console.log(`已生成 ${path.relative(root, target)}`);
}
