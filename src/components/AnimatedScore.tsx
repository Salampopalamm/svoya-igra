import { useState } from 'react'

// Счёт команды в зале: при изменении число «подпрыгивает», над ним всплывает «+300» или «−200»
export default function AnimatedScore({ value, className }: { value: number; className: string }) {
  const [last, setLast] = useState(value)
  const [change, setChange] = useState<{ delta: number; id: number } | null>(null)

  // Счёт изменился — запоминаем разницу (новый id перезапускает анимацию)
  if (value !== last) {
    setLast(value)
    setChange({ delta: value - last, id: (change?.id ?? 0) + 1 })
  }

  return (
    <span className="relative inline-block">
      <span key={change?.id ?? 0} className={`inline-block ${change ? 'anim-score' : ''} ${className}`}>
        {value}
      </span>
      {change && (
        <span
          key={`delta-${change.id}`}
          aria-hidden="true"
          className="anim-float pointer-events-none absolute right-0 -top-6 text-xl font-semibold"
        >
          {change.delta > 0 ? `+${change.delta}` : `−${Math.abs(change.delta)}`}
        </span>
      )}
    </span>
  )
}
