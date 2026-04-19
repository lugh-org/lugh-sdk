import { copyFile, access } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const src = resolve(root, "src/styles.css");
const dst = resolve(root, "dist/styles.css");

try {
  await access(src);
  await copyFile(src, dst);
  console.log(`copied ${src} -> ${dst}`);
} catch {
  console.log("no src/styles.css yet — skipping");
}
