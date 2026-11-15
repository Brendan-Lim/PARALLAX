import { defineConfig } from 'vitest/config';
export default defineConfig({
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    fs: { strict: true, allow: [process.cwd()] },
  },
  build: {
    sourcemap: false,
    minify: 'terser',
    cssMinify: 'lightningcss',
    terserOptions: { compress: { passes: 2 }, format: { comments: false } },
  },
  test: { include: ['tests/**/*.test.ts'], coverage: { include: ['src/core/**'] } },
});
