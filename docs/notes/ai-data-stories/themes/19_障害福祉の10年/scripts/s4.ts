import { readFileSync } from 'node:fs';
const s = JSON.parse(readFileSync('s3.json', 'utf8'));
const Y = [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027];
const t = (x: number | null) => x === null || x === undefined ? '  -  ' : (x / 1e9).toFixed(3);
for (const f of ['req', 'rev', 'cur', 'spent', 'unused', 'carried']) { console.log('==', f); for (const [k, r] of Object.entries<any>(s.mk)) console.log(k.padEnd(18), Y.map(y => t(r[y]?.[f] ?? null)).join(' ')); }
