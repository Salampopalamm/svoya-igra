import { useEffect, useState } from 'react'
import Board from './components/Board'
import QuestionView from './components/QuestionView'
import Scoreboard from './components/Scoreboard'
import { demoGame } from './data/demoGame'
import type { Game } from './types'

// Какой вопрос сейчас открыт (null — показываем табло)
type Current = { categoryId: string; questionId: string } | null

export default function App() {
  const [game, setGame] = useState<Game>(demoGame)
  const [current, setCurrent] = useState<Current>(null)
  const [showAnswer, setShowAnswer] = useState(false)

  const round = game.rounds[0]
  const currentCategory = current ? round.categories.find((c) => c.id === current.categoryId) : undefined
  const currentQuestion = currentCategory?.questions.find((q) => q.id === current?.questionId)

  // Отметить вопрос сыгранным
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

  // Прибавить (или отнять) очки команде
  function addScore(teamId: string, delta: number) {
    setGame((g) => ({
      ...g,
      teams: g.teams.map((t) => (t.id === teamId ? { ...t, score: t.score + delta } : t)),
    }))
  }

  function openQuestion(categoryId: string, questionId: string) {
    setCurrent({ categoryId, questionId })
    setShowAnswer(false)
  }

  // Закрыть вопрос: он становится сыгранным, возвращаемся к табло
  function closeQuestion() {
    if (current) markPlayed(current.categoryId, current.questionId)
    setCurrent(null)
    setShowAnswer(false)
  }

  // Верный ответ: очки команде и сразу назад к табло
  function handleCorrect(teamId: string) {
    if (!currentQuestion) return
    addScore(teamId, currentQuestion.value)
    closeQuestion()
  }

  // Неверный ответ: минус очки, вопрос остаётся открытым — могут ответить другие
  function handleWrong(teamId: string) {
    if (!currentQuestion) return
    addScore(teamId, -currentQuestion.value)
  }

  function resetGame() {
    setGame(demoGame)
    setCurrent(null)
    setShowAnswer(false)
  }

  // Горячие клавиши, пока открыт вопрос: Пробел — ответ, Esc — закрыть
  useEffect(() => {
    if (!current) return
    function onKey(e: KeyboardEvent) {
      if (e.key === ' ') {
        e.preventDefault()
        setShowAnswer(true)
      }
      if (e.key === 'Escape') closeQuestion()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const allQuestions = round.categories.flatMap((c) => c.questions)
  const played = allQuestions.filter((q) => q.played).length

  return (
    <div className="flex min-h-screen flex-col gap-6 bg-bg px-12 py-10 text-white">
      <header className="flex items-center justify-between">
        <span className="font-display text-2xl">{game.title.toUpperCase()}</span>
        <span className="font-display text-2xl">{round.title.toUpperCase()}</span>
        <div className="flex items-center gap-4">
          <span className="text-lg text-muted">
            {played} / {allQuestions.length}
          </span>
          <button
            type="button"
            onClick={resetGame}
            className="h-11 rounded-lg border border-line px-4 text-sm hover:bg-cell"
          >
            Начать заново
          </button>
        </div>
      </header>

      {currentCategory && currentQuestion ? (
        <QuestionView
          categoryTitle={currentCategory.title}
          question={currentQuestion}
          showAnswer={showAnswer}
          teams={game.teams}
          onShowAnswer={() => setShowAnswer(true)}
          onCorrect={handleCorrect}
          onWrong={handleWrong}
          onClose={closeQuestion}
        />
      ) : (
        <Board round={round} onCellClick={openQuestion} />
      )}

      <Scoreboard teams={game.teams} />
    </div>
  )
}
