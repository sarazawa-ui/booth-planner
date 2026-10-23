import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 相対パス出力。ビルド結果をフォルダごと配布しても動くようにするため。
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { port: 5186, strictPort: true },
});
