// Какой это сайт: основной (ветка main) или тестовый (ветка dev, адрес …/svoya-igra/dev/).
// Тестовый собирается командой `npm run build:dev` (режим Vite «devsite»).
//
// Оба сайта живут на одном адресе salampopalamm.github.io, а значит, у них общее хранилище браузера.
// Чтобы тесты не трогали настоящие игры, у тестового сайта всё своё: база игр, сохранения партии,
// черновик мастера и канал связи пульта с залом. Перенести игру между сайтами — файлом .zip.
export const IS_DEV_SITE = import.meta.env.MODE === 'devsite'

// Версия сайта: «27.11 · 96da391» — дата и номер последнего коммита, подставляются при сборке (vite.config.ts).
// Видна в метке «DEV», чтобы в отчёте о проверке было понятно, какую версию проверяли. Нет данных — пусто.
declare const __BUILD_COMMIT__: string
declare const __BUILD_DATE__: string
export function buildVersion(commit: string, date: string): string {
  const [, month, day] = /^\d{4}-(\d{2})-(\d{2})$/.exec(date) ?? []
  return [day && month ? `${day}.${month}` : '', commit].filter(Boolean).join(' · ')
}
export const BUILD_VERSION = buildVersion(
  typeof __BUILD_COMMIT__ === 'string' ? __BUILD_COMMIT__ : '',
  typeof __BUILD_DATE__ === 'string' ? __BUILD_DATE__ : '',
)

// Начало всех имён в хранилище. У основного сайта — как было всегда, чтобы игры не потерялись.
export const APP_KEY = IS_DEV_SITE ? 'svoya-igra-dev' : 'svoya-igra'
