import { createContext } from 'react'
import type { HallSizes } from './types'

// Режим «Растянуть в зале»: у объектов зала пунктирная рамка и уголок ◢, их тянут мышью (components/Resizable.tsx).
// Текст, картинки и таймер вопроса меняют те же размеры, что и ползунки (theme.sizes); ячейки, категории,
// команды и шапка — каждый свой (theme.itemSizes).
// В контексте — куда отправить новый размер; пусто — режим выключен, объекты рисуются как обычно.
export const ResizeContext = createContext<((target: SizeTarget, value: number) => void) | null>(null)

// Что растянули: общий размер (как ползунок) или отдельный объект (ключ из Theme.itemSizes)
export type SizeTarget = { id: keyof HallSizes } | { item: string }

// Держать мышь за объектом, даже если курсор убежал за его край (если браузер не даёт — тянем и так)
export function capture(e: { currentTarget: Element; pointerId: number }) {
  try {
    e.currentTarget.setPointerCapture(e.pointerId)
  } catch {
    // указатель уже отпущен — не страшно
  }
}
