import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  // GitHub Pages などの下位パスに置けるよう、相対パスで出す
  base: './',
});
