module.exports = {
  plugins: [
    require('@tailwindcss/postcss'),
    require('@csstools/postcss-cascade-layers'),
    // test plugin to verify postcss.config.js is read
    {
      postcssPlugin: 'test-marker',
      Once(root) {
        root.prepend('/* postcss-config-loaded */');
      }
    }
  ],
};
