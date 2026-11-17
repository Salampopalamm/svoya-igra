import { useEffect, useState } from 'react'
import { getMedia } from './db'
import type { MediaRef } from './types'

// Временные ссылки на файлы из хранилища — одни на всё окно.
// Файл, который уже достали (или загрузили заранее, см. preload.ts), показывается сразу, без «Загрузка файла…».
// Ссылки живут, пока открыто окно: сам файл лежит на диске, лишней памяти они почти не занимают.
const urls = new Map<string, string>()
const pending = new Map<string, Promise<string | null>>()

// Ссылка на файл; null — файла нет в хранилище этого браузера
export function loadMediaUrl(id: string): Promise<string | null> {
  const ready = urls.get(id)
  if (ready) return Promise.resolve(ready)
  let request = pending.get(id)
  if (!request) {
    request = getMedia(id).then((file) => {
      pending.delete(id)
      if (!file) return null // не запоминаем: файл могут добавить позже (например, открыв файл игры)
      const url = URL.createObjectURL(file.blob)
      urls.set(id, url)
      return url
    })
    pending.set(id, request)
  }
  return request
}

type Loaded = { id: string; url: string | null } // url = null — файла нет в хранилище

// Достаёт файл из хранилища и даёт ссылку на него для <img>, <audio>, <video>
export function useMediaUrl(media: MediaRef | undefined) {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const id = media?.id
  const cached = id ? urls.get(id) : undefined

  useEffect(() => {
    if (!id || urls.has(id)) return
    let cancelled = false
    loadMediaUrl(id).then((url) => {
      if (!cancelled) setLoaded({ id, url })
    })
    return () => {
      cancelled = true
    }
  }, [id])

  if (cached) return { status: 'ready' as const, url: cached }
  if (!id || loaded?.id !== id) return { status: 'loading' as const }
  return loaded.url ? { status: 'ready' as const, url: loaded.url } : { status: 'missing' as const }
}
