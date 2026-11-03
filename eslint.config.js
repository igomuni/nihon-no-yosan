import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // docs/notes/**/scripts は、作業メモに添えた一回限りの分析スクリプト（型を付けず、検査しない）
  { ignores: ['**/node_modules/**', '**/dist/**', 'data/**', 'docs/notes/**/scripts/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { files: ['apps/web/**/*.{ts,tsx}'], ...reactHooks.configs.flat.recommended },
);
