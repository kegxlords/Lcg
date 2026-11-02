import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  // The page modules use top-level await for the Supabase session checks.
  build: {
    target: 'esnext',
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        login: fileURLToPath(new URL('./index.html', import.meta.url)),
        register: fileURLToPath(new URL('./register.html', import.meta.url)),
        forgot: fileURLToPath(new URL('./forgot.html', import.meta.url)),
        dashboard: fileURLToPath(new URL('./app/dashboard.html', import.meta.url)),
        deposit: fileURLToPath(new URL('./app/deposit.html', import.meta.url)),
        wallet: fileURLToPath(new URL('./app/wallet.html', import.meta.url)),
        withdraw: fileURLToPath(new URL('./app/withdraw.html', import.meta.url))
      }
    }
  },
  resolve: {
    alias: {
      '@': root
    }
  }
});
