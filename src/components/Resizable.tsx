import { useContext, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react'
import { clampSize, itemScale, itemVar, SIZE_NAMES } from '../theme'
import type { HallSizes } from '../types'
import { capture, ResizeContext } from '../hallResize'

type Drag = { x: number; y: number; span: number; start: number; root: HTMLElement; value: number }

type Props = {
  id?: keyof HallSizes // общий размер (как ползунок): текст, картинки, таймер
  item?: string // или отдельный объект: ключ из Theme.itemSizes (cell:…, cat:…, team:…, head:…)
  label?: string // подпись отдельного объекта, пока его тянут
  className?: string
  style?: CSSProperties
  children: ReactNode
}

// Объект зала, который можно растянуть мышью в режиме «Растянуть в зале» (контекст ResizeContext в hallResize.ts).
// Отдельный объект (item) сам увеличивается целиком (CSS zoom внутри рамки) — рамка и уголок при этом своего размера.
export function Resizable({ id, item, label, className = '', style, children }: Props) {
  const onSize = useContext(ResizeContext)
  const ref = useRef<HTMLDivElement>(null)
  const drag = useRef<Drag | null>(null)
  const [value, setValue] = useState<number | null>(null) // размер, пока тянут (для подписи)

  const inner = item ? (
    <div className="flex h-full w-full" style={{ zoom: itemScale(item) }}>
      {children}
    </div>
  ) : (
    children
  )

  if (!onSize || (!id && !item)) {
    return (
      <div className={className} style={style}>
        {inner}
      </div>
    )
  }

  const variable = id ? `--${id}-scale` : itemVar(item!)
  const name = id ? (SIZE_NAMES.find((s) => s.id === id)?.name ?? id) : (label ?? '')

  function start(e: PointerEvent<HTMLButtonElement>) {
    const box = ref.current
    const root = box?.closest<HTMLElement>('[data-hall]')
    if (!box || !root) return
    e.preventDefault()
    e.stopPropagation()
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
    if (d.value !== d.start) onSize?.(id ? { id } : { item: item! }, d.value)
  }

  // У общего размера подпись видна всегда, у отдельных объектов — только пока тянут (их много, подписи мешали бы)
  const showLabel = !!id || value !== null

  return (
    // Уголок отдельного объекта виден, только когда мышь над ним: на табло их десятки, они закрывали бы цифры
    <div ref={ref} className={`group relative ${className}`} style={style}>
      {inner}
      <div className="pointer-events-none absolute inset-0 rounded-lg border-2 border-dashed border-accent">
        {showLabel && (
          <span className="absolute top-1 left-1 z-10 rounded bg-accent px-2 py-0.5 text-sm font-semibold whitespace-nowrap text-on-accent">
            {name}
            {value !== null && ` · ${value}%`}
          </span>
        )}
      </div>
      <button
        type="button"
        aria-label={`Растянуть: ${name}`}
        title="Тяните вправо-вниз — больше, влево-вверх — меньше"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        className={`absolute z-10 flex h-11 w-11 cursor-nwse-resize touch-none items-center justify-center bg-accent text-xl text-on-accent shadow-lg ${item ? `right-0 bottom-0 rounded-tl-lg rounded-br-lg ${value === null ? 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100' : ''}` : '-right-3 -bottom-3 rounded-lg'}`}
      >
        ◢
      </button>
    </div>
  )
}

