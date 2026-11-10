/**
 * [INPUT]: 依赖 germina/ 目录内容与 .gitignore 的运行时排除约定；Node fs
 * [OUTPUT]: package() —— 产出 dist/dsh-germina-v{version}.zip 与 sha256 校验文件
 * [POS]: scripts 的发布入口；按 germina/README 的安装边界打包：含 vendor 产物与文档，排除运行时状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { createWriteStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "dist");
const version = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8")).version;
const zipName = `dsh-germina-v${version}.zip`;
const zipPath = path.join(OUT_DIR, zipName);

if (!existsSync(path.join(ROOT, "germina", "vendor", "client-ui.js"))) {
  console.error("vendor 产物缺失：先运行 node scripts/build-client.mjs");
  process.exit(1);
}

// 打包内容 = git 里 germina/ 的已提交文件（天然排除运行时状态与临时文件）
const files = execFileSync("git", ["ls-files", "germina"], { encoding: "utf8", cwd: ROOT })
  .split("\n")
  .filter(Boolean);

mkdirSync(OUT_DIR, { recursive: true });
if (existsSync(zipPath)) execFileSync("rm", ["-f", zipPath]);

// 用 git archive 语义等价的稳定 zip：逐文件写入（避免依赖系统 zip 的元数据差异）
const { execFileSync: run } = { execFileSync };
// macOS/Linux 均可用 python3 标准库写 zip，保证确定性顺序
const py = `
import json, sys, zipfile, os
files = json.load(sys.stdin)
base = sys.argv[1]
out = sys.argv[2]
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    for rel in files:
        p = os.path.join(base, rel)
        z.write(p, arcname=os.path.join("dsh-germina", rel))
print("files:", len(files))
`;
run("python3", ["-c", py, ROOT, zipPath], { input: JSON.stringify(files), stdio: ["pipe", "pipe", "inherit"] });

const sha = createHash("sha256").update(readFileSync(zipPath)).digest("hex");
writeFileSync(`${zipPath}.sha256`, `${sha}  ${zipName}\n`);

const size = statSync(zipPath).size;
console.log(`打包完成：dist/${zipName}（${(size / 1024).toFixed(0)} KB，${files.length} 个文件）`);
console.log(`SHA-256: ${sha}`);
