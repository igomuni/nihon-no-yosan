/**
 * `npm run build:data` が `public/data/` に作る gzip の JSON を読む。
 * サーバーが `Content-Encoding: gzip` を付けて返すとき（開発サーバー）は、ブラウザがすでに伸ばしている。付けないとき（GitHub Pages など）は `DecompressionStream` で伸ばす。
 */
export async function loadGzJson<T>(path: string): Promise<T> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/${path}`);
  if (!res.ok || !res.body) throw new Error(`${path}: ${res.status}`);
  const decoded = (res.headers.get('content-encoding') ?? '').includes('gzip');
  const text = await (decoded ? res : new Response(res.body.pipeThrough(new DecompressionStream('gzip')))).text();
  return JSON.parse(text) as T;
}
