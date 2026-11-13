import type { Question } from '../types'
import { MediaView, SlideView } from './MediaView'

type Props = {
  categoryTitle: string
  question: Question
  slideIndex: number // какой слайд показывать
  showAnswer: boolean
  answeringTeamName?: string
}

// Вопрос на экране зала: текущий слайд крупно, ответ — только когда ведущий его открыл.
export default function ScreenQuestion({ categoryTitle, question, slideIndex, showAnswer, answeringTeamName }: Props) {
  const slide = question.slides[slideIndex] ?? question.slides[0] ?? {}

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
      <SlideView
        slide={slide}
        mode="hall"
        textClass={slide.media ? 'text-4xl' : 'text-6xl'}
        mediaClass={showAnswer ? 'max-h-[35vh] self-center' : 'max-h-[55vh] self-center'}
      />
      {showAnswer && (
        <div className="rounded-xl border-2 border-white p-8">
          <div className="text-sm font-semibold tracking-widest text-muted">ОТВЕТ</div>
          <div className="mt-2 text-5xl font-semibold">{question.answer.text}</div>
          {question.answer.media && <MediaView media={question.answer.media} mode="hall" className="mt-4 max-h-[30vh]" />}
        </div>
      )}
    </div>
  )
}
