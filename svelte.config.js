import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter({
      fallback: 'index.html', // Essencial para o Tauri
      pages: 'build',
      assets: 'build',
      precompress: false,
      strict: false // Isso ajuda a ignorar erros de links quebrados durante o build
    }),
    prerender: {
      entries: ['*'], // Garante que ele tente renderizar tudo o que encontrar
      handleHttpError: 'warn', // Transforma erro em apenas um aviso
      handleUnseenRoutes: 'warn' // Resolve especificamente o erro que deu no seu log
    }
  }
};

export default config;