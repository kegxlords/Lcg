import { copyFile, mkdir } from 'node:fs/promises';
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

const copyLegacyRenderer = {
  name: 'copy-legacy-renderer',
  apply: 'build',
  async closeBundle() {
    const outputDir = fileURLToPath(new URL('./dist/assets/js/', import.meta.url));
    await mkdir(outputDir, { recursive: true });
    await copyFile(
      fileURLToPath(new URL('./assets/js/app.js', import.meta.url)),
      `${outputDir}app.js`
    );
  }
};

export default {
  plugins: [copyLegacyRenderer],
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
};
