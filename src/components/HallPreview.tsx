import { useEffect, useRef, useState } from 'react'
import { newTimer, pauseTimer, startTimer, type TimerState } from '../live'
import { contentAt, setContentPlace } from '../placement'
import { specialTitle } from '../special'
import type { PlaceTarget, Player, Question, Team, Theme } from '../types'
import { VideoContext } from '../videoControl'
import { HallFrame } from './HallFrame'
import { MediaView } from './MediaView'
import Scoreboard from './Scoreboard'
import ScreenQuestion from './ScreenQuestion'
import TeamsColumn from './TeamsColumn'

// С чего открыть предпросмотр: слайд, ответ, сразу в режиме «Расставить»
export type PreviewStart = { slide?: number; answer?: boolean; arrange?: boolean }

type Props = {
  theme: Theme
  teams: Team[]
  players: Player[]
  question: Question
  start?: PreviewStart
  onChange: (change: (q: Question) => Question) => void // сохранить расстановку
  onClose: () => void
}

// Предпросмотр вопроса в редакторе: так его увидит зал — с оформлением игры, командами, слайдами, ответом и таймером.
// Здесь же «Расставить самому»: текст и картинки слайда (или ответа) двигают и растягивают мышью, всё сохраняется сразу.
// Живёт только в этом окне: в зал и в ход партии не попадает.
// Клавиши как на пульте: ← / → — слайды, Пробел — ответ, T — таймер, Esc — закрыть.
export default function HallPreview({ theme, teams, players, question, start, onChange, onClose }: Props) {
  const [slideIndex, setSlideIndex] = useState(start?.slide ?? 0)
  const [showAnswer, setShowAnswer] = useState(!!start?.answer)
  const [arrange, setArrange] = useState(!!start?.arrange)
  const [panelTop, setPanelTop] = useState(false) // панель можно поднять наверх, чтобы не закрывала низ слайда
  const [timer, setTimer] = useState<TimerState | null>(() => newTimer(question.timerSec))
  const closeRef = useRef<HTMLButtonElement>(null)

  // Ветвящийся вопрос листается по шагам дерева, обычный — по слайдам
  const tree = question.tree
  const count = tree ? tree.nodes.length : question.slides.length
  const node = tree?.nodes[slideIndex]
  const slide = node ? node.content : (question.slides[slideIndex] ?? {})
  const step = node
    ? {
        nodeId: node.id,
        content: node.content,
        answer: node.answer,
        options: tree!.branchBy === 'choice' ? node.options.map((o) => o.label) : [],
      }
    : undefined

  // Что сейчас на экране — то и расставляем: ответ (если он открыт) или слайд
  const answerOnScreen = showAnswer && !!(node ? node.answer : question.answer)
  const target: PlaceTarget = node
    ? { kind: 'node', nodeId: node.id, answer: answerOnScreen }
    : answerOnScreen
      ? { kind: 'answer' }
      : { kind: 'slide', index: slideIndex }
  const placed = !!contentAt(question, target)?.place

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

  function resetPlace() {
    onChange((q) => setContentPlace(q, target, undefined))
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
  const photosView = theme.teamView === 'photos'

  // Вопрос — как в зале: без шапки; команды — колонкой справа или полосой снизу (так у области вопроса та же форма,
  // что в зале, и своя расстановка совпадёт)
  const main = (
    <div key={slideIndex} className="anim-appear flex min-h-0 flex-1 flex-col">
      <ScreenQuestion
        title={specialTitle(question) ?? undefined}
        question={question}
        slideIndex={slideIndex}
        showAnswer={showAnswer}
        timer={timer}
        step={step}
        arrange={arrange}
        onPlace={arrange ? (where, place) => onChange((q) => setContentPlace(q, where, place)) : undefined}
      />
    </div>
  )

  return (
    <div role="dialog" aria-modal="true" aria-label="Предпросмотр вопроса" className="fixed inset-0 z-50 overflow-auto">
      {/* Видео здесь — обычный плеер: управлять залом из редактора нечем */}
      <VideoContext.Provider value={{ video: null, freePlay: true }}>
        <HallFrame theme={theme} className="flex flex-col gap-6 px-12 py-10">
          {photosView ? (
            <div className="grid flex-1 gap-8" style={{ gridTemplateColumns: 'minmax(0, 1fr) calc(380px * var(--teams-scale, 1))' }}>
              <div className="flex flex-col">{main}</div>
              <div className="[zoom:var(--teams-scale,1)]">
                <TeamsColumn
                  teams={teams}
                  players={players}
                  activeTeamId={teams[0]?.id ?? null}
                  activeLabel="ОТВЕЧАЕТ"
                  outTeamIds={[]}
                  showPhotos={theme.showPhotos}
                />
              </div>
            </div>
          ) : (
            <>
              {main}
              <div className="[zoom:var(--teams-scale,1)]">
                <Scoreboard teams={teams} activeTeamId={teams[0]?.id ?? null} activeLabel="ОТВЕЧАЕТ" outTeamIds={[]} />
              </div>
            </>
          )}
        </HallFrame>
      </VideoContext.Provider>

      {/* Панель ведущего — графитовая, поверх зала; в сам зал никогда не попадает */}
      <div className={`fixed inset-x-0 z-20 flex justify-center px-4 ${panelTop ? 'top-4' : 'bottom-4'}`}>
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-bg p-2 text-white shadow-2xl">
          <span className="px-2 text-sm font-semibold tracking-wide text-muted">
            {arrange ? 'РАССТАНОВКА · ТЯНИТЕ ОБЪЕКТ — МЕСТО, УГОЛОК ◢ — РАЗМЕР' : 'ПРЕДПРОСМОТР · ТАК УВИДИТ ЗАЛ'}
          </span>
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
          {slide.media?.type === 'audio' && !arrange && (
            // Музыку в игре играет пульт, в зале — только значок ♪; здесь её можно послушать
            <div className="w-64">
              <MediaView media={slide.media} mode="editor" className="h-11" />
            </div>
          )}
          {timer && !arrange && (
            <button type="button" onClick={toggleTimer} className={button}>
              {timer.endsAt != null ? 'Пауза таймера · T' : 'Таймер · T'}
            </button>
          )}
          <button type="button" onClick={() => setShowAnswer(!showAnswer)} aria-pressed={showAnswer} className={button}>
            {showAnswer ? 'Скрыть ответ' : 'Показать ответ'} · Пробел
          </button>
          {arrange ? (
            <>
              {placed && (
                <button type="button" onClick={resetPlace} className={button} title="Убрать свою расстановку — слайд разложится сам">
                  Вернуть авто
                </button>
              )}
              <button type="button" onClick={() => setArrange(false)} className={`${button} bg-white font-semibold text-black hover:bg-white/90`}>
                Готово
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setArrange(true)} className={button}>
              {placed ? 'Расстановка: своя · изменить' : 'Расставить самому'}
            </button>
          )}
          <button
            type="button"
            onClick={() => setPanelTop(!panelTop)}
            aria-label={panelTop ? 'Опустить панель вниз' : 'Поднять панель наверх'}
            title={panelTop ? 'Опустить панель вниз' : 'Поднять панель наверх'}
            className={button}
          >
            {panelTop ? '▾' : '▴'}
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
