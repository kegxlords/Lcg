import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));

const htmlPages = [
  'index',
  'register',
  'forgot',
  'admin/index',
  'app/dashboard',
  'app/deposit',
  'app/investments',
  'app/leaderboard',
  'app/products',
  'app/profile',
  'app/special-vip',
  'app/support',
  'app/team',
  'app/wallet',
  'app/wheel',
  'app/withdraw'
];

export default defineConfig({
  build: {
    target: 'esnext',
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: Object.fromEntries(
        htmlPages.map((page) => [
          page.replaceAll('/', '-'),
          fileURLToPath(new URL(`./${page}.html`, import.meta.url))
        ])
      )
    }
  },
  resolve: {
    alias: {
      '@': root
    }
  }
});
