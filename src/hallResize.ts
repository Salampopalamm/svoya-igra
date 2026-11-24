import { createContext } from 'react'
import type { HallSizes } from './types'

// Режим «Растянуть в зале»: у объектов зала пунктирная рамка и уголок ◢, их тянут мышью (components/Resizable.tsx).
// Растягивание меняет те же размеры, что и ползунки (theme.sizes), — потянули, и ползунок на пульте сдвинулся.
// В контексте — куда отправить новый размер; пусто — режим выключен, объекты рисуются как обычно.
export const ResizeContext = createContext<((id: keyof HallSizes, value: number) => void) | null>(null)

// Держать мышь за объектом, даже если курсор убежал за его край (если браузер не даёт — тянем и так)
export function capture(e: { currentTarget: Element; pointerId: number }) {
  try {
    e.currentTarget.setPointerCapture(e.pointerId)
  } catch {
    // указатель уже отпущен — не страшно
  }
}
