import adapter from '@sveltejs/adapter-static'; // Mude de 'auto' para 'static'

export default {
  kit: {
    adapter: adapter({
      fallback: 'index.html' // Essencial para Single Page Apps
    }),
    prerender: { entries: [] } 
  }
};