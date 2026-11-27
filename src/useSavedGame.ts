import { useEffect, useRef, useState } from 'react'
import { deleteMediaIfUnused, getGame, onGameSavedElsewhere, saveGame } from './db'
import { storageErrorText } from './storageError'
import type { Game } from './types'

// Игра, которая сама сохраняется в хранилище после каждой правки (для редактора и экрана команд).
//   game        — текущая версия игры
//   change(f)   — изменить игру: f получает игру и возвращает новую
//   saved       — всё ли уже сохранено (для надписи «Все изменения сохранены»)
//   error       — браузер не записал игру (нет места, сайт обновился в другой вкладке…): текст для плашки
//   retry()     — записать ещё раз
//   flush()     — дождаться, пока последняя правка запишется (перед сохранением копии файлом)
//   dropMedia   — файлы, убранные из игры: после сохранения удалим их, если они больше никому не нужны
// Если эту же игру сохранило другое окно (пульт поменял оформление, вторая вкладка редактора),
// берём свежую версию — иначе следующая правка здесь вернула бы старое.
// Пока что-то не записалось, браузер переспросит перед закрытием вкладки.
export function useSavedGame(initialGame: Game) {
  const [game, setGame] = useState(initialGame)
  const [saved, setSaved] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0) // «Попробовать снова» — записать ту же версию ещё раз
  const removedMedia = useRef<string[]>([])
  const fromStorage = useRef(initialGame) // эта версия уже лежит в хранилище — сохранять её не нужно
  const savedRef = useRef(saved) // для слушателя других окон: есть ли несохранённая правка
  const pending = useRef<Promise<unknown>>(Promise.resolve()) // последняя запись
  useEffect(() => {
    savedRef.current = saved
  }, [saved])

  useEffect(() => {
    if (game === fromStorage.current) return // ничего не меняли или только что взяли из хранилища
    let cancelled = false
    const write = saveGame(game).then(
      async () => {
        for (const id of removedMedia.current.splice(0)) await deleteMediaIfUnused(id)
        if (cancelled) return
        setSaved(true)
        setError(null)
      },
      (e: unknown) => {
        console.error('Игра не сохранилась', e)
        if (!cancelled) setError(storageErrorText(e))
      },
    )
    pending.current = write
    return () => {
      cancelled = true
    }
  }, [game, attempt])

  // Не всё записалось — браузер спросит «Покинуть сайт?», чтобы правка не пропала
  useEffect(() => {
    if (saved && !error) return
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = '' // старые браузеры показывают вопрос только так
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [saved, error])

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

  function retry() {
    setError(null)
    setAttempt((n) => n + 1)
  }

  async function flush() {
    await pending.current
  }

  function dropMedia(...ids: string[]) {
    removedMedia.current.push(...ids)
  }

  return { game, change, saved, error, retry, flush, dropMedia }
}
