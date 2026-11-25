import type { Box, Category, Content, Game, MediaRef, Player, Question, QuestionTree, Round, Rule, Team, Theme, TreeNode } from './types'

// Починка игры из файла .zip: файл могли собрать вручную, повредить или сохранить другой версией программы.
// Всё, чего не хватает, заполняем безопасными значениями, мусор выбрасываем — чтобы игра не сломалась
// посреди вечера. Ничего не выдумываем: пустой вопрос остаётся пустым, его покажет «Проверка игры».

import { cleanClip } from './clip'

type Raw = Record<string, unknown>

const isObject = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v)
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const text = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : fallback)
const maybeText = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined)
// Число; «100» строкой (так бывает, если файл собирали в Excel) — тоже число
const number = (v: unknown, fallback = 0): number => {
  const n = typeof v === 'string' && v.trim() ? Number(v) : v
  return typeof n === 'number' && Number.isFinite(n) ? n : fallback
}
const maybeNumber = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)
const id = (v: unknown): string => (typeof v === 'string' && v ? v : crypto.randomUUID())
const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(v as T) ? (v as T) : fallback

const MEDIA_TYPES = ['image', 'gif', 'video', 'audio'] as const

function mediaRef(v: unknown): MediaRef | undefined {
  if (!isObject(v) || typeof v.id !== 'string' || !v.id) return undefined
  const ref: MediaRef = { id: v.id, type: oneOf(v.type, MEDIA_TYPES, 'image'), name: text(v.name, 'файл') }
  // Фрагмент — только у музыки и видео
  const clip = isObject(v.clip) && (ref.type === 'audio' || ref.type === 'video') ? cleanClip({ start: maybeNumber(v.clip.start), end: maybeNumber(v.clip.end) }) : undefined
  if (clip) ref.clip = clip
  return ref
}

function content(v: unknown): Content {
  if (!isObject(v)) return {}
  const result: Content = {}
  const t = maybeText(v.text)
  if (t) result.text = t
  const media = mediaRef(v.media)
  if (media) {
    result.media = media
    const more = list(v.more).map(mediaRef).filter((m): m is MediaRef => !!m)
    if (more.length) result.more = more
    if (typeof v.layout === 'string') result.layout = oneOf(v.layout, ['cols-1', 'cols-2', 'cols-3', 'cols-4', 'big-left'] as const, 'cols-2')
  }
  if (isObject(v.place)) {
    // Своя расстановка: целые рамки оставляем, испорченная рамка картинки — место по умолчанию (placeOf)
    const textBox = box(v.place.text)
    const media = list(v.place.media).map(box)
    if (textBox || media.some(Boolean)) {
      result.place = {
        ...(textBox ? { text: textBox } : {}),
        ...(media.length ? { media: media as Box[] } : {}), // пустые места — undefined, placeOf их заполнит
      }
    }
  }
  return result
}

function box(v: unknown): Box | undefined {
  if (!isObject(v)) return undefined
  const [x, y, w, h] = [v.x, v.y, v.w, v.h].map((n) => maybeNumber(n))
  if (x === undefined || y === undefined || w === undefined || h === undefined || w <= 0 || h <= 0) return undefined
  return { x, y, w, h }
}

function tree(v: unknown): QuestionTree | undefined {
  if (!isObject(v)) return undefined
  const nodes: TreeNode[] = list(v.nodes)
    .filter(isObject)
    .map((n) => ({
      id: id(n.id),
      kind: oneOf(n.kind, ['question', 'scene', 'end'] as const, 'question'),
      content: content(n.content),
      ...(isObject(n.answer) ? { answer: content(n.answer) } : {}),
      options: list(n.options)
        .filter(isObject)
        .map((o) => ({
          label: text(o.label),
          points: number(o.points),
          ...(maybeText(o.nextNodeId) ? { nextNodeId: maybeText(o.nextNodeId) } : {}),
          ...(maybeText(o.unlockQuestionId) ? { unlockQuestionId: maybeText(o.unlockQuestionId) } : {}),
        })),
    }))
  if (nodes.length === 0) return undefined
  const start = text(v.startNodeId)
  return {
    startNodeId: nodes.some((n) => n.id === start) ? start : nodes[0].id,
    branchBy: oneOf(v.branchBy, ['choice', 'correctness'] as const, 'choice'),
    scoring: oneOf(v.scoring, ['per-step', 'at-end'] as const, 'per-step'),
    nodes,
  }
}

function question(v: Raw): Question {
  const slides = list(v.slides).map(content)
  const q: Question = {
    id: id(v.id),
    value: number(v.value),
    kind: oneOf(v.kind, ['normal', 'cat-in-bag', 'auction'] as const, 'normal'),
    slides: slides.length ? slides : [content(v.prompt)], // prompt — вопрос старого вида
    answer: content(v.answer),
    played: v.played === true,
  }
  const timerSec = maybeNumber(v.timerSec)
  if (timerSec && timerSec > 0) q.timerSec = timerSec
  const hostNote = maybeText(v.hostNote)
  if (hostNote) q.hostNote = hostNote
  if (v.hidden === true) q.hidden = true
  const t = tree(v.tree)
  if (t) q.tree = t
  return q
}

function category(v: Raw): Category {
  return { id: id(v.id), title: text(v.title), questions: list(v.questions).filter(isObject).map(question) }
}

function round(v: Raw, index: number): Round {
  return {
    id: id(v.id),
    title: text(v.title, `Раунд ${index + 1}`),
    kind: oneOf(v.kind, ['standard', 'music', 'final'] as const, 'standard'),
    categories: list(v.categories).filter(isObject).map(category),
    ...(v.hidden === true ? { hidden: true } : {}),
  }
}

function team(v: Raw, index: number): Team {
  const t: Team = { id: id(v.id), name: text(v.name, `Команда ${index + 1}`), score: number(v.score) }
  const target = maybeNumber(v.targetSize)
  if (target) t.targetSize = target
  const emoji = maybeText(v.emoji)
  if (emoji) t.emoji = emoji
  const logo = mediaRef(v.logo)
  if (logo) t.logo = logo
  return t
}

function player(v: Raw): Player {
  const p: Player = { id: id(v.id), name: text(v.name) }
  const photo = mediaRef(v.photo)
  if (photo) p.photo = photo
  const teamId = maybeText(v.teamId)
  if (teamId) p.teamId = teamId
  if (v.locked === true) p.locked = true
  return p
}

function rule(v: Raw): Rule | null {
  if (!isObject(v.when) || !isObject(v.then)) return null
  const value = v.when.value
  return {
    id: id(v.id),
    when: {
      kind: oneOf(v.when.kind, ['score-reached', 'round-finished', 'question-played'] as const, 'score-reached'),
      value: typeof value === 'number' ? value : text(value),
    },
    then: {
      kind: oneOf(v.then.kind, ['open-round', 'unlock-question', 'add-points', 'show-media'] as const, 'unlock-question'),
      target: text(v.then.target),
      ...(mediaRef(v.then.media) ? { media: mediaRef(v.then.media) } : {}),
    },
  }
}

function theme(v: unknown): Theme {
  const t = isObject(v) ? v : {}
  const sounds = isObject(t.sounds) ? t.sounds : {}
  const result: Theme = {
    ...(t as Partial<Theme>), // необязательные поля (размеры, закреплённый таймер) — как есть; ниже проверяем главное
    backgroundTone: oneOf(t.backgroundTone, ['graphite', 'asphalt', 'warm-gray', 'mid-gray', 'light'] as const, 'graphite'),
    headingFont: text(t.headingFont, 'Rubik Mono One') || 'Rubik Mono One',
    teamView: oneOf(t.teamView, ['photos', 'compact'] as const, 'photos'),
    showPhotos: t.showPhotos !== false,
    grayscaleMedia: t.grayscaleMedia === true,
    sounds: {
      enabled: sounds.enabled !== false,
      ...(mediaRef(sounds.correct) ? { correct: mediaRef(sounds.correct) } : {}),
      ...(mediaRef(sounds.wrong) ? { wrong: mediaRef(sounds.wrong) } : {}),
    },
  }
  for (const key of ['logo', 'background'] as const) {
    const ref = mediaRef(t[key])
    if (ref) result[key] = ref
    else delete result[key]
  }
  if (!isObject(t.sizes)) delete result.sizes
  if (!isObject(t.itemSizes)) delete result.itemSizes
  if (typeof t.accentColor !== 'string') delete result.accentColor
  return result
}

// Игра (из файла или из хранилища) → игра, которую программа точно сможет показать. null — это вообще не игра.
export function repairGame(v: unknown): Game | null {
  if (!isObject(v)) return null
  const rounds = list(v.rounds).filter(isObject).map(round)
  if (rounds.length === 0) rounds.push({ id: crypto.randomUUID(), title: 'Раунд 1', kind: 'standard', categories: [] })
  const teams = list(v.teams).filter(isObject).map(team)
  const teamIds = new Set(teams.map((t) => t.id))
  return {
    id: id(v.id),
    title: text(v.title, 'Игра из файла') || 'Игра из файла',
    client: text(v.client),
    ...(maybeText(v.date) ? { date: maybeText(v.date) } : {}),
    theme: theme(v.theme),
    // Игрок в несуществующей команде — просто без команды
    players: list(v.players)
      .filter(isObject)
      .map(player)
      .map((p) => (p.teamId && !teamIds.has(p.teamId) ? { ...p, teamId: undefined } : p)),
    teams,
    rounds,
    rules: list(v.rules)
      .filter(isObject)
      .map(rule)
      .filter((r): r is Rule => !!r),
    ...(maybeNumber(v.updatedAt) ? { updatedAt: maybeNumber(v.updatedAt) } : {}),
  }
}
