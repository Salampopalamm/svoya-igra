import type { Question } from '../types'
import { ContentMedia, SlideView } from './MediaView'

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
      {question.slides.map((slide, i) => (
        <div key={i} className="flex flex-col gap-2">
          {question.slides.length > 1 && (
            <span className="text-sm font-semibold tracking-widest text-muted">
              СЛАЙД {i + 1} ИЗ {question.slides.length}
            </span>
          )}
          <SlideView slide={slide} mode="host" textClass="text-3xl" mediaClass="max-h-[35vh] self-start" />
        </div>
      ))}
      <div className="rounded-xl border-2 border-dashed border-muted p-5">
        <div className="text-sm font-semibold tracking-widest text-muted">ОТВЕТ</div>
        <div className="mt-2 text-2xl font-semibold">{question.answer.text}</div>
        <ContentMedia content={question.answer} mode="host" className="mt-3 max-h-48" gridHeight="12rem" />
      </div>
      {(question.timerSec || question.hostNote) && (
        <div className="flex flex-col gap-1 rounded-xl border border-line p-5">
          {question.timerSec && <div className="text-muted">Таймер: {question.timerSec} сек</div>}
          {question.hostNote && <p className="text-lg whitespace-pre-line">Заметка: {question.hostNote}</p>}
        </div>
      )}
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
