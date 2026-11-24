import { APP_KEY } from '../site'
import { useEffect, useRef, useState } from 'react'
import type { HallAction, TimerState } from '../live'
import { useTimeLeft } from '../useTimeLeft'
import type { Question, Team } from '../types'
import TeamIcon from './TeamIcon'

type Props = {
  question: Question
  slideIndex: number
  showAnswer: boolean
  teams: Team[]
  answeringTeam?: Team
  triedTeamIds: string[]
  timer: TimerState | null // null — таймера у вопроса нет
  scoring: boolean // можно ли «Верно / Неверно» (не финал, не дерево, не «только посмотреть»)
  final: boolean // вопрос финала: ответ и выход — только через итоги на пульте
  onAction: (action: HallAction) => void
}

const HIDE_AFTER_MS = 3000

// Панель ведущего на экране зала («Мышь в зале»): всплывает внизу, когда двигают мышь,
// и прячется через 3 секунды без движения. Кнопки только просят пульт — решает он.
export default function HallMousePanel({
  question,
  slideIndex,
  showAnswer,
  teams,
  answeringTeam,
  triedTeamIds,
  timer,
  scoring,
  final,
  onAction,
}: Props) {
  const visible = useMouseActive()
  const [collapsed, setCollapsed] = useState(loadCollapsed)
  const left = useTimeLeft(timer)
  const timerRunning = timer ? timer.endsAt !== null && left > 0 : null
  const count = question.slides.length
  const allTried = teams.length > 0 && teams.every((t) => triedTeamIds.includes(t.id))

  const button = 'h-14 min-w-14 rounded-xl border-2 border-line bg-bg px-4 text-lg font-semibold hover:border-white disabled:opacity-30'
  const primary = 'h-14 rounded-xl bg-accent px-5 text-lg font-semibold text-on-accent hover:opacity-90'

  function toggle(next: boolean) {
    setCollapsed(next)
    saveCollapsed(next)
  }

  const fade = `transition-opacity duration-300 ${visible ? 'opacity-100' : 'pointer-events-none opacity-0'}`

  // Свёрнута: вверху посередине только маленькая кнопка — низ экрана свободен для картинок и команд
  if (collapsed) {
    return (
      <div className={`fixed inset-x-0 top-3 z-30 flex justify-center ${fade}`}>
        <button
          type="button"
          onClick={() => toggle(false)}
          aria-label="Развернуть панель ведущего"
          className="h-11 rounded-xl border-2 border-line bg-cell/95 px-4 text-lg font-semibold shadow-2xl hover:border-white"
        >
          ▾ Панель
        </button>
      </div>
    )
  }

  return (
    <div className={`fixed inset-x-0 bottom-6 z-30 flex justify-center px-6 ${fade}`}>
      <div className="flex max-w-full flex-wrap items-center justify-center gap-2 rounded-2xl border-2 border-line bg-cell/95 p-3 shadow-2xl">
        {count > 1 && (
          <>
            <button type="button" onClick={() => onAction({ kind: 'slide', delta: -1 })} disabled={slideIndex === 0} className={button} aria-label="Предыдущий слайд">
              ←
            </button>
            <span className="px-1 text-lg tabular-nums text-muted">
              {slideIndex + 1} / {count}
            </span>
            <button type="button" onClick={() => onAction({ kind: 'slide', delta: 1 })} disabled={slideIndex === count - 1} className={button} aria-label="Следующий слайд">
              →
            </button>
          </>
        )}

        {timerRunning !== null && !showAnswer && (
          <button type="button" onClick={() => onAction({ kind: 'timer' })} className={button}>
            {timerRunning ? '⏸ Таймер' : '▶ Таймер'}
          </button>
        )}

        {/* Кто отвечает: «Верно / Неверно» — или выбрать команду (в начале и при перехвате) */}
        {scoring && answeringTeam && (
          <>
            <span className="flex items-center gap-2 px-2 text-lg font-semibold">
              <TeamIcon team={answeringTeam} size={28} />
              {answeringTeam.name}
            </span>
            <button type="button" onClick={() => onAction({ kind: 'correct' })} className={primary}>
              ✓ Верно +{question.value}
            </button>
            <button type="button" onClick={() => onAction({ kind: 'wrong' })} className={button}>
              ✗ Неверно −{question.value}
            </button>
          </>
        )}
        {scoring && !answeringTeam && !allTried && (
          <>
            <span className="px-2 text-lg text-muted">Кто отвечает?</span>
            {teams
              .filter((t) => !triedTeamIds.includes(t.id))
              .map((t) => (
                <button key={t.id} type="button" onClick={() => onAction({ kind: 'team', teamId: t.id })} className={`${button} flex items-center gap-2`}>
                  <TeamIcon team={t} size={24} />
                  {t.name}
                </button>
              ))}
          </>
        )}

        {!showAnswer && !final && (
          <button type="button" onClick={() => onAction({ kind: 'answer' })} className={button}>
            Показать ответ
          </button>
        )}
        {!final && (
          <button type="button" onClick={() => onAction({ kind: 'close' })} className={button}>
            На табло
          </button>
        )}
        <button type="button" onClick={() => toggle(true)} aria-label="Свернуть панель ведущего" title="Свернуть" className={button}>
          ▾
        </button>
      </div>
    </div>
  )
}

// Свёрнута ли панель — запоминаем в этом браузере, чтобы не сворачивать на каждом вопросе
const COLLAPSED_KEY = `${APP_KEY}:hall-panel-collapsed`

function loadCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

function saveCollapsed(collapsed: boolean) {
  try {
    localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0')
  } catch {
    // хранилище недоступно — просто не запомним
  }
}

// Двигали ли мышь за последние 3 секунды (пока курсор над панелью — она не прячется)
function useMouseActive(): boolean {
  const [active, setActive] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    function wake(e: MouseEvent) {
      setActive(true)
      window.clearTimeout(timer.current)
      const overPanel = (e.target as HTMLElement | null)?.closest?.('button')
      if (!overPanel) timer.current = window.setTimeout(() => setActive(false), HIDE_AFTER_MS)
    }
    window.addEventListener('mousemove', wake)
    window.addEventListener('mousedown', wake)
    return () => {
      window.removeEventListener('mousemove', wake)
      window.removeEventListener('mousedown', wake)
      window.clearTimeout(timer.current)
    }
  }, [])

  return active
}
