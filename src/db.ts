import { APP_KEY } from './site'
import Dexie, { type EntityTable } from 'dexie'
import { demoGame } from './data/demoGame'
import { demoMediaFiles } from './data/demoMedia'
import { repairGame } from './repairGame'
import type { Content, Game, MediaFile, MediaRef, MediaType, Question } from './types'

// Хранилище в браузере (IndexedDB через библиотеку Dexie):
//   games — игры (вопросы, команды, оформление); файлы в них — только ссылками MediaRef;
//   media — сами файлы: картинки, музыка, видео.
// Так замена картинки не трогает игру, а игра не раздувается от тяжёлых файлов.

const db = new Dexie(APP_KEY) as Dexie & {
  games: EntityTable<Game, 'id'>
  media: EntityTable<MediaFile, 'id'>
}

db.version(1).stores({
  games: 'id, updatedAt', // ключ — id, сортируем по дате изменения
})

// Версия 2: таблица файлов; вопрос теперь состоит из слайдов (раньше — одно поле prompt)
db.version(2)
  .stores({
    games: 'id, updatedAt',
    media: 'id',
  })
  .upgrade(async (tx) => {
    await tx
      .table('games')
      .toCollection()
      .modify((game: Game, ref: { value: Game }) => {
        // Тестовую игру просто заменяем новой — в ней появились вопросы с картинкой и музыкой
        ref.value = game.id === demoGame.id ? { ...demoGame, updatedAt: game.updatedAt } : upgradeGame(game)
      })
    await tx.table('media').bulkPut(demoMediaFiles())
  })

// Старые игры: вопрос с полем prompt превращаем в вопрос с одним слайдом
type LegacyQuestion = Question & { prompt?: Content }

export function upgradeGame(game: Game): Game {
  return {
    ...game,
    rounds: game.rounds.map((round) => ({
      ...round,
      categories: round.categories.map((category) => ({
        ...category,
        questions: category.questions.map((q: LegacyQuestion) => {
          if (q.slides?.length) return q
          const { prompt, ...rest } = q
          return { ...rest, slides: [prompt ?? {}] }
        }),
      })),
    })),
  }
}

// Все игры, новые сверху. Если игр нет — кладём тестовую, чтобы было с чем попробовать.
export async function listGames(): Promise<Game[]> {
  if ((await db.games.count()) === 0) {
    await db.media.bulkPut(demoMediaFiles())
    await db.games.put({ ...demoGame, updatedAt: Date.now() })
  }
  const games = await db.games.orderBy('updatedAt').reverse().toArray()
  return games.map(repairGame).filter((g): g is Game => !!g)
}

// Игру из хранилища всегда чиним (repairGame.ts): испорченное поле не уронит пульт или редактор
export async function getGame(id: string): Promise<Game | undefined> {
  const game = await db.games.get(id)
  return (game && repairGame(game)) || undefined
}

export async function saveGame(game: Game) {
  const id = await db.games.put({ ...game, updatedAt: Date.now() })
  tellOtherWindows(game.id)
  return id
}

// Поменять в сохранённой игре только часть (например, оформление), не трогая остальное.
// Пульт так запоминает вид команд, не записывая в хранилище счёт текущей партии.
export async function updateStoredGame(id: string, change: (g: Game) => Game) {
  const game = await db.games.get(id)
  if (!game) return
  await db.games.put(change(repairGame(game) ?? game))
  tellOtherWindows(id)
}

export function deleteGame(id: string) {
  return db.games.delete(id)
}

// ---- Другие окна ----
// Игру могут менять сразу два окна (редактор и пульт, две вкладки редактора). Сохранили — сообщаем остальным,
// чтобы они взяли свежую игру и при следующей правке не вернули старое.

const WINDOW_ID = crypto.randomUUID() // это окно: свои же сообщения не слушаем
const GAMES_CHANNEL = `${APP_KEY}:games`
type GameSaved = { gameId: string; from: string }
let sender: BroadcastChannel | null = null

function tellOtherWindows(gameId: string) {
  try {
    sender ??= new BroadcastChannel(GAMES_CHANNEL)
    sender.postMessage({ gameId, from: WINDOW_ID } satisfies GameSaved)
  } catch {
    // старый браузер без BroadcastChannel — просто не сообщим
  }
}

// Слушать: игру сохранило другое окно. Возвращает «перестать слушать».
export function onGameSavedElsewhere(listener: (gameId: string) => void): () => void {
  const channel = new BroadcastChannel(GAMES_CHANNEL)
  channel.onmessage = (e: MessageEvent<GameSaved>) => {
    if (e.data.from !== WINDOW_ID) listener(e.data.gameId)
  }
  return () => channel.close()
}

// ---- Файлы ----

export function getMedia(id: string) {
  return db.media.get(id)
}

export function saveMedia(file: MediaFile) {
  return db.media.put(file)
}

export const MAX_FILE_MB = 200

// Какой это файл — по его типу, а если браузер тип не определил, то по расширению
function mediaTypeOf(file: File): MediaType | null {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (file.type === 'image/gif' || ext === 'gif') return 'gif'
  if (file.type.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'svg'].includes(ext)) return 'image'
  if (file.type.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) return 'audio'
  if (file.type.startsWith('video/') || ['mp4', 'webm', 'mov'].includes(ext)) return 'video'
  return null
}

// Положить файл с компьютера в хранилище. Возвращает ссылку, которую сохраняем в игре.
// Если файл не подходит — ошибка с понятным текстом для пользователя.
export async function addMediaFile(file: File): Promise<MediaRef> {
  const type = mediaTypeOf(file)
  if (!type) throw new Error(`«${file.name}» — не картинка, не музыка и не видео. Такой файл добавить нельзя.`)
  if (file.size > MAX_FILE_MB * 1024 * 1024) {
    throw new Error(
      `«${file.name}» больше ${MAX_FILE_MB} МБ. Сожмите файл (для видео подойдёт программа HandBrake) и попробуйте снова.`,
    )
  }
  const ref: MediaRef = { id: crypto.randomUUID(), type, name: file.name }
  await db.media.put({ ...ref, blob: file })
  return ref
}

// Удалить файл из хранилища, если на него больше не ссылается ни одна игра
export async function deleteMediaIfUnused(id: string) {
  const games = await db.games.toArray()
  if (!games.some((game) => JSON.stringify(game).includes(id))) await db.media.delete(id)
}

// ---- Сохранность хранилища ----

// Попросить браузер не стирать игры сам, когда на диске мало места. true — браузер обещал не стирать.
// Chrome решает сам и молча, Firefox может спросить разрешение.
export async function protectStorage(): Promise<boolean> {
  try {
    if (await navigator.storage?.persisted?.()) return true
    return (await navigator.storage?.persist?.()) ?? false
  } catch {
    return false
  }
}

// Сколько места занимают игры и файлы этого сайта, байт (null — браузер не говорит)
export async function storageUsed(): Promise<number | null> {
  try {
    return (await navigator.storage?.estimate?.())?.usage ?? null
  } catch {
    return null
  }
}
