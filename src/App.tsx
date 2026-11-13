import { useState } from 'react'
import Board from './components/Board'
import { demoGame } from './data/demoGame'
import type { Game } from './types'

export default function App() {
  const [game, setGame] = useState<Game>(demoGame)
  const round = game.rounds[0]

  // Пока клик просто отмечает вопрос сыгранным. Экран вопроса добавим следующим шагом.
  function markPlayed(categoryId: string, questionId: string) {
    setGame((g) => ({
      ...g,
      rounds: g.rounds.map((r) =>
        r.id !== round.id
          ? r
          : {
              ...r,
              categories: r.categories.map((c) =>
                c.id !== categoryId
                  ? c
                  : { ...c, questions: c.questions.map((q) => (q.id === questionId ? { ...q, played: true } : q)) },
              ),
            },
      ),
    }))
  }

  const played = round.categories.flatMap((c) => c.questions).filter((q) => q.played).length
  const total = round.categories.flatMap((c) => c.questions).length

  return (
    <div className="flex min-h-screen flex-col gap-6 bg-bg px-12 py-10 text-white">
      <header className="flex items-center justify-between">
        <span className="font-display text-2xl">{game.title.toUpperCase()}</span>
        <span className="font-display text-2xl">{round.title.toUpperCase()}</span>
        <div className="flex items-center gap-4">
          <span className="text-lg text-muted">
            {played} / {total}
          </span>
          <button
            type="button"
            onClick={() => setGame(demoGame)}
            className="h-11 rounded-lg border border-line px-4 text-sm hover:bg-cell"
          >
            Сбросить табло
          </button>
        </div>
      </header>

      <Board round={round} onCellClick={markPlayed} />
    </div>
  )
}
