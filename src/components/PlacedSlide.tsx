import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { contentMedia } from '../pictures'
import { capture } from '../hallResize'
import { clampBox, placeOf } from '../placement'
import type { Box, Content, Placement } from '../types'
import { MediaView } from './MediaView'

type Props = {
  content: Content
  label?: string // подпись в углу («ОТВЕТ»)
  overlay?: ReactNode // поверх слайда в правом верхнем углу (таймер)
  onPlace?: (place: Placement) => void // есть — объекты можно двигать и растягивать мышью
}

// Какой объект тянут: текст или i-я картинка; двигают целиком или меняют размер уголком
type Key = 'text' | number
type Drag = { key: Key; resize: boolean; x: number; y: number; box: Box; width: number; height: number; place: Required<Placement>; latest?: Required<Placement> }

// Слайд со своей расстановкой: текст и картинки стоят там, куда их поставил ведущий (проценты области вопроса).
// Текст сам подбирает размер шрифта под свою рамку: шире рамка — крупнее буквы.
export default function PlacedSlide({ content, label, overlay, onPlace }: Props) {
  const areaRef = useRef<HTMLDivElement>(null)
  const drag = useRef<Drag | null>(null)
  const [draft, setDraft] = useState<Required<Placement> | null>(null) // пока тянут — рисуем отсюда
  const place = draft ?? placeOf(content)
  const pictures = contentMedia(content)
  const editable = !!onPlace

  function start(e: PointerEvent<HTMLElement>, key: Key, resize: boolean) {
    const area = areaRef.current
    if (!area || !onPlace) return
    e.preventDefault()
    e.stopPropagation()
    capture(e)
    const rect = area.getBoundingClientRect()
    const box = key === 'text' ? place.text : place.media[key]
    drag.current = { key, resize, x: e.clientX, y: e.clientY, box, width: rect.width, height: rect.height, place }
  }

  function move(e: PointerEvent<HTMLElement>) {
    const d = drag.current
    if (!d) return
    const dx = ((e.clientX - d.x) / d.width) * 100
    const dy = ((e.clientY - d.y) / d.height) * 100
    const b = d.box
    const box = d.resize
      ? clampBox({ ...b, w: Math.min(b.w + dx, 100 - b.x), h: Math.min(b.h + dy, 100 - b.y) })
      : clampBox({ ...b, x: b.x + dx, y: b.y + dy })
    d.latest =
      d.key === 'text'
        ? { ...d.place, text: box }
        : { ...d.place, media: d.place.media.map((m, i) => (i === d.key ? box : m)) }
    setDraft(d.latest)
  }

  // Отпустили — сохраняем расстановку целиком (текст и все картинки)
  function end() {
    const d = drag.current
    if (!d) return
    drag.current = null
    if (d.latest) onPlace?.(d.latest)
    setDraft(null)
  }

  const handlers = (key: Key, resize: boolean) =>
    editable
      ? {
          onPointerDown: (e: PointerEvent<HTMLElement>) => start(e, key, resize),
          onPointerMove: move,
          onPointerUp: end,
          onPointerCancel: end,
        }
      : {}

  // Рамка объекта; в режиме расстановки — пунктир, подпись и уголок ◢
  const frame = (key: Key, box: Box, name: string, children: ReactNode) => (
    <div
      key={key}
      {...handlers(key, false)}
      className={`absolute flex items-center justify-center ${editable ? 'cursor-move touch-none outline-2 outline-accent outline-dashed [&_img]:pointer-events-none [&_video]:pointer-events-none' : ''}`}
      style={{ left: `${box.x}%`, top: `${box.y}%`, width: `${box.w}%`, height: `${box.h}%` }}
    >
      {children}
      {editable && (
        <>
          <span className="pointer-events-none absolute top-1 left-1 rounded bg-accent px-2 py-0.5 text-sm font-semibold text-on-accent">
            {name}
          </span>
          <span
            {...handlers(key, true)}
            role="presentation"
            title="Тяните — размер"
            className="absolute right-0 bottom-0 flex h-11 w-11 cursor-nwse-resize touch-none items-center justify-center rounded-tl-lg bg-accent text-xl text-on-accent"
          >
            ◢
          </span>
        </>
      )}
    </div>
  )

  return (
    <div ref={areaRef} className="relative min-h-0 flex-1">
      {label && <span className="absolute top-0 left-0 text-sm font-semibold tracking-widest text-muted">{label}</span>}
      {content.text && frame('text', place.text, 'Текст', <FitText text={content.text} />)}
      {pictures.map((media, i) =>
        frame(
          i,
          place.media[i],
          pictures.length > 1 ? `Картинка ${i + 1}` : 'Файл',
          <MediaView media={media} mode="hall" className="h-full w-full object-contain" />,
        ),
      )}
      {overlay && <div className="absolute top-0 right-0 z-10">{overlay}</div>}
    </div>
  )
}

// Текст во всю рамку: подбираем самый крупный шрифт, при котором текст помещается целиком
function FitText({ text }: { text: string }) {
  const outer = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLParagraphElement>(null)

  // На каждой отрисовке (рамку тянут — слайд перерисовывается)…
  useLayoutEffect(() => {
    if (outer.current && inner.current) fitText(outer.current, inner.current)
  })

  // …и когда меняется размер окна
  useEffect(() => {
    const box = outer.current
    const p = inner.current
    if (!box || !p) return
    const observer = new ResizeObserver(() => fitText(box, p))
    observer.observe(box)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={outer} className="flex h-full w-full items-center overflow-hidden">
      <p ref={inner} className="w-full leading-tight font-semibold">
        {text}
      </p>
    </div>
  )
}

// Подбор шрифта делением пополам: от 8 до 400 px
function fitText(box: HTMLElement, p: HTMLElement) {
  let lo = 8
  let hi = 400
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2)
    p.style.fontSize = `${mid}px`
    if (p.scrollHeight <= box.clientHeight && p.scrollWidth <= box.clientWidth) lo = mid
    else hi = mid
  }
  p.style.fontSize = `${lo}px`
}
