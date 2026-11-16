import type JSZipType from 'jszip'
import { getMedia, saveGame, saveMedia, upgradeGame } from './db'
import { allMediaIds } from './game'
import type { Game, MediaType } from './types'

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

// Открыть файл игры: положить игру и её файлы в хранилище браузера. Возвращает новую игру.
// Игра всегда получает новый id — так повторное открытие того же файла не затрёт уже начатую копию.
export async function importGame(file: File): Promise<Game> {
  const JSZip = await loadJSZip()
  let zip: JSZipType
  try {
    zip = await JSZip.loadAsync(file)
  } catch {
    throw new Error(`«${file.name}» — не файл игры. Нужен .zip, который сохранила эта программа.`)
  }

  const manifestFile = zip.file('game.json')
  if (!manifestFile) throw new Error(`В «${file.name}» нет описания игры (game.json). Это точно файл игры?`)
  let manifest: Manifest
  try {
    manifest = JSON.parse(await manifestFile.async('string')) as Manifest
  } catch {
    throw new Error(`Описание игры в «${file.name}» повреждено.`)
  }
  if (manifest.format !== FORMAT || !manifest.game?.rounds) {
    throw new Error(`«${file.name}» — не файл игры «Своя игра».`)
  }
  if (manifest.version > VERSION) {
    throw new Error('Файл сохранён более новой версией программы. Обновите страницу и попробуйте снова.')
  }

  for (const entry of manifest.media ?? []) {
    const data = zip.file(entry.path)
    if (!data) continue // файла нет в архиве — вопрос покажет «файл не найден»
    const ext = entry.path.split('.').pop()?.toLowerCase() ?? ''
    const mime = entry.mime || mimeByExtension[ext] || 'application/octet-stream'
    const blob = new Blob([await data.async('arraybuffer')], { type: mime })
    await saveMedia({ id: entry.id, type: entry.type, name: entry.name, blob })
  }

  const game = upgradeGame({ ...manifest.game, id: crypto.randomUUID() })
  await saveGame(game)
  return game
}
