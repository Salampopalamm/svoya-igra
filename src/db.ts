import Dexie, { type EntityTable } from 'dexie'
import { demoGame } from './data/demoGame'
import type { Game } from './types'

// Хранилище игр в браузере (IndexedDB через библиотеку Dexie).
// Позже сюда же добавим таблицу для картинок, видео и звуков.

const db = new Dexie('svoya-igra') as Dexie & {
  games: EntityTable<Game, 'id'>
}

db.version(1).stores({
  games: 'id, updatedAt', // ключ — id, сортируем по дате изменения
})

// Все игры, новые сверху. Если игр нет — кладём тестовую, чтобы было с чем попробовать.
export async function listGames(): Promise<Game[]> {
  if ((await db.games.count()) === 0) {
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

export function deleteGame(id: string) {
  return db.games.delete(id)
}
