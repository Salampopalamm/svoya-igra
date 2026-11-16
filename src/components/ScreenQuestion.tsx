import { formatTime, type TimerState } from '../live'
import type { Question, Team } from '../types'
import { useTimeLeft } from '../useTimeLeft'
import { MediaView, SlideView } from './MediaView'
import TeamIcon from './TeamIcon'

type Props = {
  categoryTitle: string
  question: Question
  slideIndex: number // какой слайд показывать
  showAnswer: boolean
  answeringTeam?: Team
  stealing: boolean // основная команда ошиблась — идёт перехват
  canSteal: boolean // перехватить ещё есть кому (не все ошиблись)
  timer: TimerState | null
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
export default function ScreenQuestion({
  categoryTitle,
  question,
  slideIndex,
  showAnswer,
  answeringTeam,
  stealing,
  canSteal,
  timer,
}: Props) {
  const slide = question.slides[slideIndex] ?? question.slides[0] ?? {}
  // Плашка справа: кто отвечает (со значком команды), или приглашение перехватить вопрос
  const badge = answeringTeam ? (
    <>
      <TeamIcon team={answeringTeam} size={36} />
      {stealing ? 'Перехват' : 'Отвечает'}: {answeringTeam.name}
    </>
  ) : stealing && canSteal && !showAnswer ? (
    'Перехват! Кто ответит?'
  ) : null

  return (
    <div className="flex flex-1 flex-col justify-center gap-10">
      <div className="flex items-center justify-between gap-6">
        <span className="font-display text-3xl">
          {categoryTitle.toUpperCase()} · <span className="rounded-lg bg-accent px-4 py-1 text-on-accent">{question.value}</span>
        </span>
        <div className="flex items-start gap-6">
          {badge && (
            <span className="flex items-center gap-3 rounded-xl border-[3px] border-accent bg-cell px-5 py-3 text-2xl font-semibold">
              {badge}
            </span>
          )}
          {timer && !showAnswer && <HallTimer timer={timer} />}
        </div>
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
