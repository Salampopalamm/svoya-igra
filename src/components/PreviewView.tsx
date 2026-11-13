import type { Question } from '../types'

type Props = {
  categoryTitle: string
  question: Question
  onClose: () => void
}

// Предпросмотр вопроса — существует только на пульте, в зал никогда не попадает.
export default function PreviewView({ categoryTitle, question, onClose }: Props) {
  return (
    <div className="flex flex-1 flex-col gap-6 rounded-xl border border-line bg-cell p-6">
      <div className="rounded-lg border border-dashed border-white px-4 py-3 text-sm font-semibold tracking-wide">
        ПРЕДПРОСМОТР · ЗАЛ НЕ ВИДИТ
      </div>
      <span className="font-display text-xl">
        {categoryTitle.toUpperCase()} · {question.value}
      </span>
      <p className="text-3xl leading-snug font-semibold">{question.prompt.text}</p>
      <div className="rounded-xl border-2 border-dashed border-muted p-5">
        <div className="text-sm font-semibold tracking-widest text-muted">ОТВЕТ</div>
        <div className="mt-2 text-2xl font-semibold">{question.answer.text}</div>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="mt-auto h-12 self-start rounded-lg border border-white px-6 hover:bg-white hover:text-black"
      >
        Закрыть предпросмотр · Esc
      </button>
    </div>
  )
}
