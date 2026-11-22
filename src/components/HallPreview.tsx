import { useEffect, useRef, useState } from 'react'
import { newTimer, pauseTimer, startTimer, type TimerState } from '../live'
import type { Question, Theme } from '../types'
import { VideoContext } from '../videoControl'
import { GameLogo, HallFrame } from './HallFrame'
import { MediaView } from './MediaView'
import ScreenQuestion from './ScreenQuestion'

type Props = {
  theme: Theme
  gameTitle: string
  roundTitle: string
  categoryTitle: string
  question: Question
  onClose: () => void
}

// Предпросмотр вопроса в редакторе: так его увидит зал — с оформлением игры, слайдами, ответом и таймером.
// Живёт только в этом окне: в зал и в ход партии не попадает.
// Клавиши как на пульте: ← / → — слайды, Пробел — ответ, T — таймер, Esc — закрыть.
export default function HallPreview({ theme, gameTitle, roundTitle, categoryTitle, question, onClose }: Props) {
  const [slideIndex, setSlideIndex] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [timer, setTimer] = useState<TimerState | null>(() => newTimer(question.timerSec))
  const closeRef = useRef<HTMLButtonElement>(null)

  // Ветвящийся вопрос листается по шагам дерева, обычный — по слайдам
  const tree = question.tree
  const count = tree ? tree.nodes.length : question.slides.length
  const node = tree?.nodes[slideIndex]
  const slide = node ? node.content : (question.slides[slideIndex] ?? {})
  const step = node
    ? { content: node.content, answer: node.answer, options: tree!.branchBy === 'choice' ? node.options.map((o) => o.label) : [] }
    : undefined

  function goSlide(delta: number) {
    setSlideIndex((i) => Math.min(count - 1, Math.max(0, i + delta)))
  }

  function toggleTimer() {
    setTimer((t) => {
      if (!t) return t
      if (t.endsAt != null) return pauseTimer(t)
      // Время вышло — запускаем заново
      return startTimer(t.leftMs > 0 ? t : newTimer(t.totalSec)!)
    })
  }

  // Клавиши — свежие функции на каждой отрисовке, поэтому слушатель перевешиваем
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // e.code — клавиша на клавиатуре, так T работает и в русской раскладке
      if (e.code === 'Escape') onClose()
      else if (e.code === 'ArrowLeft') goSlide(-1)
      else if (e.code === 'ArrowRight') goSlide(1)
      else if (e.code === 'Space') setShowAnswer((s) => !s)
      else if (e.code === 'KeyT') toggleTimer()
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // Фокус — на «Закрыть», чтобы клавиатура работала сразу, а Пробел не нажимал кнопки редактора под окном
  useEffect(() => closeRef.current?.focus(), [])

  const button = 'h-11 min-w-11 rounded-lg border border-line px-3 text-sm hover:bg-cell disabled:opacity-40'

  return (
    <div role="dialog" aria-modal="true" aria-label="Предпросмотр вопроса" className="fixed inset-0 z-50 overflow-auto">
      {/* Видео здесь — обычный плеер: управлять залом из редактора нечем */}
      <VideoContext.Provider value={{ video: null, freePlay: true }}>
        <HallFrame theme={theme} className="flex flex-col gap-6 px-12 pt-10 pb-32">
          <header className="flex items-center justify-between">
            <GameLogo
              theme={theme}
              className="h-14 max-w-60"
              fallback={<span className="font-display text-2xl">{gameTitle.toUpperCase()}</span>}
            />
            <span className="font-display text-2xl">{roundTitle.toUpperCase()}</span>
          </header>
          <div key={slideIndex} className="anim-appear flex min-h-0 flex-1 flex-col">
            <ScreenQuestion
              categoryTitle={categoryTitle}
              question={question}
              slideIndex={slideIndex}
              showAnswer={showAnswer}
              stealing={false}
              canSteal={false}
              timer={timer}
              step={step}
            />
          </div>
        </HallFrame>
      </VideoContext.Provider>

      {/* Панель ведущего — графитовая, поверх зала; в сам зал никогда не попадает */}
      <div className="fixed inset-x-0 bottom-4 flex justify-center px-4">
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-bg p-2 text-white shadow-2xl">
          <span className="px-2 text-sm font-semibold tracking-wide text-muted">ПРЕДПРОСМОТР · ТАК УВИДИТ ЗАЛ</span>
          {count > 1 && (
            <>
              <button type="button" onClick={() => goSlide(-1)} disabled={slideIndex === 0} aria-label="Предыдущий слайд" className={button}>
                ←
              </button>
              <span className="text-sm tabular-nums">
                {tree ? 'Шаг' : 'Слайд'} {slideIndex + 1} из {count}
              </span>
              <button type="button" onClick={() => goSlide(1)} disabled={slideIndex === count - 1} aria-label="Следующий слайд" className={button}>
                →
              </button>
            </>
          )}
          {slide.media?.type === 'audio' && (
            // Музыку в игре играет пульт, в зале — только значок ♪; здесь её можно послушать
            <div className="w-64">
              <MediaView media={slide.media} mode="editor" className="h-11" />
            </div>
          )}
          {timer && (
            <button type="button" onClick={toggleTimer} className={button}>
              {timer.endsAt != null ? 'Пауза таймера · T' : 'Таймер · T'}
            </button>
          )}
          <button type="button" onClick={() => setShowAnswer(!showAnswer)} aria-pressed={showAnswer} className={button}>
            {showAnswer ? 'Скрыть ответ' : 'Показать ответ'} · Пробел
          </button>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="h-11 rounded-lg bg-white px-4 text-sm font-semibold text-black hover:opacity-90"
          >
            Закрыть · Esc
          </button>
        </div>
      </div>
    </div>
  )
}
