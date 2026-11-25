import type { Game, Team } from './types'

// Журнал партии: каждое изменение счёта и его причина — кто, за какой вопрос, сколько.
// Пишут его функции play.ts, хранится в LiveState.log (поэтому Ctrl+Z и репетиция откатывают и журнал).
// Нужен, чтобы ответить на спор «почему у нас −300?», посчитать итоги и выгрузить результаты в Excel.

export type LogKind =
  | 'correct' // верный ответ
  | 'wrong' // неверный ответ
  | 'nobody' // вопрос закрыли, никто не ответил верно
  | 'branch' // вариант ветвящегося вопроса
  | 'final' // итог финала по ставке
  | 'manual' // ведущий поправил счёт сам
  | 'rule' // баллы по правилу «ЕСЛИ → ТО»

export type LogEntry = {
  at: number // когда, Date.now()
  kind: LogKind
  teamId?: string // у «никто не ответил» команды нет
  points: number // сколько прибавили (минус — отняли)
  questionId?: string
  where?: string // «География · 300» — запоминаем сразу: вопрос потом могут переименовать или удалить
  note?: string // подробность: вариант ветки, «вписан счёт 500»
}

export const LOG_LIMIT = 2000 // больше записей за партию не бывает; ограничение — чтобы не переполнить хранилище

export function withLog<S extends { log?: LogEntry[] }>(s: S, ...entries: Omit<LogEntry, 'at'>[]): S {
  const at = Date.now()
  return { ...s, log: [...(s.log ?? []), ...entries.map((e) => ({ at, ...e }))].slice(-LOG_LIMIT) }
}

export const KIND_NAMES: Record<LogKind, string> = {
  correct: 'Верно',
  wrong: 'Неверно',
  nobody: 'Никто не ответил',
  branch: 'Ветка',
  final: 'Финал',
  manual: 'Поправка ведущего',
  rule: 'По правилу',
}

// Итоги команды по журналу
export type TeamStats = {
  team: Team
  correct: number // верных ответов
  wrong: number // неверных
  fromQuestions: number // баллов за вопросы (верно, неверно, ветки, финал, правила)
  manual: number // поправки ведущего
  bestStreak: number // самая длинная серия верных ответов подряд
}

export function teamStats(game: Game, log: LogEntry[] = []): TeamStats[] {
  return game.teams.map((team) => {
    const own = log.filter((e) => e.teamId === team.id)
    let streak = 0
    let bestStreak = 0
    for (const e of own) {
      if (e.kind === 'correct') bestStreak = Math.max(bestStreak, ++streak)
      if (e.kind === 'wrong') streak = 0
    }
    return {
      team,
      correct: own.filter((e) => e.kind === 'correct').length,
      wrong: own.filter((e) => e.kind === 'wrong').length,
      fromQuestions: own.filter((e) => e.kind !== 'manual').reduce((sum, e) => sum + e.points, 0),
      manual: own.filter((e) => e.kind === 'manual').reduce((sum, e) => sum + e.points, 0),
      bestStreak,
    }
  })
}

// Сколько раз подряд команда ошиблась последними (верный ответ обнуляет счётчик)
export function wrongStreak(log: LogEntry[] = [], teamId: string): number {
  let count = 0
  for (let i = log.length - 1; i >= 0; i--) {
    const e = log[i]
    if (e.teamId !== teamId) continue
    if (e.kind === 'wrong') count++
    else if (e.kind === 'correct') break
  }
  return count
}

// 20:41
export function formatClock(at: number): string {
  const d = new Date(at)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// Журнал для Excel: CSV с точкой с запятой (так его понимает русский Excel) и меткой UTF-8 в начале
export function logToCsv(game: Game, log: LogEntry[] = []): string {
  const teamName = (id?: string) => game.teams.find((t) => t.id === id)?.name ?? ''
  const cell = (v: string | number) => {
    const text = String(v)
    return /[;"\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }
  const rows: (string | number)[][] = [['Время', 'Команда', 'Что', 'Вопрос', 'Баллы', 'Подробности']]
  for (const e of log) {
    rows.push([formatClock(e.at), teamName(e.teamId), KIND_NAMES[e.kind], e.where ?? '', e.points, e.note ?? ''])
  }
  rows.push([])
  rows.push(['Итог', 'Команда', 'Верно', 'Неверно', 'Счёт', 'Поправки ведущего'])
  for (const s of teamStats(game, log)) rows.push(['', s.team.name, s.correct, s.wrong, s.team.score, s.manual])
  return '﻿' + rows.map((r) => r.map(cell).join(';')).join('\r\n')
}
