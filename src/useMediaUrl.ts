import { useEffect, useState } from 'react'
import { getMedia } from './db'
import type { MediaRef } from './types'

type Loaded = { id: string; url: string | null } // url = null — файла нет в хранилище

// Достаёт файл из хранилища и даёт временную ссылку на него для <img>, <audio>, <video>
export function useMediaUrl(media: MediaRef | undefined) {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const id = media?.id

  useEffect(() => {
    if (!id) return
    let cancelled = false
    let url: string | null = null
    getMedia(id).then((file) => {
      if (cancelled) return
      url = file ? URL.createObjectURL(file.blob) : null
      setLoaded({ id, url })
    })
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url) // освобождаем память, когда файл больше не на экране
    }
  }, [id])

  if (!id || loaded?.id !== id) return { status: 'loading' as const }
  return loaded.url ? { status: 'ready' as const, url: loaded.url } : { status: 'missing' as const }
}
