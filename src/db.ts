import Dexie, { type EntityTable } from 'dexie'
import { demoGame } from './data/demoGame'
import { demoMediaFiles } from './data/demoMedia'
import type { Content, Game, MediaFile, MediaRef, MediaType, Question } from './types'

// Хранилище в браузере (IndexedDB через библиотеку Dexie):
//   games — игры (вопросы, команды, оформление); файлы в них — только ссылками MediaRef;
//   media — сами файлы: картинки, музыка, видео.
// Так замена картинки не трогает игру, а игра не раздувается от тяжёлых файлов.

const db = new Dexie('svoya-igra') as Dexie & {
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
  return db.games.orderBy('updatedAt').reverse().toArray()
}

export function getGame(id: string) {
  return db.games.get(id)
}

export function saveGame(game: Game) {
  return db.games.put({ ...game, updatedAt: Date.now() })
}

// Поменять в сохранённой игре только часть (например, оформление), не трогая остальное.
// Пульт так запоминает вид команд, не записывая в хранилище счёт текущей партии.
export async function updateStoredGame(id: string, change: (g: Game) => Game) {
  const game = await db.games.get(id)
  if (game) await db.games.put(change(game))
}

export function deleteGame(id: string) {
  return db.games.delete(id)
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
