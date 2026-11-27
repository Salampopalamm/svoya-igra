import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { execSync } from 'node:child_process'
import { defineConfig } from 'vite'

// Версия сайта для метки «DEV»: дата и короткий номер последнего коммита (по ним видно, какую версию проверяли).
// Нет git (сборка не из папки проекта) — пусто, метка просто без версии.
function gitVersion(): { commit: string; date: string } {
  try {
    const run = (cmd: string) => execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
    return { commit: run('git rev-parse --short HEAD'), date: run('git log -1 --format=%cs') }
  } catch {
    return { commit: '', date: '' }
  }
}
const version = gitVersion()

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Пути к файлам сайта — относительные: так сайт работает и в корне (localhost), и в папке
  // на GitHub Pages (salampopalamm.github.io/svoya-igra/). Экраны переключаются через # в адресе.
  base: './',
  // Подставляется в код при сборке (src/site.ts → BUILD_VERSION)
  define: {
    __BUILD_COMMIT__: JSON.stringify(version.commit),
    __BUILD_DATE__: JSON.stringify(version.date),
  },
})
