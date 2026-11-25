import { APP_KEY } from './site'
import type { LogEntry } from './log'
import type { BranchState } from './tree'
import type { Game, HallSizes, MediaRef, PlaceTarget, Placement } from './types'

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
  viewOnly?: boolean // открыт уже сыгранный вопрос — только показать: счёт и ход не меняются
  screenHidden: boolean // экран зала скрыт заставкой
  hallMouse?: boolean // управлять мышью прямо на экране зала (ячейки, панель внизу); пусто — включено, false — ведущий выключил
  resizeHall?: boolean // режим «Растянуть в зале»: у объектов в зале рамки и уголки, их тянут мышью
  timer: TimerState | null // таймер открытого вопроса (null — у вопроса нет таймера)
  video: VideoState | null // видео в зале, которым управляет ведущий (null — ни одно не запускали)
  final?: FinalState | null // ход финального раунда (функции — в final.ts); в старых сохранениях его нет
  rehearsal?: boolean // идёт репетиция: в зале метка, а после неё партия вернётся как была
  branch?: BranchState | null // открыт ветвящийся вопрос: на каком он шаге (функции — в tree.ts)
  unlockedIds?: string[] // скрытые вопросы, которые уже открыли (вариантом дерева или ведущий)
  unlockedRoundIds?: string[] // скрытые раунды, которые уже открыли (правилом или ведущий)
  rulesDone?: string[] // правила, которые ведущий уже выполнил или пропустил — больше не предлагаем
  shownMedia?: MediaRef | null // картинка или видео во весь экран зала (действие правила)
  log?: LogEntry[] // журнал партии: кто, за что и сколько получил (log.ts)
  marks?: Record<string, boolean> // вопрос «для всех команд»: кто ответил верно / неверно (отмечает ведущий; нет отметки — не ответили)
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
  | { type: 'hall-action'; action: HallAction } // зал → пульт: ведущий нажал мышью на экране зала
  | { type: 'host'; instance: string; reply?: boolean } // пульт → пультам: «я открыт» (два пульта сразу — предупреждение)
  | { type: 'host-bye'; instance: string } // пульт закрылся

// Включена ли «Мышь в зале» (по умолчанию — да: мышь в руке у ведущего, а не у зрителей)
export function hallMouseOn(s: Pick<LiveState, 'hallMouse'>): boolean {
  return s.hallMouse !== false
}

// Что ведущий может сделать мышью прямо на экране зала (если на пульте включено «Мышь в зале»).
// Зал только просит — решает и меняет игру пульт, как будто ведущий нажал у себя.
export type HallAction =
  | { kind: 'open'; categoryId: string; questionId: string } // открыть ячейку табло
  | { kind: 'slide'; delta: number } // слайд назад / вперёд
  | { kind: 'timer' } // запустить / остановить таймер
  | { kind: 'answer' } // показать ответ
  | { kind: 'team'; teamId: string } // эта команда отвечает (перехват)
  | { kind: 'correct' } // «Верно» отвечающей команде
  | { kind: 'wrong' } // «Неверно» отвечающей команде
  | { kind: 'close' } // закрыть вопрос, вернуться к табло
  // Режим «Растянуть в зале» (работает и без «Мыши в зале»):
  | { kind: 'size'; id: keyof HallSizes; value: number } // ведущий растянул текст, картинки или таймер — новый размер, %
  | { kind: 'item-size'; key: string; value: number } // растянул отдельную ячейку, категорию, команду или шапку
  | { kind: 'place'; questionId: string; target: PlaceTarget; place: Placement } // передвинул объект слайда со своей расстановкой
  | { kind: 'resize-done' } // «Готово» — выключить режим

// Канал связи между окнами одного браузера
export const CHANNEL = APP_KEY

// Ход партии хранится отдельно для каждой игры: открыли на пульте другую игру — счёт первой не пропадает.
// v3 — партия у каждой игры своя (в v2 была одна на весь браузер)
const STATE_PREFIX = `${APP_KEY}:live:v3:`
const OLD_STATE_KEY = `${APP_KEY}:live:v2`
const REHEARSAL_PREFIX = `${APP_KEY}:rehearsal:v2:`
const OLD_REHEARSAL_KEY = `${APP_KEY}:rehearsal`

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

// Записать; если место в хранилище кончилось — убрать сохранённые партии других игр и попробовать ещё раз
function writeJson(key: string, value: unknown) {
  const gameId = key.slice(key.lastIndexOf(':') + 1) // партии этой же игры (и её репетицию) не трогаем
  const text = JSON.stringify(value)
  try {
    localStorage.setItem(key, text)
  } catch {
    try {
      for (const other of Object.keys(localStorage)) {
        const partOfOther = other.startsWith(STATE_PREFIX) || other.startsWith(REHEARSAL_PREFIX)
        if (partOfOther && !other.endsWith(':' + gameId)) localStorage.removeItem(other)
      }
      localStorage.setItem(key, text)
    } catch {
      // хранилище недоступно — игра продолжится без сохранения
    }
  }
}

function remove(key: string) {
  try {
    localStorage.removeItem(key)
  } catch {
    // ничего страшного
  }
}

// Старое сохранение (одно на весь браузер) переезжает к своей игре
function moveOld(oldKey: string, prefix: string) {
  const old = readJson<Partial<LiveState>>(oldKey)
  if (old?.game?.id && !readJson(prefix + old.game.id)) writeJson(prefix + old.game.id, old)
  remove(oldKey)
}

// Сохранённая партия этой игры (на случай, если вкладку пульта случайно закрыли)
export function loadState(gameId: string): Partial<LiveState> | null {
  remove('svoya-igra:live') // сохранение самого старого вида больше не нужно
  moveOld(OLD_STATE_KEY, STATE_PREFIX)
  const saved = readJson<Partial<LiveState>>(STATE_PREFIX + gameId)
  return saved?.game?.id === gameId ? saved : null
}

export function saveState(state: LiveState) {
  writeJson(STATE_PREFIX + state.game.id, state)
}

export function clearState(gameId: string) {
  remove(STATE_PREFIX + gameId)
}

// Начата ли у игры партия (для пометки в «Моих играх»)
export function hasSavedState(gameId: string): boolean {
  moveOld(OLD_STATE_KEY, STATE_PREFIX)
  const saved = readJson<Partial<LiveState>>(STATE_PREFIX + gameId)
  return !!saved?.game?.teams?.some((t) => t.score !== 0) || !!saved?.game?.rounds?.some((r) => r.categories.some((c) => c.questions.some((q) => q.played)))
}

// Репетиция: партия, какой она была до репетиции. Лежит отдельно — на случай перезагрузки пульта посреди репетиции.
export function saveRehearsal(state: LiveState) {
  writeJson(REHEARSAL_PREFIX + state.game.id, state)
}

export function loadRehearsal(gameId: string): LiveState | null {
  moveOld(OLD_REHEARSAL_KEY, REHEARSAL_PREFIX)
  const saved = readJson<LiveState>(REHEARSAL_PREFIX + gameId)
  return saved?.game?.id === gameId ? saved : null
}

export function clearRehearsal(gameId: string) {
  remove(REHEARSAL_PREFIX + gameId)
}

// Пульт сломался на открытом вопросе: закрыть его в сохранённой партии (счёт и сыгранные ячейки остаются)
export function closeSavedQuestion(gameId: string) {
  const saved = readJson<Partial<LiveState>>(STATE_PREFIX + gameId)
  if (!saved) return
  writeJson(STATE_PREFIX + gameId, {
    ...saved,
    current: null,
    slideIndex: 0,
    showAnswer: false,
    answeringTeamId: null,
    triedTeamIds: [],
    viewOnly: false,
    timer: null,
    video: null,
    branch: null,
    shownMedia: null,
    resizeHall: false,
  } satisfies Partial<LiveState>)
}
