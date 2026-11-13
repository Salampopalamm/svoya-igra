import { useEffect, useState } from 'react'
import Board from '../components/Board'
import ScreenQuestion from '../components/ScreenQuestion'
import Scoreboard from '../components/Scoreboard'
import { CHANNEL, type LiveState, type Message } from '../live'

// Экран зала: только показывает то, что прислал пульт. Ответ виден, лишь когда ведущий его открыл.
export default function ScreenApp() {
  const [live, setLive] = useState<LiveState | null>(null)

  useEffect(() => {
    const channel = new BroadcastChannel(CHANNEL)
    channel.onmessage = (e: MessageEvent<Message>) => {
      if (e.data.type === 'state') setLive(e.data.state)
    }
    channel.postMessage({ type: 'hello' } satisfies Message) // попросить у пульта текущее состояние
    return () => channel.close()
  }, [])

  if (!live) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg text-2xl text-muted">
        Ожидание пульта ведущего…
      </div>
    )
  }

  const { game, current, slideIndex, showAnswer, answeringTeamId, screenHidden } = live

  // Заставка: ведущий скрыл экран
  if (screenHidden) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-bg text-white">
        <span className="font-display text-6xl">СВОЯ ИГРА</span>
        <span className="text-2xl text-muted">{game.title}</span>
      </div>
    )
  }

  const round = game.rounds[0]
  const category = current ? round.categories.find((c) => c.id === current.categoryId) : undefined
  const question = category?.questions.find((q) => q.id === current?.questionId)
  const answeringTeam = game.teams.find((t) => t.id === answeringTeamId)

  return (
    <div className="flex min-h-screen flex-col gap-6 bg-bg px-12 py-10 text-white">
      <header className="flex items-center justify-between">
        <span className="font-display text-2xl">{game.title.toUpperCase()}</span>
        <span className="font-display text-2xl">{round.title.toUpperCase()}</span>
        <span className="text-sm text-muted">F11 — во весь экран</span>
      </header>

      {category && question ? (
        <ScreenQuestion
          categoryTitle={category.title}
          question={question}
          slideIndex={slideIndex}
          showAnswer={showAnswer}
          answeringTeamName={answeringTeam?.name}
        />
      ) : (
        <Board round={round} interactive={false} />
      )}

      <Scoreboard teams={game.teams} answeringTeamId={answeringTeamId} />
    </div>
  )
}
