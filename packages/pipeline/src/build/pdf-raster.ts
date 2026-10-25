/** `pdftoppm`（poppler）で頁をグレー画像にして読む（黒塗り頁・文字のない頁の一覧が使う） */
import { spawn } from 'node:child_process';

/** PGM（P5）を読む */
export function readPgm(buf: Buffer): { w: number; h: number; data: Uint8Array } {
  let pos = 0;
  const token = (): string => {
    while (/\s/.test(String.fromCharCode(buf[pos]!))) pos++;
    if (buf[pos] === 0x23) { while (buf[pos] !== 0x0a) pos++; return token(); }
    let s = '';
    while (pos < buf.length && !/\s/.test(String.fromCharCode(buf[pos]!))) s += String.fromCharCode(buf[pos++]!);
    return s;
  };
  if (token() !== 'P5') throw new Error('PGM（P5）でない');
  const w = Number(token()), h = Number(token()), max = Number(token());
  if (max !== 255) throw new Error(`PGM の最大値が 255 でない: ${max}`);
  pos++;
  return { w, h, data: new Uint8Array(buf.buffer, buf.byteOffset + pos, w * h) };
}

/** コマンドを実行して、標準出力を返す（終了コードが 0 でなければ投げる） */
export const runCapture = (cmd: string, args: string[]): Promise<Buffer> => new Promise((resolve, reject) => {
  const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'ignore'] });
  const chunks: Buffer[] = [];
  p.stdout.on('data', (d: Buffer) => chunks.push(d));
  p.on('error', reject);
  p.on('close', code => (code === 0 ? resolve(Buffer.concat(chunks)) : reject(new Error(`${cmd} が終了コード ${code}: ${args.join(' ')}`))));
});
