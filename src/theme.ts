import type { CSSProperties } from 'react'
import type { HallSizes, Theme } from './types'

// Оформление экрана зала: тон фона, шрифт заголовков, фирменный акцент.
// Всё задаётся CSS-переменными на корне экрана — классы Tailwind (bg-bg, text-white, bg-accent…) подхватывают их сами.

type Tone = Theme['backgroundTone']

export const TONES: { id: Tone; name: string; bg: string; cell: string; line: string }[] = [
  { id: 'graphite', name: 'графит', bg: '#26272B', cell: '#34363C', line: '#55585F' },
  { id: 'asphalt', name: 'мокрый асфальт', bg: '#2F3440', cell: '#3D4352', line: '#5E6575' },
  { id: 'warm-gray', name: 'тёплый серый', bg: '#3A3632', cell: '#4A4540', line: '#6E6760' },
  { id: 'mid-gray', name: 'средний серый', bg: '#4A4A4A', cell: '#5C5C5C', line: '#7A7A7A' },
  { id: 'light', name: 'светлый', bg: '#F2F2EF', cell: '#E2E2DE', line: '#B5B5B0' },
]

// Шрифты заголовков и номиналов (подключены в index.css). Текст вопросов всегда в Inter.
export const FONTS: { family: string; note: string }[] = [
  { family: 'Rubik Mono One', note: 'табло' },
  { family: 'Tektur', note: 'техно' },
  { family: 'Press Start 2P', note: 'пиксели, ретро' },
  { family: 'Oswald', note: 'узкий, строгий' },
  { family: 'Rubik Glitch', note: 'сломанный экран' },
  { family: 'Playfair Display', note: 'с засечками' },
  { family: 'JetBrains Mono', note: 'терминал' },
  { family: 'Jura', note: 'космос' },
]

// Размеры на экране зала: ползунки от 50 до 200%, шаг 10
export const SIZE_MIN = 50
export const SIZE_MAX = 200
export const SIZE_STEP = 10

export const SIZE_NAMES: { id: keyof HallSizes; name: string }[] = [
  { id: 'board', name: 'Табло' },
  { id: 'teams', name: 'Команды и счёт' },
  { id: 'photos', name: 'Фото игроков' },
  { id: 'media', name: 'Картинки и видео' },
  { id: 'text', name: 'Текст вопроса и ответа' },
  { id: 'timer', name: 'Таймер' },
]

export const DEFAULT_SIZES: HallSizes = { board: 100, teams: 100, photos: 100, media: 100, text: 100, timer: 100 }

// Чего в старой игре нет (её сохранили до новых ползунков) — 100%
export function hallSizes(theme: Theme): HallSizes {
  return { ...DEFAULT_SIZES, ...theme.sizes }
}

// Отдельный объект зала (ячейка, категория, команда): его CSS-переменная и множитель (нет переменной — 1)
export function itemVar(key: string): string {
  return `--i-${key.replace(/[^a-zA-Z0-9_-]/g, '_')}`
}

export function itemScale(key: string): string {
  return `var(${itemVar(key)}, 1)`
}

// Ширина отдельного объекта в строке (табло, полоса команд): растянули — и доля ширины больше
export function itemGrow(key: string, base = 1): CSSProperties {
  return { flexGrow: `calc(${base} * ${itemScale(key)})`, flexShrink: 1, flexBasis: '0%', minWidth: 0 }
}

// Размер в допустимых пределах (растягивание мышью может дать что угодно)
export function clampSize(value: number): number {
  return Math.min(SIZE_MAX, Math.max(SIZE_MIN, Math.round(value / SIZE_STEP) * SIZE_STEP))
}

// Готовые фирменные цвета для быстрого выбора
export const ACCENT_PRESETS = ['#E53935', '#FB8C00', '#FDD835', '#43A047', '#00ACC1', '#1E88E5', '#8E24AA', '#D81B60']

// Тёмный или светлый текст лучше читается на этом цвете
function textOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#111111' : '#FFFFFF'
}

export function toneOf(theme: Theme) {
  return TONES.find((t) => t.id === theme.backgroundTone) ?? TONES[0]
}

// Фоновая картинка под полупрозрачным тоном фона — чтобы текст на ней читался
export function backgroundWithImage(theme: Theme, imageUrl: string): string {
  const n = parseInt(toneOf(theme).bg.slice(1), 16)
  const rgba = `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, 0.8)`
  return `linear-gradient(${rgba}, ${rgba}), url("${imageUrl}") center / cover no-repeat`
}

// CSS-переменные экрана зала
export function hallThemeStyle(theme: Theme): CSSProperties {
  const tone = toneOf(theme)
  const light = tone.id === 'light'
  const ink = light ? '#111111' : '#FFFFFF' // основной текст и рамки
  const paper = light ? '#FFFFFF' : '#000000' // текст на инверсной плашке
  const accent = theme.accentColor || ink // без фирменного цвета акцент — инверсия
  const font = FONTS.some((f) => f.family === theme.headingFont) ? theme.headingFont : FONTS[0].family
  const sizes = hallSizes(theme)
  return {
    // Размеры (множители): табло и команды увеличиваются целиком (CSS zoom), фото и картинки — по высоте
    '--board-scale': sizes.board / 100,
    '--teams-scale': sizes.teams / 100,
    '--photos-scale': sizes.photos / 100,
    '--media-scale': sizes.media / 100,
    '--text-scale': sizes.text / 100,
    '--timer-scale': sizes.timer / 100,
    ...Object.fromEntries(Object.entries(theme.itemSizes ?? {}).map(([key, value]) => [itemVar(key), value / 100])),
    '--color-bg': tone.bg,
    '--color-cell': tone.cell,
    '--color-line': tone.line,
    '--color-muted': light ? '#55565B' : '#C4C6CC',
    '--color-white': ink,
    '--color-black': paper,
    '--color-accent': accent,
    '--color-on-accent': theme.accentColor ? textOn(theme.accentColor) : paper,
    '--font-display': `"${font}", sans-serif`,
    color: ink,
  } as CSSProperties
}
