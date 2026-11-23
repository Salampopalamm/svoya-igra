import { formatTime, type TimerState } from '../live'
import type { Content, Question } from '../types'
import { useTimeLeft } from '../useTimeLeft'
import { ContentMedia } from './MediaView'
import { LETTERS } from '../tree'

type Props = {
  title?: string // заголовок над вопросом — только в финале («Финал · тема»)
  question: Question
  slideIndex: number // какой слайд показывать
  showAnswer: boolean
  timer: TimerState | null
  // Ветвящийся вопрос: вместо слайда — текущий шаг дерева, его варианты (без баллов) и итог ветки
  step?: { content: Content; answer?: Content; options: string[]; summary?: string }
}

// Таймер в зале: крупные цифры и полоса, которая тает. Последние 5 секунд — инверсия, в конце — «ВРЕМЯ!».
function HallTimer({ timer }: { timer: TimerState }) {
  const left = useTimeLeft(timer)
  const over = left === 0
  const urgent = left <= 5000
  return (
    <div className="flex flex-col items-end gap-2">
      <span
        className={`rounded-xl px-5 py-2 font-display text-5xl tabular-nums ${urgent ? 'bg-white text-black' : 'border-[3px] border-white'}`}
      >
        {over ? 'ВРЕМЯ!' : formatTime(left)}
      </span>
      <div className="h-2 w-48 overflow-hidden rounded-full bg-cell" aria-hidden>
        <div className="h-full bg-white" style={{ width: `${(left / (timer.totalSec * 1000)) * 100}%` }} />
      </div>
    </div>
  )
}

// Вопрос на экране зала: текущий слайд крупно, ответ — только когда ведущий его открыл.
// Категории, цены и плашки «Отвечает» здесь нет (решение владельца): всё место — тексту и картинкам.
// Кто отвечает, видно в полосе команд (подпись «ОТВЕЧАЕТ» / «ПЕРЕХВАТ»).
export default function ScreenQuestion({ title, question, slideIndex, showAnswer, timer, step }: Props) {
  const slide = step?.content ?? question.slides[slideIndex] ?? question.slides[0] ?? {}
  const answer = step ? step.answer : question.answer
  const showTimer = !!timer && !showAnswer
  // Когда в ответе своя картинка, картинка вопроса уходит — на экране крупно только ответ.
  // Высоту картинок меняет ползунок «Картинки и видео» (--media-scale)
  const media = showAnswer && answer?.media ? {} : slide
  const height = showAnswer ? 45 : 65

  return (
    <div className="flex min-h-0 flex-1 flex-col justify-center gap-6">
      {title && <span className="font-display text-3xl">{title.toUpperCase()}</span>}
      {(slide.text || showTimer) && (
        <div className="flex items-start justify-between gap-6">
          {slide.text ? (
            <p className={`leading-tight font-semibold ${showAnswer || slide.media ? 'text-4xl' : 'text-6xl'}`}>{slide.text}</p>
          ) : (
            <span />
          )}
          {showTimer && timer && <HallTimer timer={timer} />}
        </div>
      )}
      <ContentMedia
        content={media}
        mode="hall"
        className={
          showAnswer ? 'max-h-[calc(45vh*var(--media-scale,1))] self-center' : 'max-h-[calc(65vh*var(--media-scale,1))] self-center'
        }
        gridHeight={`calc(${height}vh * var(--media-scale, 1))`}
      />
      {step && step.options.length > 0 && (
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(step.options.length, 2)}, minmax(0, 1fr))` }}>
          {step.options.map((label, i) => (
            <div key={i} className="flex items-center gap-5 rounded-xl bg-cell px-6 py-4 text-4xl font-semibold">
              <span className="font-display text-accent">{LETTERS[i]}</span>
              {label}
            </div>
          ))}
        </div>
      )}
      {step?.summary && (
        <div className="self-start rounded-xl border-[3px] border-accent bg-cell px-8 py-4 text-4xl font-semibold">{step.summary}</div>
      )}
      {showAnswer && answer && (answer.text || answer.media) && (
        <div className="flex flex-col gap-4 rounded-xl border-2 border-white p-6">
          <div className="text-sm font-semibold tracking-widest text-muted">ОТВЕТ</div>
          {answer.text && <div className="text-5xl font-semibold">{answer.text}</div>}
          <ContentMedia
            content={answer}
            mode="hall"
            className="max-h-[calc(55vh*var(--media-scale,1))] self-center"
            gridHeight="calc(55vh * var(--media-scale, 1))"
          />
        </div>
      )}
    </div>
  )
}
