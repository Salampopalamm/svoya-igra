import type { ReactNode } from 'react'
import { CONTROL_GROUPS, CONTROL_NAMES, type ControlId } from '../hostControls'

// Значок шестерёнки (рисунок, без текста)
export function GearIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

// Значок «закрепить» (кнопка-булавка)
function PinIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 17v5" />
      <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />
    </svg>
  )
}

type Props = {
  render: (id: ControlId) => ReactNode // сама кнопка (та же, что на панели ведущего)
  pinned: ControlId[]
  onTogglePin: (id: ControlId) => void
  onClose: () => void
}

// Настройки пульта: все кнопки по категориям. Булавка выносит кнопку на панель ведущего (в шапку пульта).
export default function HostSettings({ render, pinned, onTogglePin, onClose }: Props) {
  return (
    <>
      {/* Клик мимо панели — закрыть */}
      <button type="button" aria-label="Закрыть настройки" onClick={onClose} className="fixed inset-0 z-40 cursor-default bg-black/50" />
      <aside
        role="dialog"
        aria-label="Настройки пульта"
        className="fixed inset-y-0 right-0 z-50 flex w-[480px] max-w-full flex-col gap-6 overflow-y-auto border-l border-line bg-bg p-6 text-white shadow-2xl"
      >
        <div className="flex items-center justify-between gap-4">
          <h2 className="flex items-center gap-3 font-display text-xl">
            <GearIcon /> НАСТРОЙКИ
          </h2>
          <button type="button" onClick={onClose} className="h-11 rounded-lg border border-line px-4 text-sm hover:bg-cell">
            Закрыть · Esc
          </button>
        </div>
        <p className="text-sm text-muted">
          Нажмите на булавку, чтобы вынести кнопку на панель ведущего — в шапку пульта. Ещё раз — убрать с панели.
        </p>

        {CONTROL_GROUPS.map((group) => (
          <section key={group.title} className="flex flex-col gap-3">
            <h3 className="text-xs font-semibold tracking-widest text-muted">{group.title.toUpperCase()}</h3>
            {group.ids.map((id) => {
              const isPinned = pinned.includes(id)
              return (
                <div key={id} className="flex items-start gap-3">
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{render(id)}</div>
                  <button
                    type="button"
                    onClick={() => onTogglePin(id)}
                    aria-pressed={isPinned}
                    aria-label={`${isPinned ? 'Убрать с панели' : 'Закрепить на панели'}: ${CONTROL_NAMES[id]}`}
                    title={isPinned ? 'На панели ведущего — убрать' : 'Закрепить на панели ведущего'}
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${isPinned ? 'bg-white text-black' : 'border border-line text-muted hover:bg-cell hover:text-white'}`}
                  >
                    <PinIcon filled={isPinned} />
                  </button>
                </div>
              )
            })}
          </section>
        ))}
      </aside>
    </>
  )
}
