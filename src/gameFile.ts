import type JSZipType from 'jszip'
import { APP_KEY } from './site'
import { addMediaFile, getMedia, saveGame, saveMedia } from './db'
import { repairGame } from './repairGame'
import { allMediaIds } from './game'
import { decodeName, replaceMedia, siqToGame, type SiqResult } from './siq'
import { parseXml } from './xml'
import type { Game, MediaRef, MediaType } from './types'

// Файл игры (.zip): чтобы перенести игру на другой ноутбук или собрать её вне программы.
// Внутри:
//   game.json        — игра и список файлов
//   media/<id>.<расширение> — картинки, музыка, видео

const FORMAT = 'svoya-igra'
const VERSION = 1

type MediaEntry = { id: string; type: MediaType; name: string; mime: string; path: string }
type Manifest = { format: string; version: number; game: Game; media: MediaEntry[] }

// Расширение файла: из имени, а если его нет — по типу
function extensionOf(name: string, mime: string) {
  const fromName = name.split('.').pop()
  if (fromName && fromName !== name && fromName.length <= 5) return fromName.toLowerCase()
  return mime.split('/')[1]?.split('+')[0] ?? 'bin'
}

// Тип файла по расширению — если в файле игры он не указан
const mimeByExtension: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  m4a: 'audio/mp4',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  bmp: 'image/bmp',
  aac: 'audio/aac',
  flac: 'audio/flac',
  m4v: 'video/mp4',
}

// Библиотека для .zip грузится только когда нужна — сайт открывается быстрее
async function loadJSZip() {
  return (await import('jszip')).default
}

// Собрать файл игры со всеми её картинками и музыкой
export async function exportGame(game: Game): Promise<Blob> {
  const JSZip = await loadJSZip()
  const zip = new JSZip()
  const media: MediaEntry[] = []
  for (const id of new Set(allMediaIds(game))) {
    const file = await getMedia(id)
    if (!file) continue // файла нет в этом браузере — игра всё равно сохранится, без него
    const mime = file.blob.type || 'application/octet-stream'
    const path = `media/${id}.${extensionOf(file.name, mime)}`
    zip.file(path, file.blob)
    media.push({ id, type: file.type, name: file.name, mime, path })
  }
  const manifest: Manifest = { format: FORMAT, version: VERSION, game, media }
  zip.file('game.json', JSON.stringify(manifest, null, 2))
  // Картинки и музыка уже сжаты — не тратим время на повторное сжатие
  return zip.generateAsync({ type: 'blob', compression: 'STORE' })
}

// Имя файла для скачивания: название игры без запрещённых в Windows символов
export function exportFileName(game: Game) {
  const safe = game.title.replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'игра'
  return `${safe}.zip`
}

// Что получилось при открытии: новая игра и (у пакета SIGame) что пришлось заменить или пропустить
export type Imported = { game: Game; notes: string[] }

// Открыть файл игры: наш .zip или пакет SIGame (.siq). Игра и её файлы ложатся в хранилище браузера.
// Игра всегда получает новый id — так повторное открытие того же файла не затрёт уже начатую копию.
// onProgress — сколько файлов пакета уже сохранено (их бывает много, это небыстро)
export async function importGame(file: File, onProgress?: (done: number, total: number) => void): Promise<Imported> {
  const JSZip = await loadJSZip()
  let zip: JSZipType
  try {
    zip = await JSZip.loadAsync(file)
  } catch {
    throw new Error(`«${file.name}» — не файл игры. Нужен .zip, который сохранила эта программа, или пакет SIGame (.siq).`)
  }

  // Пакет SIGame: внутри content.xml, а не наш game.json
  if (!zip.file('game.json') && zip.file('content.xml')) return importSiq(zip, file.name, onProgress)

  const manifestFile = zip.file('game.json')
  if (!manifestFile) throw new Error(`В «${file.name}» нет описания игры (game.json). Это точно файл игры?`)
  let manifest: Manifest
  try {
    manifest = JSON.parse(await manifestFile.async('string')) as Manifest
  } catch {
    throw new Error(`Описание игры в «${file.name}» повреждено.`)
  }
  const repaired = repairGame(manifest?.game)
  if (manifest?.format !== FORMAT || !repaired || !Array.isArray(manifest.game?.rounds)) {
    throw new Error(`«${file.name}» — не файл игры «Своя игра».`)
  }
  if (manifest.version > VERSION) {
    throw new Error('Файл сохранён более новой версией программы. Обновите страницу и попробуйте снова.')
  }

  for (const entry of Array.isArray(manifest.media) ? manifest.media : []) {
    if (!entry || typeof entry.id !== 'string' || typeof entry.path !== 'string') continue // испорченная запись — пропускаем
    const data = zip.file(entry.path)
    if (!data) continue // файла нет в архиве — вопрос покажет «файл не найден»
    const ext = entry.path.split('.').pop()?.toLowerCase() ?? ''
    const mime = entry.mime || mimeByExtension[ext] || 'application/octet-stream'
    const blob = new Blob([await data.async('arraybuffer')], { type: mime })
    const type = (['image', 'gif', 'video', 'audio'] as const).includes(entry.type) ? entry.type : 'image'
    await saveMedia({ id: entry.id, type, name: String(entry.name ?? 'файл'), blob })
  }

  // Починенная игра (repairGame.ts): чего не хватало — заполнено, мусор выброшен
  const game = { ...repaired, id: crypto.randomUUID() }
  await saveGame(game)
  return { game, notes: [] }
}

// Пакет SIGame (.siq): описание переводит siq.ts, здесь — файлы из папок Images, Audio, Video.
// Имена файлов в пакете бывают записаны с %-кодировкой и в другом регистре — ищем без учёта этого.
async function importSiq(zip: JSZipType, fileName: string, onProgress?: (done: number, total: number) => void): Promise<Imported> {
  let result: SiqResult
  try {
    result = siqToGame(parseXml(await zip.file('content.xml')!.async('string')))
  } catch (e) {
    throw new Error(`«${fileName}»: ${e instanceof Error ? e.message : 'не получилось прочитать пакет SIGame.'}`)
  }

  const normalize = (p: string) => decodeName(p).toLowerCase()
  const entries = new Map<string, JSZipType.JSZipObject>()
  zip.forEach((p, entry) => {
    if (!entry.dir) entries.set(normalize(p), entry)
  })

  const saved = new Map<string, MediaRef | null>()
  const missing: string[] = []
  const failed: string[] = []
  let done = 0
  for (const f of result.files) {
    onProgress?.(done++, result.files.length)
    const entry = entries.get(normalize(`${f.folder}/${f.name}`))
    if (!entry) {
      missing.push(f.name)
      saved.set(f.key, null)
      continue
    }
    const ext = f.name.split('.').pop()?.toLowerCase() ?? ''
    const fallback = f.type === 'audio' ? 'audio/mpeg' : f.type === 'video' ? 'video/mp4' : 'image/jpeg'
    const blob = await entry.async('blob')
    try {
      saved.set(f.key, await addMediaFile(new File([blob], f.name, { type: mimeByExtension[ext] ?? fallback })))
    } catch (e) {
      failed.push(e instanceof Error ? e.message : `«${f.name}» не сохранился`)
      saved.set(f.key, null)
    }
  }
  onProgress?.(done, result.files.length)

  const game = repairGame(replaceMedia(result.game, saved))!
  await saveGame(game)
  const list = (names: string[]) => names.slice(0, 5).join(', ') + (names.length > 5 ? ` и ещё ${names.length - 5}` : '')
  const notes = [
    ...result.notes,
    ...(missing.length ? [`файлов нет в пакете (${missing.length}) — вопросы без них: ${list(missing)}`] : []),
    ...failed,
  ]
  return { game, notes }
}

// Когда игру последний раз сохраняли файлом — чтобы напомнить в «Моих играх», если свежей копии нет.
// Лежит в localStorage этого браузера: id игры → время.
const EXPORTED_KEY = `${APP_KEY}:exported`

export function exportedAt(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(EXPORTED_KEY) ?? '{}') as Record<string, number>
  } catch {
    return {}
  }
}

export function markExported(gameId: string) {
  try {
    localStorage.setItem(EXPORTED_KEY, JSON.stringify({ ...exportedAt(), [gameId]: Date.now() }))
  } catch {
    // хранилище недоступно — просто не напомним
  }
}
