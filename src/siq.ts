import { demoGame } from './data/demoGame'
import { MAX_QUESTIONS, questionContents } from './game'
import { MAX_PICTURES } from './pictures'
import { plural } from './plural'
import type { Category, Content, Game, MediaRef, MediaType, Question, Round, Special } from './types'
import { kid, kids, path, textOf, type XmlNode } from './xml'

// Пакеты SIGame (.siq) → наша игра (решение владельца 26.11.2026: «ближайшее наше + отчёт»).
// .siq — это zip: content.xml (описание) + папки Images, Audio, Video с файлами.
// Два формата описания:
//   старый (версии 4 и раньше): вопрос — <scenario> из <atom> (текст, image, voice, video, marker — дальше ответ),
//     вид вопроса — <type name="cat|bagcat|auction|sponsored">;
//   новый (SIGame 7, версия 5): <params> с param name="question" / "answer" из <item>, вид — атрибут type у question.
// Здесь только перевод описания (чистые функции, есть автопроверки). Сами файлы из архива
// достаёт и сохраняет importSiq в gameFile.ts, потом подставляет их сюда через replaceMedia.

export type SiqFolder = 'Images' | 'Audio' | 'Video'

// Файл, на который ссылается пакет: пока он не сохранён, в игре вместо него ссылка с id = key
export type SiqFile = { key: string; folder: SiqFolder; name: string; type: MediaType }

export type SiqResult = { game: Game; files: SiqFile[]; notes: string[] }

// Что пришлось заменить или пропустить — показываем после открытия
const NOTES = {
  noRisk: 'вопрос без риска → «×2, без минуса» (перехватить его у нас можно)',
  sponsored: 'вопрос от спонсора → «×2, без минуса» (перехватить его у нас можно)',
  catRange: 'кот с выбором цены → цена кота — самая большая из возможных',
  catNoSelf: 'кот, которого нельзя оставить себе → у нас его можно отдать и себе',
  catNoQuestion: 'кот без вопроса → обычный кот: ведущий просто нажимает «Верно»',
  stakeAll: 'ставки всех команд → вопрос «для всех команд» за его стоимость',
  select: 'варианты ответа → дописаны в текст вопроса',
  html: 'страница (html) внутри вопроса — пропущена',
  external: 'файл по ссылке из интернета — пропущен (берём только файлы внутри пакета)',
  split: 'тема длиннее 10 вопросов — разделена на несколько категорий',
  finalExtra: 'в теме финала несколько вопросов — оставлен первый',
} as const

// Куда записать замену: в общий отчёт и (у вопроса) в заметку ведущему
type NoteSink = { add(text: string): void }

class Notes {
  private counts = new Map<string, number>()
  add(text: string) {
    this.counts.set(text, (this.counts.get(text) ?? 0) + 1)
  }
  list(): string[] {
    return [...this.counts].map(([text, n]) => (n > 1 ? `${text} — ${n} ${plural(n, 'раз', 'раза', 'раз')}` : text))
  }
}

// ---- Файлы ----

const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'svg']
const AUDIO_EXT = ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac']
const VIDEO_EXT = ['mp4', 'webm', 'mov', 'm4v', 'avi', 'mkv']

// Тип файла: по расширению, а если оно незнакомое — по папке
export function siqMediaType(name: string, folder: SiqFolder): MediaType {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'gif') return 'gif'
  if (IMAGE_EXT.includes(ext)) return 'image'
  if (AUDIO_EXT.includes(ext)) return 'audio'
  if (VIDEO_EXT.includes(ext)) return 'video'
  return folder === 'Audio' ? 'audio' : folder === 'Video' ? 'video' : 'image'
}

// Имя файла в ссылке пакета может быть записано с %20 и т. п. — сравниваем «расшифрованное»
export function decodeName(name: string): string {
  try {
    return decodeURIComponent(name)
  } catch {
    return name
  }
}

// ---- Содержимое вопроса ----

// join — показывается вместе с предыдущим (в новом формате у предыдущего waitForFinish="False"):
// несколько картинок сразу на экране, «текст под картинкой»
type Item = ({ kind: 'text'; text: string } | { kind: 'say'; text: string } | { kind: 'media'; file: SiqFile }) & { join?: boolean }

class Files {
  private byKey = new Map<string, SiqFile>()
  get(folder: SiqFolder, rawName: string): SiqFile {
    const name = decodeName(rawName.trim())
    const key = `siq:${folder}/${name}`
    let file = this.byKey.get(key)
    if (!file) {
      file = { key, folder, name, type: siqMediaType(name, folder) }
      this.byKey.set(key, file)
    }
    return file
  }
  list() {
    return [...this.byKey.values()]
  }
}

const FOLDER_BY_TYPE: Record<string, SiqFolder> = { image: 'Images', voice: 'Audio', audio: 'Audio', video: 'Video' }

// Старый формат: <atom type="…">значение</atom>; медиа — «@имя» (файл в пакете), иначе ссылка в интернет
function atomItem(atom: XmlNode, files: Files, notes: NoteSink): Item | null {
  const type = atom.attrs.type ?? 'text'
  const value = textOf(atom)
  if (type === 'text') return value ? { kind: 'text', text: value } : null
  if (type === 'say') return value ? { kind: 'say', text: value } : null
  const folder = FOLDER_BY_TYPE[type]
  if (!folder) {
    if (type === 'html') notes.add(NOTES.html)
    return null
  }
  if (!value.startsWith('@')) {
    if (value) notes.add(NOTES.external)
    return null
  }
  return { kind: 'media', file: files.get(folder, value.slice(1)) }
}

// Новый формат: <item type="image" isRef="True">имя</item>; текст «replic» — слова ведущего
function contentItem(item: XmlNode, files: Files, notes: NoteSink): Item | null {
  const type = item.attrs.type ?? 'text'
  const value = textOf(item)
  if (type === 'text') {
    if (!value) return null
    return item.attrs.placement === 'replic' ? { kind: 'say', text: value } : { kind: 'text', text: value }
  }
  const folder = FOLDER_BY_TYPE[type]
  if (!folder) {
    if (type === 'html') notes.add(NOTES.html)
    return null
  }
  if ((item.attrs.isRef ?? '').toLowerCase() !== 'true') {
    if (value) notes.add(NOTES.external)
    return null
  }
  return { kind: 'media', file: files.get(folder, value.replace(/^@/, '')) }
}

// Пока файл не сохранён — ссылка-заглушка с id = key
const placeholder = (file: SiqFile): MediaRef => ({ id: file.key, type: file.type, name: file.name })

const isPicture = (type: MediaType) => type === 'image' || type === 'gif'

// Слайды вопроса: текст и следующий за ним файл — на одном слайде («Кто на фото?» + фото),
// каждый следующий файл — новый слайд (в SIGame они идут друг за другом). То, что в пакете
// показывается вместе (join), — на том же слайде: текст под картинкой, до 8 картинок рядом.
function slidesFrom(items: Item[]): Content[] {
  const slides: Content[] = []
  let current: Content | null = null
  for (const item of items) {
    if (item.kind === 'say') continue
    if (item.kind === 'text') {
      if (current && item.join && !current.text) current.text = item.text
      else {
        if (!current || current.text || current.media) slides.push((current = {}))
        current.text = item.text
      }
    } else {
      const pictures = current ? 1 + (current.more?.length ?? 0) : 0
      if (current?.media && item.join && isPicture(current.media.type) && isPicture(item.file.type) && pictures < MAX_PICTURES) {
        current.more = [...(current.more ?? []), placeholder(item.file)]
      } else {
        if (!current || current.media) slides.push((current = {}))
        current.media = placeholder(item.file)
      }
    }
  }
  return slides.length ? slides : [{}]
}

// Ответ: верные ответы текстом + первый файл из ответа (картинки — до восьми рядом)
function answerFrom(right: string, items: Item[]): Content {
  const answer: Content = {}
  const texts = items.filter((i): i is { kind: 'text'; text: string } => i.kind === 'text').map((i) => i.text)
  const text = [right, ...texts.filter((t) => t !== right)].filter(Boolean).join('\n')
  if (text) answer.text = text
  const media = items.filter((i): i is { kind: 'media'; file: SiqFile } => i.kind === 'media').map((i) => i.file)
  if (media[0]) {
    answer.media = placeholder(media[0])
    const pictures = media.slice(1).filter((f) => f.type === 'image' || f.type === 'gif')
    if ((media[0].type === 'image' || media[0].type === 'gif') && pictures.length) {
      answer.more = pictures.slice(0, MAX_PICTURES - 1).map(placeholder)
    }
  }
  return answer
}

// ---- Вид вопроса ----

// Цена кота в пакете: одно число, диапазон «от … до … с шагом …» или 0 — «на выбор: самая дешёвая или самая дорогая в раунде»
type Price = { min: number; max: number; step: number }
type Kind = { name: string; params: Record<string, string>; price?: Price }

// Старый формат: «2000», «0», «[100;1000]/200», «[100;500]»
function parsePrice(text: string | undefined): Price | undefined {
  const t = text?.trim() ?? ''
  const range = /^\[(\d+);(\d+)\](?:\/(\d+))?$/.exec(t)
  if (range) return { min: Number(range[1]), max: Number(range[2]), step: Number(range[3] ?? 0) }
  const n = Number(t)
  return t && Number.isFinite(n) ? { min: n, max: n, step: 0 } : undefined
}

// Самая большая цена, которую можно выбрать (с шагом 200 от 100 до 1000 — это 900)
export function topPrice(p: Price): number {
  return p.step > 0 ? p.min + Math.floor((p.max - p.min) / p.step) * p.step : p.max
}

function questionKind(q: XmlNode): Kind {
  const params: Record<string, string> = {}
  const v4 = kid(q, 'type')
  if (v4) {
    for (const p of kids(v4, 'param')) params[p.attrs.name ?? ''] = textOf(p)
    return { name: v4.attrs.name ?? 'simple', params, price: parsePrice(params.cost) }
  }
  let price: Price | undefined
  for (const p of kids(kid(q, 'params'), 'param')) {
    const name = p.attrs.name ?? ''
    if (name === 'price') {
      const set = kid(p, 'numberSet')
      const [min, max, step] = [set?.attrs.minimum, set?.attrs.maximum, set?.attrs.step].map(Number)
      price = set && Number.isFinite(min) && Number.isFinite(max) ? { min, max, step: Number.isFinite(step) ? step : 0 } : parsePrice(textOf(p))
    } else if (!kids(p, 'item').length && !kids(p, 'param').length) params[name] = textOf(p)
  }
  return { name: q.attrs.type ?? 'simple', params, price }
}

// Кот без вопроса: очки просто достаются получателю (в старом формате — knows="never")
const isCatWithoutQuestion = (kind: Kind) => kind.name === 'secretNoQuestion' || (kind.name === 'bagcat' && kind.params.knows === 'never')

// Перевести вид вопроса SIGame в наш. Возвращает поля вопроса; что заменили — в notes.
// roundTop — самая дорогая цена в раунде (кот «на выбор: самая дешёвая или самая дорогая»)
function convertKind(kind: Kind, price: number, roundTop: number, notes: NoteSink): Partial<Question> {
  switch (kind.name) {
    case 'cat':
    case 'bagcat':
    case 'secret':
    case 'secretPublicPrice':
    case 'secretNoQuestion': {
      if (isCatWithoutQuestion(kind)) notes.add(NOTES.catNoQuestion)
      if (kind.params.self === 'false' || kind.params.selectionMode === 'exceptCurrent') notes.add(NOTES.catNoSelf)
      let value: number | undefined
      if (kind.price) {
        if (kind.price.max <= 0) {
          notes.add(NOTES.catRange) // 0 — на выбор: самая дешёвая или самая дорогая в раунде
          value = roundTop
        } else {
          if (topPrice(kind.price) > kind.price.min) notes.add(NOTES.catRange)
          value = topPrice(kind.price)
        }
      }
      const theme = kind.params.theme?.trim()
      const cat = { ...(theme && theme !== '-' ? { theme } : {}), ...(value && value !== price ? { value } : {}) }
      return { kind: 'cat-in-bag', ...(Object.keys(cat).length ? { cat } : {}) }
    }
    case 'auction':
    case 'stake':
      return { kind: 'auction' }
    case 'sponsored':
      notes.add(NOTES.sponsored)
      return { special: { correct: 2, wrong: 0 } satisfies Special }
    case 'noRisk':
      notes.add(NOTES.noRisk)
      return { special: { correct: 2, wrong: 0 } satisfies Special }
    case 'forAll':
      return { special: { forAll: true } }
    case 'stakeAll':
      notes.add(NOTES.stakeAll)
      return { special: { forAll: true } }
    case 'simple':
    case '':
      return {}
    default:
      notes.add(`неизвестный вид вопроса «${kind.name}» → обычный вопрос`)
      return {}
  }
}

// ---- Вопрос, тема, раунд ----

const newId = () => crypto.randomUUID()

// Где вопрос: самая дорогая цена раунда (для кота «на выбор») и комментарий к теме («Назовите исполнителя»)
type Place = { roundTop: number; themeNote: string }

function convertQuestion(q: XmlNode, value: number, files: Files, allNotes: Notes, where: Place): Question {
  // Замены этого вопроса — и в общий отчёт, и в заметку ведущему (отчёт виден один раз, заметка — всегда)
  const local: string[] = []
  const notes: NoteSink = {
    add(text) {
      allNotes.add(text)
      if (!local.includes(text)) local.push(text)
    },
  }
  let questionItems: Item[]
  let answerItems: Item[]
  let options = '' // варианты ответа «A) … B) …» — допишем к тексту вопроса
  let numberNote = ''
  const params = kid(q, 'params')
  if (params) {
    const param = (name: string) => kids(params, 'param').find((p) => p.attrs.name === name)
    // У предыдущего waitForFinish="False" — этот показывается вместе с ним
    const items = (p: XmlNode | undefined) =>
      kids(p, 'item')
        .map((it, i, all) => {
          const item = contentItem(it, files, notes)
          return item && i > 0 && all[i - 1].attrs.waitForFinish?.toLowerCase() === 'false' ? { ...item, join: true } : item
        })
        .filter((i): i is Item => !!i)
    questionItems = items(param('question'))
    answerItems = items(param('answer'))
    // Варианты ответа (А, Б, В…) — дописываем в текст вопроса
    const optionParams = kids(param('answerOptions'), 'param')
    if (textOf(param('answerType')) === 'select' && optionParams.length) {
      notes.add(NOTES.select)
      options = optionParams.map((o) => `${o.attrs.name ?? ''}) ${kids(o, 'item').map(textOf).filter(Boolean).join(' ')}`).join('\n')
    }
    // Числовой ответ с допуском: «засчитать ±5»
    const deviation = Number(textOf(param('answerDeviation')))
    if (textOf(param('answerType')) === 'number' && deviation > 0) numberNote = `Числовой ответ: засчитать, если отличается не больше чем на ${deviation}`
  } else {
    const atoms = path(q, 'scenario', 'atom')
    const marker = atoms.findIndex((a) => a.attrs.type === 'marker')
    const before = marker < 0 ? atoms : atoms.slice(0, marker)
    const after = marker < 0 ? [] : atoms.slice(marker + 1)
    questionItems = before.map((a) => atomItem(a, files, notes)).filter((i): i is Item => !!i)
    answerItems = after.map((a) => atomItem(a, files, notes)).filter((i): i is Item => !!i)
  }

  const right = path(q, 'right', 'answer').map(textOf).filter(Boolean)
  const wrong = path(q, 'wrong', 'answer').map(textOf).filter(Boolean)
  const info = kid(q, 'info')
  const note = [
    where.themeNote ? `К теме: ${where.themeNote}` : '',
    ...[...questionItems, ...answerItems].filter((i) => i.kind === 'say').map((i) => `Сказать: ${(i as { text: string }).text}`),
    numberNote,
    right.length > 1 ? `Засчитать также: ${right.slice(1).join('; ')}` : '',
    wrong.length ? `Неверные ответы: ${wrong.join('; ')}` : '',
    ...path(info, 'comments').map(textOf).filter(Boolean).map((t) => `Комментарий: ${t}`),
    ...path(info, 'sources', 'source').map(textOf).filter(Boolean).map((t) => `Источник: ${t}`),
  ].filter(Boolean)

  const kind = questionKind(q)
  const kindFields = convertKind(kind, value, where.roundTop, notes)
  note.unshift(...local.map((t) => `Из SIGame: ${t}`))
  const slides = slidesFrom(questionItems)
  if (options) {
    const withText = [...slides].reverse().find((s) => s.text) ?? slides[0]
    withText.text = withText.text ? `${withText.text}\n${options}` : options
  }
  const answer = answerFrom(right[0] ?? '', answerItems)
  // Кот без вопроса приходит пустым — пишем залу, что происходит, иначе ячейка выглядит незаполненной
  if (isCatWithoutQuestion(kind)) {
    if (!slides.some((s) => s.text || s.media)) slides.splice(0, slides.length, { text: 'Кот в мешке без вопроса: очки достаются команде, которой его отдали' })
    if (!answer.text && !answer.media) answer.text = 'Очки ваши!'
  }
  return {
    id: newId(),
    value,
    kind: 'normal',
    slides,
    answer,
    played: false,
    ...(note.length ? { hostNote: note.join('\n') } : {}),
    ...kindFields,
  }
}

// Тема → категории (длинная тема — несколько категорий по 10 вопросов)
// Цена «-1» в SIGame — пустое место в теме, вопроса там нет
const isGap = (q: XmlNode) => Number(q.attrs.price) < 0

function convertTheme(theme: XmlNode, final: boolean, roundTop: number, files: Files, notes: Notes): Category[] {
  const title = theme.attrs.name?.trim() || 'Тема'
  const raw = path(theme, 'questions', 'question').filter((q) => !isGap(q))
  const where: Place = { roundTop, themeNote: path(theme, 'info', 'comments').map(textOf).filter(Boolean).join(' ') }
  if (final) {
    if (raw.length > 1) notes.add(NOTES.finalExtra)
    const first = raw[0]
    return [{ id: newId(), title, questions: first ? [convertQuestion(first, 0, files, notes, where)] : [] }]
  }
  const questions = raw.map((q, i) => {
    const price = Number(q.attrs.price)
    return convertQuestion(q, Number.isFinite(price) && price > 0 ? price : (i + 1) * 100, files, notes, where)
  })
  if (questions.length <= MAX_QUESTIONS) return [{ id: newId(), title, questions }]
  notes.add(NOTES.split)
  const parts: Category[] = []
  for (let i = 0; i < questions.length; i += MAX_QUESTIONS) {
    parts.push({ id: newId(), title: `${title} (${parts.length + 1})`, questions: questions.slice(i, i + MAX_QUESTIONS) })
  }
  return parts
}

function convertRound(round: XmlNode, index: number, files: Files, notes: Notes): Round {
  const final = round.attrs.type === 'final'
  const themes = path(round, 'themes', 'theme')
  const prices = themes.flatMap((t) => path(t, 'questions', 'question').map((q) => Number(q.attrs.price))).filter((p) => p > 0)
  const roundTop = prices.length ? Math.max(...prices) : 0
  return {
    id: newId(),
    title: round.attrs.name?.trim() || (final ? 'Финал' : `Раунд ${index + 1}`),
    kind: final ? 'final' : 'standard',
    categories: themes.flatMap((t) => convertTheme(t, final, roundTop, files, notes)),
  }
}

// Описание пакета (корень content.xml) → игра. Файлы — заглушки, их подставит replaceMedia.
export function siqToGame(pkg: XmlNode): SiqResult {
  if (pkg.name !== 'package') throw new Error('Это не пакет SIGame: в content.xml нет <package>.')
  const files = new Files()
  const notes = new Notes()
  const rounds = path(pkg, 'rounds', 'round')
    .map((r, i) => convertRound(r, i, files, notes))
    .filter((r) => r.categories.length > 0)
  if (rounds.length === 0) throw new Error('В пакете нет ни одного раунда с темами.')
  const game: Game = {
    id: newId(),
    title: pkg.attrs.name?.trim() || 'Пакет SIGame',
    client: '',
    theme: { ...demoGame.theme },
    players: [],
    // Команд в пакете нет — три для начала, их меняют на экране «Команды»
    teams: [1, 2, 3].map((n) => ({ id: newId(), name: `Команда ${n}`, score: 0 })),
    rounds,
    rules: [],
    updatedAt: Date.now(),
  }
  return { game, files: files.list(), notes: notes.list() }
}

// Подставить сохранённые файлы вместо заглушек. null — файл не нашёлся: убираем ссылку.
// У вопроса, где файл не перенёсся, ведущий увидит это в заметке.
export function replaceMedia(game: Game, saved: Map<string, MediaRef | null>): Game {
  for (const question of game.rounds.flatMap((r) => r.categories.flatMap((c) => c.questions))) {
    const lost: string[] = []
    const swap = (ref: MediaRef | undefined) => {
      if (!ref || !saved.has(ref.id)) return ref
      const found = saved.get(ref.id)
      if (!found) lost.push(ref.name)
      return found ?? undefined
    }
    for (const content of questionContents(question)) {
      const first = swap(content.media)
      const more = (content.more ?? []).map(swap).filter((m): m is MediaRef => !!m)
      const all = [first, ...more].filter((m): m is MediaRef => !!m)
      delete content.media
      delete content.more
      if (all[0]) content.media = all[0]
      if (all.length > 1) content.more = all.slice(1)
    }
    if (lost.length) {
      const line = `Не перенёсся файл: ${lost.join(', ')} (нет в пакете или браузер его не покажет)`
      question.hostNote = question.hostNote ? `${question.hostNote}\n${line}` : line
    }
  }
  return game
}

// Форматы, которые браузер не проиграет (старые пакеты): такие файлы не сохраняем, а называем в отчёте
const UNPLAYABLE = ['avi', 'wmv', 'flv', 'mpg', 'mpeg', '3gp', 'wma', 'mid', 'midi', 'tif', 'tiff']
export const browserCanPlay = (name: string) => !UNPLAYABLE.includes(name.split('.').pop()?.toLowerCase() ?? '')
