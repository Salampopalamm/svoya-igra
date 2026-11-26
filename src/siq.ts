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
  sponsored: 'вопрос от спонсора → «без минуса» (перехватить его у нас можно)',
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

type Item = { kind: 'text'; text: string } | { kind: 'say'; text: string } | { kind: 'media'; file: SiqFile }

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

// Слайды вопроса: текст и следующий за ним файл — на одном слайде («Кто на фото?» + фото),
// каждый следующий файл — новый слайд (в SIGame они идут друг за другом)
function slidesFrom(items: Item[]): Content[] {
  const slides: Content[] = []
  let current: Content | null = null
  for (const item of items) {
    if (item.kind === 'say') continue
    if (item.kind === 'text') {
      if (!current || current.text || current.media) slides.push((current = {}))
      current.text = item.text
    } else {
      if (!current || current.media) slides.push((current = {}))
      current.media = placeholder(item.file)
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

type Kind = { name: string; params: Record<string, string>; priceRange?: { min: number; max: number } }

function questionKind(q: XmlNode): Kind {
  const params: Record<string, string> = {}
  const v4 = kid(q, 'type')
  if (v4) {
    for (const p of kids(v4, 'param')) params[p.attrs.name ?? ''] = textOf(p)
    return { name: v4.attrs.name ?? 'simple', params }
  }
  let priceRange: Kind['priceRange']
  for (const p of kids(kid(q, 'params'), 'param')) {
    const name = p.attrs.name ?? ''
    if (name === 'price') {
      const set = kid(p, 'numberSet')
      if (set) {
        const min = Number(set.attrs.minimum)
        const max = Number(set.attrs.maximum)
        if (Number.isFinite(min) && Number.isFinite(max)) priceRange = { min, max }
      } else params.price = textOf(p)
    } else if (!kids(p, 'item').length && !kids(p, 'param').length) params[name] = textOf(p)
  }
  return { name: q.attrs.type ?? 'simple', params, priceRange }
}

// Перевести вид вопроса SIGame в наш. Возвращает поля вопроса; что заменили — в notes.
function convertKind(kind: Kind, price: number, notes: NoteSink): Partial<Question> {
  const positive = (v: string | undefined) => {
    const n = Number(v)
    return Number.isFinite(n) && n > 0 ? n : undefined
  }
  switch (kind.name) {
    case 'cat':
    case 'bagcat':
    case 'secret':
    case 'secretPublicPrice':
    case 'secretNoQuestion': {
      if (kind.name === 'secretNoQuestion') notes.add(NOTES.catNoQuestion)
      if (kind.params.self === 'false' || kind.params.selectionMode === 'exceptCurrent') notes.add(NOTES.catNoSelf)
      let value = positive(kind.params.cost) ?? positive(kind.params.price)
      if (kind.priceRange) {
        if (kind.priceRange.max > kind.priceRange.min) notes.add(NOTES.catRange)
        value = kind.priceRange.max > 0 ? kind.priceRange.max : value
      } else if (kind.name === 'bagcat' && !value) notes.add(NOTES.catRange)
      const theme = kind.params.theme?.trim()
      const cat = { ...(theme ? { theme } : {}), ...(value && value !== price ? { value } : {}) }
      return { kind: 'cat-in-bag', ...(Object.keys(cat).length ? { cat } : {}) }
    }
    case 'auction':
    case 'stake':
      return { kind: 'auction' }
    case 'sponsored':
      notes.add(NOTES.sponsored)
      return { special: { wrong: 0 } }
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

function convertQuestion(q: XmlNode, value: number, files: Files, allNotes: Notes): Question {
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
  const params = kid(q, 'params')
  if (params) {
    const param = (name: string) => kids(params, 'param').find((p) => p.attrs.name === name)
    const items = (p: XmlNode | undefined) => kids(p, 'item').map((i) => contentItem(i, files, notes)).filter((i): i is Item => !!i)
    questionItems = items(param('question'))
    answerItems = items(param('answer'))
    // Варианты ответа (А, Б, В…) — дописываем в текст вопроса
    const optionParams = kids(param('answerOptions'), 'param')
    if (textOf(param('answerType')) === 'select' && optionParams.length) {
      notes.add(NOTES.select)
      options = optionParams.map((o) => `${o.attrs.name ?? ''}) ${kids(o, 'item').map(textOf).filter(Boolean).join(' ')}`).join('\n')
    }
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
    ...[...questionItems, ...answerItems].filter((i) => i.kind === 'say').map((i) => `Сказать: ${(i as { text: string }).text}`),
    right.length > 1 ? `Засчитать также: ${right.slice(1).join('; ')}` : '',
    wrong.length ? `Неверные ответы: ${wrong.join('; ')}` : '',
    ...path(info, 'comments').map(textOf).filter(Boolean).map((t) => `Комментарий: ${t}`),
    ...path(info, 'sources', 'source').map(textOf).filter(Boolean).map((t) => `Источник: ${t}`),
  ].filter(Boolean)

  const kindFields = convertKind(questionKind(q), value, notes)
  note.unshift(...local.map((t) => `Из SIGame: ${t}`))
  const slides = slidesFrom(questionItems)
  if (options) {
    const withText = [...slides].reverse().find((s) => s.text) ?? slides[0]
    withText.text = withText.text ? `${withText.text}\n${options}` : options
  }
  return {
    id: newId(),
    value,
    kind: 'normal',
    slides,
    answer: answerFrom(right[0] ?? '', answerItems),
    played: false,
    ...(note.length ? { hostNote: note.join('\n') } : {}),
    ...kindFields,
  }
}

// Тема → категории (длинная тема — несколько категорий по 10 вопросов)
function convertTheme(theme: XmlNode, final: boolean, files: Files, notes: Notes): Category[] {
  const title = theme.attrs.name?.trim() || 'Тема'
  const raw = path(theme, 'questions', 'question')
  if (final) {
    if (raw.length > 1) notes.add(NOTES.finalExtra)
    const first = raw[0]
    return [{ id: newId(), title, questions: first ? [convertQuestion(first, 0, files, notes)] : [] }]
  }
  const questions = raw.map((q, i) => {
    const price = Number(q.attrs.price)
    return convertQuestion(q, Number.isFinite(price) && price > 0 ? price : (i + 1) * 100, files, notes)
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
  return {
    id: newId(),
    title: round.attrs.name?.trim() || (final ? 'Финал' : `Раунд ${index + 1}`),
    kind: final ? 'final' : 'standard',
    categories: path(round, 'themes', 'theme').flatMap((t) => convertTheme(t, final, files, notes)),
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
