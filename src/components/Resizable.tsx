import { useContext, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { clampSize, SIZE_NAMES } from '../theme'
import type { HallSizes } from '../types'
import { capture, ResizeContext } from '../hallResize'

type Drag = { x: number; y: number; span: number; start: number; root: HTMLElement; value: number }

// Объект зала, который можно растянуть мышью в режиме «Растянуть в зале» (контекст ResizeContext в hallResize.ts)
export function Resizable({ id, className = '', children }: { id: keyof HallSizes; className?: string; children: ReactNode }) {
  const onSize = useContext(ResizeContext)
  const ref = useRef<HTMLDivElement>(null)
  const drag = useRef<Drag | null>(null)
  const [value, setValue] = useState<number | null>(null) // размер, пока тянут (для подписи)

  if (!onSize) return <div className={className}>{children}</div>

  const variable = `--${id}-scale`
  const name = SIZE_NAMES.find((s) => s.id === id)?.name ?? id

  function start(e: PointerEvent<HTMLButtonElement>) {
    const box = ref.current
    const root = box?.closest<HTMLElement>('[data-hall]')
    if (!box || !root) return
    e.preventDefault()
    capture(e)
    const rect = box.getBoundingClientRect()
    const start = Math.round((parseFloat(getComputedStyle(root).getPropertyValue(variable)) || 1) * 100)
    drag.current = { x: e.clientX, y: e.clientY, span: Math.max(1, rect.width + rect.height), start, root, value: start }
    setValue(start)
  }

  // Тянем вправо-вниз — больше, влево-вверх — меньше. Пока тянем, зал меняется сразу, у себя
  function move(e: PointerEvent<HTMLButtonElement>) {
    const d = drag.current
    if (!d) return
    const next = clampSize(d.start * (1 + (e.clientX - d.x + e.clientY - d.y) / d.span))
    if (next === d.value) return
    d.value = next
    d.root.style.setProperty(variable, String(next / 100))
    setValue(next)
  }

  // Отпустили — просим пульт запомнить размер (он пришлёт его обратно вместе с оформлением)
  function end() {
    const d = drag.current
    if (!d) return
    drag.current = null
    setValue(null)
    if (d.value !== d.start) onSize?.(id, d.value)
  }

  return (
    <div ref={ref} className={`relative ${className}`}>
      {children}
      <div className="pointer-events-none absolute inset-0 rounded-lg border-2 border-dashed border-accent">
        <span className="absolute top-1 left-1 rounded bg-accent px-2 py-0.5 text-sm font-semibold text-on-accent">
          {name}
          {value !== null && ` · ${value}%`}
        </span>
      </div>
      <button
        type="button"
        aria-label={`Растянуть: ${name}`}
        title="Тяните вправо-вниз — больше, влево-вверх — меньше"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        className="absolute -right-3 -bottom-3 z-10 flex h-11 w-11 cursor-nwse-resize touch-none items-center justify-center rounded-lg bg-accent text-xl text-on-accent shadow-lg"
      >
        ◢
      </button>
    </div>
  )
}
