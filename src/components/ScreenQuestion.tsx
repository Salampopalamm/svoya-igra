import type { Question } from '../types'

type Props = {
  categoryTitle: string
  question: Question
  showAnswer: boolean
  answeringTeamName?: string
}

// Вопрос на экране зала: крупный текст, ответ — только когда ведущий его открыл.
export default function ScreenQuestion({ categoryTitle, question, showAnswer, answeringTeamName }: Props) {
  return (
    <div className="flex flex-1 flex-col justify-center gap-10">
      <div className="flex items-center justify-between gap-6">
        <span className="font-display text-3xl">
          {categoryTitle.toUpperCase()} · <span className="rounded-lg bg-white px-4 py-1 text-black">{question.value}</span>
        </span>
        {answeringTeamName && (
          <span className="rounded-xl border-[3px] border-white bg-cell px-5 py-3 text-2xl font-semibold">
            Отвечает: {answeringTeamName}
          </span>
        )}
      </div>
      <p className="text-6xl leading-tight font-semibold">{question.prompt.text}</p>
      {showAnswer && (
        <div className="rounded-xl border-2 border-white p-8">
          <div className="text-sm font-semibold tracking-widest text-muted">ОТВЕТ</div>
          <div className="mt-2 text-5xl font-semibold">{question.answer.text}</div>
        </div>
      )}
    </div>
  )
}
