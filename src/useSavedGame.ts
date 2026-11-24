import { useEffect, useRef, useState } from 'react'
import { deleteMediaIfUnused, getGame, onGameSavedElsewhere, saveGame } from './db'
import type { Game } from './types'

// Игра, которая сама сохраняется в хранилище после каждой правки (для редактора и экрана команд).
//   game        — текущая версия игры
//   change(f)   — изменить игру: f получает игру и возвращает новую
//   saved       — всё ли уже сохранено (для надписи «Все изменения сохранены»)
//   dropMedia   — файлы, убранные из игры: после сохранения удалим их, если они больше никому не нужны
// Если эту же игру сохранило другое окно (пульт поменял оформление, вторая вкладка редактора),
// берём свежую версию — иначе следующая правка здесь вернула бы старое.
export function useSavedGame(initialGame: Game) {
  const [game, setGame] = useState(initialGame)
  const [saved, setSaved] = useState(true)
  const removedMedia = useRef<string[]>([])
  const fromStorage = useRef(initialGame) // эта версия уже лежит в хранилище — сохранять её не нужно
  const savedRef = useRef(saved) // для слушателя других окон: есть ли несохранённая правка
  useEffect(() => {
    savedRef.current = saved
  }, [saved])

  useEffect(() => {
    if (game === fromStorage.current) return // ничего не меняли или только что взяли из хранилища
    let cancelled = false
    saveGame(game).then(async () => {
      for (const id of removedMedia.current.splice(0)) await deleteMediaIfUnused(id)
      if (!cancelled) setSaved(true)
    })
    return () => {
      cancelled = true
    }
  }, [game])

  useEffect(
    () =>
      onGameSavedElsewhere(async (id) => {
        if (id !== initialGame.id || !savedRef.current) return // своя правка ещё сохраняется — она и будет последней
        const fresh = await getGame(id)
        if (!fresh || !savedRef.current) return
        fromStorage.current = fresh
        setGame(fresh)
      }),
    [initialGame.id],
  )

  function change(update: (g: Game) => Game) {
    savedRef.current = false
    setSaved(false)
    setGame(update)
  }

  function dropMedia(...ids: string[]) {
    removedMedia.current.push(...ids)
  }

  return { game, change, saved, dropMedia }
}
