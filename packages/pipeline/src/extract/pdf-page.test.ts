import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { extractPageTokens } from './pdf-page.ts';

// ---- 小さな合成PDFでpdf.js経路を検証（実PDF・network不要） -----------------------------------

function tinyPdf(): Buffer {
  const content = 'BT /F1 10 Tf 50 700 Td (01-95) Tj 100 0 Td (ABC) Tj ET';
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map(o => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

describe('extractPageTokens（合成PDF）', () => {
  const file = path.join(os.tmpdir(), `source-token-test-${process.pid}.pdf`);
  fs.writeFileSync(file, tinyPdf());

  it('指定ページのtext itemを位置付きで返す（左上原点に変換）', async () => {
    const r = await extractPageTokens(file, 1);
    expect(r.page).toMatchObject({ number: 1, numPages: 1, width: 612, height: 792, rotate: 0 });
    const t = r.tokens.find(x => x.rawText === '01-95')!;
    expect(t.bbox.xMin).toBe(50);
    const baselineTop = 792 - 700;
    expect(t.bbox.yMin).toBeLessThan(baselineTop);
    expect(t.bbox.yMax).toBeGreaterThan(baselineTop);
    expect(r.tokens.find(x => x.rawText === 'ABC')!.bbox.xMin).toBeGreaterThan(t.bbox.xMax); // x位置の差が保持される
    expect(r.timingMs.open).toBeGreaterThanOrEqual(0);
  });

  it('範囲外のpageは例外', async () => {
    await expect(extractPageTokens(file, 2)).rejects.toThrow(/pageは1〜1/);
    await expect(extractPageTokens(file, 0)).rejects.toThrow(/pageは1〜1/);
  });

  it('存在しないPDFは例外', async () => {
    await expect(extractPageTokens(path.join(os.tmpdir(), 'no-such-file.pdf'), 1)).rejects.toThrow();
  });

  it('後始末', () => fs.rmSync(file, { force: true }));
});
