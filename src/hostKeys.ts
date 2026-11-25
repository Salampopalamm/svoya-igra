// Горячие клавиши пульта: какая клавиша что значит. Сами действия выполняет пульт (HostApp.tsx).
// Меняешь клавиши — поправь и памятку «Как провести игру» (components/HowToRun.tsx).

export type HostCommand =
  | { kind: 'undo' } // Ctrl+Z — отменить последнее действие
  | { kind: 'toggle-screen' } // H — скрыть / показать экран зала
  | { kind: 'escape' } // Esc — закрыть памятку, настройки, предпросмотр или вопрос
  | { kind: 'preview-mode' } // P — режим предпросмотра (только на табло)
  | { kind: 'team'; index: number } // 1–9 и 0 — команда по номеру (0 = десятая)
  | { kind: 'slide'; delta: 1 | -1 } // ← / → — слайды вопроса
  | { kind: 'timer' } // T — таймер вопроса
  | { kind: 'answer' } // Пробел — показать ответ в зале
  | { kind: 'correct' } // + — «Верно»
  | { kind: 'wrong' } // − — «Неверно»

// Что сейчас на пульте: от этого зависит, работает ли клавиша
export type KeySituation = { questionOpen: boolean; isFinal: boolean }

type Key = Pick<KeyboardEvent, 'code' | 'key' | 'ctrlKey'>

// Клавиша → команда пульта; null — клавиша сейчас ничего не делает
export function hostKey(e: Key, { questionOpen, isFinal }: KeySituation): HostCommand | null {
  if (e.ctrlKey) return e.code === 'KeyZ' ? { kind: 'undo' } : null
  if (e.code === 'KeyH') return { kind: 'toggle-screen' }
  if (e.code === 'Escape') return { kind: 'escape' }
  if (e.code === 'KeyP') return !questionOpen && !isFinal ? { kind: 'preview-mode' } : null // в финале табло нет

  const digit = /^(Digit|Numpad)(\d)$/.exec(e.code)
  if (digit) return isFinal ? null : { kind: 'team', index: digit[2] === '0' ? 9 : Number(digit[2]) - 1 }

  if (!questionOpen) return null
  if (e.code === 'ArrowRight') return { kind: 'slide', delta: 1 }
  if (e.code === 'ArrowLeft') return { kind: 'slide', delta: -1 }
  if (e.code === 'KeyT') return { kind: 'timer' }
  if (e.code === 'Space') return { kind: 'answer' }
  if (e.key === '+' || e.key === '=' || e.code === 'NumpadAdd') return { kind: 'correct' }
  if (e.key === '-' || e.code === 'NumpadSubtract') return { kind: 'wrong' }
  return null
}

// Ведущий печатает (счёт, ставку) или жмёт клавиши в плеере — горячие клавиши молчат
export function typingInField(target: EventTarget | null) {
  return target instanceof Element && !!target.closest('input, textarea, select, audio, video')
}
