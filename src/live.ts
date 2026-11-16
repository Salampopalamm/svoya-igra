import type { Game } from './types'

// «Живое» состояние игры, которое пульт передаёт экрану зала.
// Предпросмотр и история отмен сюда НЕ входят — они существуют только на пульте.

export type Current = { categoryId: string; questionId: string } | null

export type LiveState = {
  game: Game
  roundId: string | null // какой раунд сейчас на табло (null — первый)
  current: Current // открытый вопрос (null — табло)
  slideIndex: number // какой слайд открытого вопроса сейчас в зале (с нуля)
  showAnswer: boolean // показан ли ответ в зале
  answeringTeamId: string | null // какая команда сейчас отвечает (подсветка)
  turnTeamId: string | null // чей ход: команда выбирает ячейку и отвечает первой; после вопроса ход идёт по кругу
  triedTeamIds: string[] // кто уже ошибся на открытом вопросе — им перехватывать нельзя
  screenHidden: boolean // экран зала скрыт заставкой
}

export type Message = { type: 'state'; state: LiveState } | { type: 'hello' }

// Канал связи между окнами одного браузера
export const CHANNEL = 'svoya-igra'

// v2 — вопросы из слайдов; сохранения старого вида просто не читаем
const STORAGE_KEY = 'svoya-igra:live:v2'

// Сохранение на случай, если вкладку пульта случайно закрыли
export function loadState(): Partial<LiveState> | null {
  try {
    localStorage.removeItem('svoya-igra:live') // сохранение старого вида больше не нужно
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Partial<LiveState>) : null
  } catch {
    return null
  }
}

export function saveState(state: LiveState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // хранилище недоступно — игра продолжится без сохранения
  }
}

export function clearState() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ничего страшного
  }
}
