import type { Question, Team } from '../types'

type Props = {
  categoryTitle: string
  question: Question
  showAnswer: boolean
  teams: Team[]
  onShowAnswer: () => void
  onCorrect: (teamId: string) => void
  onWrong: (teamId: string) => void
  onClose: () => void
}

// Экран открытого вопроса: текст, ответ по кнопке, «Верно / Неверно» для каждой команды.
export default function QuestionView({
  categoryTitle,
  question,
  showAnswer,
  teams,
  onShowAnswer,
  onCorrect,
  onWrong,
  onClose,
}: Props) {
  return (
    <div className="flex flex-1 flex-col gap-8">
      <div className="flex items-center justify-between gap-4">
        <span className="font-display text-2xl">
          {categoryTitle.toUpperCase()} · <span className="rounded-lg bg-white px-4 py-1 text-black">{question.value}</span>
        </span>
        <button
          type="button"
          onClick={onClose}
          className="h-11 rounded-lg border border-line px-4 text-sm hover:bg-cell"
        >
          Закрыть вопрос · Esc
        </button>
      </div>

      <p className="text-5xl leading-tight font-semibold">{question.prompt.text}</p>

      {showAnswer ? (
        <div className="rounded-xl border-2 border-dashed border-muted p-6">
          <div className="text-sm font-semibold tracking-widest text-muted">ОТВЕТ</div>
          <div className="mt-2 text-4xl font-semibold">{question.answer.text}</div>
        </div>
      ) : (
        <button
          type="button"
          onClick={onShowAnswer}
          className="h-12 self-start rounded-lg border border-white px-6 text-lg hover:bg-white hover:text-black"
        >
          Показать ответ · Пробел
        </button>
      )}

      <div
        className="mt-auto grid gap-3"
        style={{ gridTemplateColumns: `repeat(${Math.min(teams.length, 5)}, 1fr)` }}
      >
        {teams.map((team) => (
          <div key={team.id} className="flex flex-col gap-2 rounded-xl border border-line p-4">
            <span className="font-semibold">{team.name}</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onCorrect(team.id)}
                className="h-11 flex-1 rounded-lg bg-white font-semibold text-black hover:opacity-90"
              >
                Верно +{question.value}
              </button>
              <button
                type="button"
                onClick={() => onWrong(team.id)}
                className="h-11 flex-1 rounded-lg border border-white hover:bg-cell"
              >
                Неверно −{question.value}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
