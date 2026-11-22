import { useState } from 'react'

// Кнопки пульта. Все живут в настройках (⚙), разложенные по категориям;
// ведущий может закрепить нужные — тогда они видны в шапке пульта, на панели ведущего.

export type ControlId =
  | 'preview'
  | 'undo'
  | 'teams'
  | 'reset'
  | 'rehearsal'
  | 'open-screen'
  | 'hide-screen'
  | 'how-to'
  | 'tone'
  | 'font'
  | 'grayscale'
  | 'sizes'
  | 'team-view'
  | 'photos'
  | 'timer-sound'

export const CONTROL_GROUPS: { title: string; ids: ControlId[] }[] = [
  { title: 'Игра', ids: ['preview', 'undo', 'teams', 'rehearsal', 'reset'] },
  { title: 'Экран зала', ids: ['open-screen', 'hide-screen', 'how-to'] },
  { title: 'Оформление зала', ids: ['tone', 'font', 'grayscale', 'sizes'] },
  { title: 'Команды в зале', ids: ['team-view', 'photos'] },
  { title: 'Звук', ids: ['timer-sound'] },
]

// Названия — для кнопки «закрепить» (её подпись для экранного диктора)
export const CONTROL_NAMES: Record<ControlId, string> = {
  preview: 'Предпросмотр',
  undo: 'Отменить',
  teams: 'Команды и игроки',
  reset: 'Начать заново',
  rehearsal: 'Репетиция',
  'open-screen': 'Открыть экран для зала',
  'hide-screen': 'Скрыть экран зала',
  'how-to': 'Как провести игру',
  tone: 'Фон зала',
  font: 'Шрифт',
  grayscale: 'Обесцветить медиа',
  sizes: 'Размеры в зале',
  'team-view': 'Вид команд',
  photos: 'Свернуть фото',
  'timer-sound': 'Звук таймера',
}

// Без настроек на панели — самое нужное во время игры
const DEFAULT_PINNED: ControlId[] = ['preview', 'hide-screen', 'undo', 'open-screen', 'how-to']

const STORAGE_KEY = 'svoya-igra:host-pinned'

function load(): ControlId[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_PINNED
    const ids = JSON.parse(raw) as string[]
    return ids.filter((id): id is ControlId => id in CONTROL_NAMES)
  } catch {
    return DEFAULT_PINNED
  }
}

// Какие кнопки закреплены на панели ведущего. Запоминается в этом браузере для всех игр.
export function usePinnedControls() {
  const [pinned, setPinned] = useState<ControlId[]>(load)

  function toggle(id: ControlId) {
    setPinned((list) => {
      const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        // хранилище недоступно — закрепление проживёт до перезагрузки
      }
      return next
    })
  }

  // В шапке кнопки стоят в том же порядке, что и в настройках
  const ordered = CONTROL_GROUPS.flatMap((g) => g.ids).filter((id) => pinned.includes(id))
  return { pinned: ordered, toggle }
}
