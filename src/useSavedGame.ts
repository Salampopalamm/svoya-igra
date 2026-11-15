import { useEffect, useRef, useState } from 'react'
import { deleteMediaIfUnused, saveGame } from './db'
import type { Game } from './types'

// Игра, которая сама сохраняется в хранилище после каждой правки (для редактора и экрана команд).
//   game        — текущая версия игры
//   change(f)   — изменить игру: f получает игру и возвращает новую
//   saved       — всё ли уже сохранено (для надписи «Все изменения сохранены»)
//   dropMedia   — файлы, убранные из игры: после сохранения удалим их, если они больше никому не нужны
export function useSavedGame(initialGame: Game) {
  const [game, setGame] = useState(initialGame)
  const [saved, setSaved] = useState(true)
  const removedMedia = useRef<string[]>([])

  useEffect(() => {
    if (game === initialGame) return // ничего ещё не меняли
    let cancelled = false
    saveGame(game).then(async () => {
      for (const id of removedMedia.current.splice(0)) await deleteMediaIfUnused(id)
      if (!cancelled) setSaved(true)
    })
    return () => {
      cancelled = true
    }
  }, [game, initialGame])

  function change(update: (g: Game) => Game) {
    setSaved(false)
    setGame(update)
  }

  function dropMedia(...ids: string[]) {
    removedMedia.current.push(...ids)
  }

  return { game, change, saved, dropMedia }
}
