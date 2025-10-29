const { defineConfig } = require('vite');
const { resolve } = require('path');

module.exports = defineConfig(async () => {
  const { default: vue } = await import('@vitejs/plugin-vue');

  return {
    plugins: [vue()],
    build: {
      outDir: 'dist/popup',
      emptyOutDir: false,
      lib: {
        entry: resolve(__dirname, 'src/popup/main.js'),
        name: 'PopupApp',
        formats: ['es'],
        fileName: () => 'popup.js'
      },
      cssCodeSplit: true
    }
  };
});
