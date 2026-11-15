import { useEffect, useState } from 'react'
import { deleteGame, deleteMediaIfUnused, listGames, saveGame } from '../db'
import { allQuestions, copyGame, mediaIdsOf } from '../game'
import type { Game } from '../types'

// Стартовый экран «Мои игры»: создать игру, открыть файл, список своих игр.
export default function LibraryApp() {
  const [games, setGames] = useState<Game[] | null>(null)

  function reload() {
    listGames().then(setGames)
  }

  useEffect(reload, [])

  async function remove(game: Game) {
    if (!window.confirm(`Удалить игру «${game.title}»? Это нельзя отменить.`)) return
    await deleteGame(game.id)
    // Файлы этой игры больше не нужны, если их не использует другая игра (например, её копия)
    for (const id of allQuestions(game).flatMap(mediaIdsOf)) await deleteMediaIfUnused(id)
    reload()
  }

  // Копия игры: удобно начать новую игру с готовой и поменять вопросы
  async function duplicate(game: Game) {
    await saveGame(copyGame(game))
    reload()
  }

  return (
    <div className="flex min-h-screen flex-col gap-8 bg-bg px-12 py-10 text-white">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-3xl">СВОЯ ИГРА</h1>
        <p className="text-muted">Соберите игру для своей компании или друзей. Ничего не нужно устанавливать.</p>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        <a href="#/new" className="flex flex-col gap-2 rounded-2xl bg-white p-6 text-black hover:opacity-90">
          <span className="text-xl font-bold">Быстрая игра</span>
          <span className="text-sm text-neutral-700">
            3 шага: название, вопросы, команды. Около 5 минут, если вопросы уже есть в таблице.
          </span>
        </a>
        <div className="flex flex-col gap-2 rounded-2xl border border-line bg-cell p-6 opacity-60">
          <span className="text-xl font-bold">Из шаблона</span>
          <span className="text-sm text-muted">Скоро</span>
        </div>
        <div className="flex flex-col gap-2 rounded-2xl border border-line bg-cell p-6 opacity-60">
          <span className="text-xl font-bold">Открыть файл игры</span>
          <span className="text-sm text-muted">Скоро</span>
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold tracking-widest text-muted">
          МОИ ИГРЫ{games ? ` · ${games.length}` : ''}
        </h2>

        {games === null && <span className="text-muted">Загрузка…</span>}

        {games?.map((game) => {
          const categories = game.rounds.reduce((n, r) => n + r.categories.length, 0)
          const questions = game.rounds.reduce(
            (n, r) => n + r.categories.reduce((m, c) => m + c.questions.length, 0),
            0,
          )
          const date = game.updatedAt ? new Date(game.updatedAt).toLocaleDateString('ru-RU') : ''

          return (
            <div
              key={game.id}
              className="flex flex-wrap items-center gap-4 rounded-xl border border-line px-5 py-4"
            >
              <div className="min-w-60 flex-1">
                <div className="text-lg font-semibold">{game.title}</div>
                <div className="text-sm text-muted">
                  {categories} категорий · {questions} вопросов{date ? ` · изменена ${date}` : ''}
                </div>
              </div>
              <a
                href={`#/play/${encodeURIComponent(game.id)}`}
                className="flex h-11 items-center rounded-lg bg-white px-5 font-semibold text-black hover:opacity-90"
              >
                Играть
              </a>
              <a
                href={`#/edit/${encodeURIComponent(game.id)}`}
                className="flex h-11 items-center rounded-lg border border-line px-4 hover:bg-cell"
              >
                Изменить
              </a>
              <button
                type="button"
                onClick={() => duplicate(game)}
                className="h-11 rounded-lg border border-line px-4 hover:bg-cell"
              >
                Дублировать
              </button>
              <button
                type="button"
                onClick={() => remove(game)}
                className="h-11 rounded-lg border border-line px-4 hover:bg-cell"
              >
                Удалить
              </button>
            </div>
          )
        })}

        <p className="text-sm text-muted">
          Игры хранятся в этом браузере. Позже появится «Отправить файлом» — чтобы передать игру на другой ноутбук.
        </p>
      </section>
    </div>
  )
}
