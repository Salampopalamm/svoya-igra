import { demoGame } from './data/demoGame'
import { MAX_QUESTIONS, MAX_TEAMS } from './game'
import type { Category, Content, Game, MediaRef, Question, Theme } from './types'

// Мастер «Быстрая игра»: черновик, разбор таблицы из Excel и сборка игры из черновика.

// Одна строка таблицы вопросов — как в Excel: категория, стоимость, вопрос, ответ, файл
export type Row = {
  id: string
  category: string
  value: string // строкой: пока человек печатает, тут может быть что угодно
  question: string
  answer: string
  media?: MediaRef
}

export type Draft = {
  title: string
  client: string
  rows: Row[]
  teamNames: string[]
  theme?: Theme // оформление зала; в черновиках, сохранённых до 17.11.2026, его нет
}

// Оформление черновика (по умолчанию — строгое тёмное)
export function draftTheme(draft: Draft): Theme {
  return draft.theme ?? { ...demoGame.theme }
}

// Файлы оформления черновика (логотип, фон) — чтобы удалить их, если черновик выбросили
export function draftThemeMedia(draft: Draft): MediaRef[] {
  const { logo, background } = draftTheme(draft)
  return [logo, background].filter((m): m is MediaRef => !!m)
}

const newId = () => crypto.randomUUID()

export function emptyRow(category = '', value = ''): Row {
  return { id: newId(), category, value, question: '', answer: '' }
}

// Новый черновик: одна категория на 10 пустых вопросов (100…1000) и 4 команды
export function newDraft(): Draft {
  return {
    title: '',
    client: '',
    rows: Array.from({ length: 10 }, (_, i) => emptyRow('Категория 1', String((i + 1) * 100))),
    teamNames: ['Команда 1', 'Команда 2', 'Команда 3', 'Команда 4'],
    theme: { ...demoGame.theme },
  }
}

export const isRowEmpty = (r: Row) => !r.question.trim() && !r.answer.trim() && !r.media

// ---- Проверка: что подсветить в таблице ----

// Одинаковые стоимости в категории — не недочёт: ячейки на табло стоят по порядку
export type RowProblem = 'no-question' | 'no-answer' | 'bad-value' | 'too-many'

export function rowProblems(rows: Row[]): Map<string, RowProblem> {
  const problems = new Map<string, RowProblem>()
  const counts = new Map<string, number>()

  for (const r of rows) {
    if (isRowEmpty(r)) continue
    const category = r.category.trim() || 'Без категории'
    const value = Number(r.value)
    counts.set(category, (counts.get(category) ?? 0) + 1)

    if (!r.question.trim() && !r.media) problems.set(r.id, 'no-question')
    else if (!r.answer.trim()) problems.set(r.id, 'no-answer')
    else if (!Number.isInteger(value) || value <= 0) problems.set(r.id, 'bad-value')
    else if (counts.get(category)! > MAX_QUESTIONS) problems.set(r.id, 'too-many')
  }
  return problems
}

export const problemText: Record<RowProblem, string> = {
  'no-question': 'впишите вопрос или добавьте файл',
  'no-answer': 'впишите ответ',
  'bad-value': 'стоимость — целое число больше нуля',
  'too-many': `в категории больше ${MAX_QUESTIONS} вопросов — лишние не попадут на табло`,
}

// ---- Вставка из Excel / Google Таблиц ----

const looksLikeNumber = (s: string) => /^\s*\d[\d\s]*\s*$/.test(s)

// Разобрать скопированные ячейки. Столбцы: Категория, Стоимость, Вопрос, Ответ.
// Поддерживаем и короче: «Категория, Вопрос, Ответ» или просто «Вопрос, Ответ».
// Пустая категория — как в строке выше (так бывает с объединёнными ячейками).
// Пустая стоимость — по порядку в категории: 100, 200, 300…
export function parseTable(text: string): Row[] {
  let lines = text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.split('\t').map((cell) => cell.trim().replace(/^"(.*)"$/s, '$1')))
    .filter((cells) => cells.some(Boolean))
  if (lines.length === 0) return []

  // Первая строка — заголовки («Категория», «Вопрос»…)? Пропускаем.
  if (lines[0].some((cell) => /вопрос|категори|ответ/i.test(cell)) && !lines[0].some(looksLikeNumber)) {
    lines = lines.slice(1)
  }

  const width = Math.max(...lines.map((cells) => cells.length))
  const hasValues = width >= 4 || (width === 3 && lines.filter((c) => looksLikeNumber(c[1] ?? '')).length > lines.length / 2)

  const rows: Row[] = []
  let lastCategory = ''
  for (const cells of lines) {
    let category = ''
    let value = ''
    let question: string
    let answer: string
    if (hasValues) [category = '', value = '', question = '', answer = ''] = cells
    else if (width >= 3) [category = '', question = '', answer = ''] = cells
    else [question = '', answer = ''] = cells

    category = category || lastCategory
    lastCategory = category
    rows.push({ id: newId(), category, value: value.replace(/\s/g, ''), question, answer })
  }

  // Пустые стоимости — по порядку в категории
  const order = new Map<string, number>()
  for (const r of rows) {
    const n = (order.get(r.category) ?? 0) + 1
    order.set(r.category, n)
    if (!r.value) r.value = String(n * 100)
  }
  return rows
}

// Пустой шаблон для Excel: CSV через «;» и с меткой UTF-8, чтобы русские буквы открылись правильно
export function templateCsv(): Blob {
  const lines = [
    'Категория;Стоимость;Вопрос;Ответ',
    'География;100;Столица Франции?;Париж',
    ';200;Самый большой океан?;Тихий',
  ]
  return new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })
}

// ---- Сборка игры ----

// Слайды вопроса из строки таблицы: текст — первый слайд, файл — второй (как «задание → картинка»)
function slidesOf(r: Row): Content[] {
  const slides: Content[] = []
  if (r.question.trim()) slides.push({ text: r.question.trim() })
  if (r.media) slides.push({ media: r.media })
  return slides.length > 0 ? slides : [{}]
}

export function gameFromDraft(draft: Draft): Game {
  const categories: Category[] = []
  for (const r of draft.rows) {
    if (isRowEmpty(r)) continue
    const title = r.category.trim() || 'Без категории'
    let category = categories.find((c) => c.title === title)
    if (!category) {
      category = { id: newId(), title, questions: [] }
      categories.push(category)
    }
    if (category.questions.length >= MAX_QUESTIONS) continue // больше 10 в строке табло не помещается
    const value = Number(r.value)
    const question: Question = {
      id: newId(),
      value: Number.isInteger(value) && value > 0 ? value : (category.questions.length + 1) * 100,
      kind: 'normal',
      slides: slidesOf(r),
      answer: r.answer.trim() ? { text: r.answer.trim() } : {},
      played: false,
    }
    category.questions.push(question)
  }

  const names = draft.teamNames.map((n) => n.trim()).filter(Boolean).slice(0, MAX_TEAMS)
  const teams = (names.length > 0 ? names : ['Команда 1']).map((name) => ({ id: newId(), name, score: 0 }))

  return {
    id: newId(),
    title: draft.title.trim() || 'Новая игра',
    client: draft.client.trim(),
    theme: draftTheme(draft),
    players: [],
    teams,
    rules: [],
    rounds: [{ id: newId(), title: 'Раунд 1', kind: 'standard', categories }],
  }
}

// ---- Черновик в браузере: чтобы случайная перезагрузка не стёрла набранное ----

const DRAFT_KEY = 'svoya-igra:wizard'

export function loadDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    return raw ? (JSON.parse(raw) as Draft) : null
  } catch {
    return null
  }
}

export function saveDraft(draft: Draft) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
  } catch {
    // хранилище недоступно — мастер работает и без черновика
  }
}

export function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY)
  } catch {
    // ничего страшного
  }
}
