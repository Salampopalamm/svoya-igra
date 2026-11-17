import { createContext, useContext, useEffect, type RefObject } from 'react'
import type { VideoState } from './live'

export type VideoCommand = { playing?: boolean; time?: number; volume?: number }

// Видео в партии: что сейчас велел ведущий, и (только на пульте) как отдать новую команду
export type VideoControl = {
  video: VideoState | null
  send?: (mediaId: string, command: VideoCommand) => void
  onBlocked?: () => void // в зале: браузер не дал включить звук
  freePlay?: boolean // предпросмотр в редакторе: видео «как в зале», но с обычными кнопками плеера
}

export const VideoContext = createContext<VideoControl>({ video: null })

export function useVideoControl() {
  return useContext(VideoContext)
}

// Видео на странице слушается команд ведущего: перематывает, запускает, останавливает, меняет громкость.
// onBlocked — браузер не дал играть со звуком (окно зала ещё не кликали).
export function useFollowVideo(ref: RefObject<HTMLVideoElement | null>, state: VideoState | null, onBlocked?: () => void) {
  const seq = state?.seq
  const volume = state?.volume ?? 1

  useEffect(() => {
    const el = ref.current
    if (!el || !state) return
    if (Math.abs(el.currentTime - state.time) > 0.5) el.currentTime = state.time
    if (!state.playing) {
      el.pause()
      return
    }
    el.play().catch(() => {
      // Без клика по окну браузер разрешает видео только без звука — играем так, чтобы картинка не встала
      if (el.muted) return
      el.muted = true
      void el.play().catch(() => undefined)
      onBlocked?.()
    })
    // Слушаемся только новых команд (seq), а не каждой перерисовки
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seq])

  useEffect(() => {
    if (ref.current) ref.current.volume = volume
  }, [ref, volume])
}
