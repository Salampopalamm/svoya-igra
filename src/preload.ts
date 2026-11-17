import { useEffect, useState } from 'react'
import { allMediaRefs } from './game'
import type { Game, MediaRef } from './types'
import { loadMediaUrl } from './useMediaUrl'

// Предзагрузка файлов игры: пульт и экран зала при открытии заранее достают все файлы из хранилища,
// картинки готовят к показу, а видео и музыку проверяют — откроет ли их браузер.
// Так в игре ничего не «грузится», а сломанный файл видно до начала, а не посреди вопроса.

export type BrokenFile = { name: string; reason: 'missing' | 'broken' } // нет в браузере / браузер не может открыть

export type PreloadProgress = {
  total: number // сколько разных файлов в игре
  done: number // сколько уже проверено
  broken: BrokenFile[]
}

const checked = new Map<string, boolean>() // id → файл открывается (проверяем каждый файл один раз за окно)
const decoded: HTMLImageElement[] = [] // готовые к показу картинки держим, чтобы браузер их не выбросил

const WAIT_MS = 15_000 // дольше не ждём: значит, файл огромный, но открывается

// Открывается ли файл в этом браузере
async function warmUp(media: MediaRef, url: string): Promise<boolean> {
  if (media.type === 'image' || media.type === 'gif') {
    const img = new Image()
    img.src = url
    try {
      await img.decode()
      decoded.push(img)
      return true
    } catch {
      return false
    }
  }
  // Видео и музыка: ждём первый кадр (или длительность у музыки), без звука и без показа
  const el = document.createElement(media.type === 'video' ? 'video' : 'audio')
  el.muted = true
  el.preload = 'auto'
  const ok = await new Promise<boolean>((resolve) => {
    el.addEventListener(media.type === 'video' ? 'loadeddata' : 'loadedmetadata', () => resolve(true), { once: true })
    el.addEventListener('error', () => resolve(false), { once: true })
    window.setTimeout(() => resolve(true), WAIT_MS)
    el.src = url
  })
  el.removeAttribute('src') // проверили — отпускаем
  el.load()
  return ok
}

// Загрузить файлы по одному; onProgress — после каждого
export async function preloadMedia(refs: MediaRef[], onProgress: (p: PreloadProgress) => void, cancelled: () => boolean) {
  const unique = [...new Map(refs.map((m) => [m.id, m])).values()]
  const progress: PreloadProgress = { total: unique.length, done: 0, broken: [] }
  onProgress({ ...progress })

  for (const media of unique) {
    if (cancelled()) return
    let ok = checked.get(media.id)
    if (ok === undefined) {
      const url = await loadMediaUrl(media.id)
      if (!url) {
        progress.broken.push({ name: media.name, reason: 'missing' })
      } else {
        ok = await warmUp(media, url)
        checked.set(media.id, ok)
      }
    }
    if (ok === false) progress.broken.push({ name: media.name, reason: 'broken' })
    progress.done++
    if (!cancelled()) onProgress({ ...progress, broken: [...progress.broken] })
  }
}

// Предзагрузка файлов игры в этом окне. Начинается заново, только когда меняется набор файлов.
export function usePreload(game: Game | undefined): PreloadProgress | null {
  const [progress, setProgress] = useState<PreloadProgress | null>(null)
  const refs = game ? allMediaRefs(game) : []
  const key = [...new Set(refs.map((m) => m.id))].sort().join(',')

  useEffect(() => {
    if (!game) return
    let stop = false
    void preloadMedia(allMediaRefs(game), setProgress, () => stop)
    return () => {
      stop = true
    }
    // Перезапускаем по набору файлов (key), а не при каждой правке счёта
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, !!game])

  return progress
}
