import { formatTime, type TimerState } from '../live'
import { contentMedia } from '../pictures'
import type { Content, PlaceTarget, Placement, Question } from '../types'
import { useTimeLeft } from '../useTimeLeft'
import { ContentMedia } from './MediaView'
import PlacedSlide from './PlacedSlide'
import { Resizable } from './Resizable'
import { LETTERS } from '../tree'

type Props = {
  title?: string // заголовок над вопросом — только в финале («Финал · тема»)
  question: Question
  slideIndex: number // какой слайд показывать
  showAnswer: boolean
  timer: TimerState | null
  // Ветвящийся вопрос: вместо слайда — текущий шаг дерева, его варианты (без баллов) и итог ветки
  step?: { nodeId: string; content: Content; answer?: Content; options: string[]; summary?: string }
  // Своя расстановка: arrange — показать то, что на экране (слайд или ответ), рамками, даже если расстановки ещё нет;
  // onPlace — объекты можно двигать и растягивать мышью (редактор; зал в режиме «Растянуть»)
  arrange?: boolean
  onPlace?: (target: PlaceTarget, place: Placement) => void
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

// Таймер с размером из ползунка «Таймер» (и уголком в режиме «Растянуть»)
function SizedTimer({ timer }: { timer: TimerState }) {
  return (
    <Resizable id="timer" className="shrink-0">
      <div className="[zoom:var(--timer-scale,1)]">
        <HallTimer timer={timer} />
      </div>
    </Resizable>
  )
}

// Вопрос на экране зала: текущий слайд крупно, ответ — только когда ведущий его открыл.
// Категории, цены и плашки «Отвечает» здесь нет (решение владельца): всё место — тексту и картинкам.
// Кто отвечает, видно в полосе команд (подпись «ОТВЕЧАЕТ» / «ПЕРЕХВАТ»).
// Размеры текста, картинок и таймера — ползунки (CSS-переменные --text-scale, --media-scale, --timer-scale).
// Слайд со своей расстановкой (Content.place) рисует PlacedSlide: там размер задаёт рамка, а не ползунки.
export default function ScreenQuestion({ title, question, slideIndex, showAnswer, timer, step, arrange, onPlace }: Props) {
  const slide = step?.content ?? question.slides[slideIndex] ?? question.slides[0] ?? {}
  const answer = step ? step.answer : question.answer
  const showTimer = !!timer && !showAnswer
  const slideTarget: PlaceTarget = step ? { kind: 'node', nodeId: step.nodeId, answer: false } : { kind: 'slide', index: slideIndex }
  const answerTarget: PlaceTarget = step ? { kind: 'node', nodeId: step.nodeId, answer: true } : { kind: 'answer' }

  // Что показываем своей расстановкой: открытый ответ (если расставлен) или слайд
  const placedAnswer = showAnswer && !!answer && (!!answer.place || !!arrange)
  const placedSlide = !placedAnswer && (!!slide.place || !!arrange)

  const titleRow = title && <span className="font-display text-3xl">{title.toUpperCase()}</span>
  const answerBlock = showAnswer && answer && (answer.text || answer.media) && (
    <div className="flex flex-col gap-4 rounded-xl border-2 border-white p-6">
      <div className="text-sm font-semibold tracking-widest text-muted">ОТВЕТ</div>
      {answer.text && <div className="text-5xl font-semibold [zoom:var(--text-scale,1)]">{answer.text}</div>}
      <ContentMedia
        content={answer}
        mode="hall"
        className="max-h-[calc(55vh*var(--media-scale,1))] self-center"
        gridHeight="calc(55vh * var(--media-scale, 1))"
      />
    </div>
  )
  const branchParts = (
    <>
      {step && step.options.length > 0 && (
        <div
          className="grid gap-4 [zoom:var(--text-scale,1)]"
          style={{ gridTemplateColumns: `repeat(${Math.min(step.options.length, 2)}, minmax(0, 1fr))` }}
        >
          {step.options.map((label, i) => (
            <div key={i} className="flex items-center gap-5 rounded-xl bg-cell px-6 py-4 text-4xl font-semibold">
              <span className="font-display text-accent">{LETTERS[i]}</span>
              {label}
            </div>
          ))}
        </div>
      )}
      {step?.summary && (
        <div className="self-start rounded-xl border-[3px] border-accent bg-cell px-8 py-4 text-4xl font-semibold [zoom:var(--text-scale,1)]">
          {step.summary}
        </div>
      )}
    </>
  )

  // Ответ со своей расстановкой — во весь экран вопроса
  if (placedAnswer && answer) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-6">
        {titleRow}
        <PlacedSlide content={answer} label="ОТВЕТ" onPlace={onPlace && ((place) => onPlace(answerTarget, place))} />
      </div>
    )
  }

  // Слайд со своей расстановкой; ответ без расстановки появляется под ним обычным блоком
  if (placedSlide) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-6">
        {titleRow}
        <PlacedSlide
          content={slide}
          overlay={showTimer && timer ? <SizedTimer timer={timer} /> : undefined}
          onPlace={onPlace && ((place) => onPlace(slideTarget, place))}
        />
        {branchParts}
        {answerBlock}
      </div>
    )
  }

  // Обычная раскладка: текст сверху, картинки под ним.
  // Когда в ответе своя картинка, картинка вопроса уходит — на экране крупно только ответ.
  const media = showAnswer && answer?.media ? {} : slide
  const height = showAnswer ? 45 : 65
  const count = contentMedia(media).length

  return (
    <div className="flex min-h-0 flex-1 flex-col justify-center gap-6">
      {titleRow}
      {(slide.text || showTimer) && (
        <div className="flex items-start justify-between gap-6">
          {slide.text ? (
            <Resizable id="text" className="min-w-0 flex-1">
              <p className={`leading-tight font-semibold [zoom:var(--text-scale,1)] ${showAnswer || slide.media ? 'text-4xl' : 'text-6xl'}`}>
                {slide.text}
              </p>
            </Resizable>
          ) : (
            <span />
          )}
          {showTimer && timer && <SizedTimer timer={timer} />}
        </div>
      )}
      {count > 0 && (
        <Resizable id="media" className={count > 1 ? 'w-full' : 'flex justify-center self-center'}>
          <ContentMedia
            content={media}
            mode="hall"
            className={showAnswer ? 'max-h-[calc(45vh*var(--media-scale,1))]' : 'max-h-[calc(65vh*var(--media-scale,1))]'}
            gridHeight={`calc(${height}vh * var(--media-scale, 1))`}
          />
        </Resizable>
      )}
      {branchParts}
      {answerBlock}
    </div>
  )
}
