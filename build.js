import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

const __dirname = resolve();

async function runBuild() {
  // 1. Build Popup and Background
  console.log('Building Popup and Background...');
  await build({
    configFile: false,
    plugins: [react()],
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      rollupOptions: {
        input: {
          popup: resolve(__dirname, 'index.html'),
          background: resolve(__dirname, 'src/background/background.js'),
        },
        output: {
          entryFileNames: '[name].js',
          chunkFileNames: '[name].js',
          assetFileNames: '[name].[ext]'
        }
      }
    }
  });

  // 2. Build Content Script (with inlined imports)
  console.log('Building Content Script...');
  await build({
    configFile: false,
    plugins: [react()],
    build: {
      outDir: 'dist',
      emptyOutDir: false,
      rollupOptions: {
        input: {
          contentScript: resolve(__dirname, 'src/content/contentScript.jsx'),
        },
        output: {
          inlineDynamicImports: true,
          entryFileNames: '[name].js',
          chunkFileNames: '[name].js',
          assetFileNames: '[name].[ext]'
        }
      }
    }
  });
  console.log('Build completed successfully!');
}

runBuild().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
