import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Пути к файлам сайта — относительные: так сайт работает и в корне (localhost), и в папке
  // на GitHub Pages (salampopalamm.github.io/svoya-igra/). Экраны переключаются через # в адресе.
  base: './',
})
