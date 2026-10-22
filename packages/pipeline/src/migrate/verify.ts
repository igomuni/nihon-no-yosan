/**
 * 基準データのディレクトリを、manifest と照合する。仕様: docs/guides/data.md
 *
 * 使い方: node packages/pipeline/src/migrate/verify.ts <基準データのディレクトリ> <manifest>
 * - manifest の files の全件が、ディレクトリにあり、SHA-256 とバイト数が一致する。
 * - ディレクトリに、manifest に無いファイルが無い（ディレクトリ直下の manifest.json を除く）。
 * - 違いがあれば、一覧を出して終了コード 1。
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

const [dir, manifestPath] = process.argv.slice(2);
if (!dir || !manifestPath) throw new Error('usage: verify.ts <dir> <manifest>');

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as { files: Record<string, { sha256: string; bytes: number }> };
const listFiles = (root: string, rel = ''): string[] =>
  fs.readdirSync(path.join(root, rel), { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? listFiles(root, path.join(rel, e.name)) : [path.join(rel, e.name)],
  );

const problems: string[] = [];
for (const [rel, e] of Object.entries(manifest.files)) {
  const p = path.join(dir, rel);
  if (!fs.existsSync(p)) {
    problems.push(`無い: ${rel}`);
    continue;
  }
  const b = fs.readFileSync(p);
  if (b.length !== e.bytes) problems.push(`バイト数が違う: ${rel}`);
  else if (createHash('sha256').update(b).digest('hex') !== e.sha256) problems.push(`SHA-256 が違う: ${rel}`);
}
for (const rel of listFiles(dir)) if (rel !== 'manifest.json' && !manifest.files[rel]) problems.push(`manifest に無い: ${rel}`);
if (fs.existsSync(path.join(dir, 'manifest.json')) && !fs.readFileSync(path.join(dir, 'manifest.json')).equals(fs.readFileSync(manifestPath))) {
  problems.push('ディレクトリの manifest.json が、渡した manifest と違う');
}

if (problems.length > 0) {
  console.error(problems.slice(0, 50).join('\n'));
  console.error(`${problems.length} 件の違い`);
  process.exit(1);
}
console.log(`OK: ${Object.keys(manifest.files).length} files`);
