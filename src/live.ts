import type { Game } from './types'

// «Живое» состояние игры, которое пульт передаёт экрану зала.
// Предпросмотр и история отмен сюда НЕ входят — они существуют только на пульте.

export type Current = { categoryId: string; questionId: string } | null

export type LiveState = {
  game: Game
  current: Current // открытый вопрос (null — табло)
  showAnswer: boolean // показан ли ответ в зале
  answeringTeamId: string | null // какая команда сейчас отвечает (подсветка)
  screenHidden: boolean // экран зала скрыт заставкой
}

export type Message = { type: 'state'; state: LiveState } | { type: 'hello' }

// Канал связи между окнами одного браузера
export const CHANNEL = 'svoya-igra'

const STORAGE_KEY = 'svoya-igra:live'

// Сохранение на случай, если вкладку пульта случайно закрыли
export function loadState(): Partial<LiveState> | null {
  try {
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
