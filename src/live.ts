import type { BranchState } from './tree'
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
  timer: TimerState | null // таймер открытого вопроса (null — у вопроса нет таймера)
  video: VideoState | null // видео в зале, которым управляет ведущий (null — ни одно не запускали)
  final?: FinalState | null // ход финального раунда (функции — в final.ts); в старых сохранениях его нет
  rehearsal?: boolean // идёт репетиция: в зале метка, а после неё партия вернётся как была
  branch?: BranchState | null // открыт ветвящийся вопрос: на каком он шаге (функции — в tree.ts)
}

// Финальный раунд: убирание тем → ставки → вопрос → итоги.
// Ставки и отметки «верно» есть в состоянии, но зал показывает их только на итогах.
export type FinalState = {
  roundId: string // какой раунд — финал
  phase: 'themes' | 'bets' | 'question' | 'results'
  removedIds: string[] // убранные темы (id категорий)
  bets: Record<string, number> // ставки команд (id команды → ставка)
  correct: Record<string, boolean> // кто ответил верно (отмечает ведущий)
}

// Видео в зале. Со звуком оно играет в окне зала, на пульте — его копия без звука.
// seq растёт с каждой командой ведущего: зал по нему понимает, что пора перемотать и запустить / остановить.
export type VideoState = {
  mediaId: string // какой ролик (остальные стоят)
  playing: boolean
  time: number // с какой секунды играть или где стоять
  volume: number // 0…1
  seq: number
}

// Что окно зала сообщает пульту
export type HallStatus = 'waiting-click' | 'ready' | 'closed'

// Таймер вопроса. Пока идёт — помним момент окончания (пульт и зал на одном компьютере, часы общие),
// на паузе — сколько осталось.
export type TimerState = {
  totalSec: number
  endsAt: number | null // идёт до этого момента (Date.now()); null — стоит
  leftMs: number // сколько осталось, пока таймер стоит
}

export function newTimer(totalSec: number | undefined): TimerState | null {
  return totalSec ? { totalSec, endsAt: null, leftMs: totalSec * 1000 } : null
}

// Сколько осталось, мс
export function timeLeft(timer: TimerState, now = Date.now()): number {
  return timer.endsAt === null ? timer.leftMs : Math.max(0, timer.endsAt - now)
}

export function startTimer(timer: TimerState, now = Date.now()): TimerState {
  const left = timeLeft(timer, now)
  // Время вышло — запускаем сначала
  return { ...timer, endsAt: now + (left > 0 ? left : timer.totalSec * 1000), leftMs: 0 }
}

export function pauseTimer(timer: TimerState, now = Date.now()): TimerState {
  return { ...timer, endsAt: null, leftMs: timeLeft(timer, now) }
}

// 75 000 мс → «1:15»; округляем вверх, чтобы «0:00» появлялось ровно в конце
export function formatTime(ms: number): string {
  const sec = Math.ceil(ms / 1000)
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
}

export type Message =
  | { type: 'state'; state: LiveState } // пульт → зал
  | { type: 'hello' } // зал → пульт: «пришли состояние»
  | { type: 'hall'; status: HallStatus } // зал → пульт: ждёт клика / готов (звук разрешён) / закрыт
  | { type: 'hall-media'; done: number; total: number } // зал → пульт: сколько файлов игры уже загружено

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

// Репетиция: партия, какой она была до репетиции. Лежит отдельно — на случай перезагрузки пульта посреди репетиции.
const REHEARSAL_KEY = 'svoya-igra:rehearsal'

export function saveRehearsal(state: LiveState) {
  try {
    localStorage.setItem(REHEARSAL_KEY, JSON.stringify(state))
  } catch {
    // хранилище недоступно — партию до репетиции помним только в памяти пульта
  }
}

export function loadRehearsal(): LiveState | null {
  try {
    const raw = localStorage.getItem(REHEARSAL_KEY)
    return raw ? (JSON.parse(raw) as LiveState) : null
  } catch {
    return null
  }
}

export function clearRehearsal() {
  try {
    localStorage.removeItem(REHEARSAL_KEY)
  } catch {
    // ничего страшного
  }
}

export function clearState() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ничего страшного
  }
}
