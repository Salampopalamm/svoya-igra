import { useEffect, type RefObject } from 'react'
import type { Clip, MediaRef } from './types'

// Фрагмент музыки или видео: играть не весь файл, а «с 0:45 до 1:05».
// Для музыкального раунда «угадай мелодию» — не нужно заранее резать трек в другой программе.
// Хранится в ссылке на файл (MediaRef.clip): один и тот же трек в разных вопросах может играть разными кусками.

// Секунды в «1:05» (десятые — «1:05,5»)
export function formatClipTime(sec: number): string {
  const whole = Math.floor(sec)
  const tenths = Math.round((sec - whole) * 10)
  const base = `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
  return tenths ? `${base},${tenths === 10 ? 9 : tenths}` : base
}

// «1:05», «65», «1:05,5», «1.05.5» → секунды; непонятное — null
export function parseClipTime(input: string): number | null {
  const text = input.trim().replace(',', '.')
  if (!text) return null
  const parts = text.split(':')
  if (parts.length > 3 || parts.some((p) => !/^\d+(\.\d+)?$/.test(p))) return null
  const sec = parts.reduce((sum, p) => sum * 60 + Number(p), 0)
  return Number.isFinite(sec) ? Math.round(sec * 10) / 10 : null
}

// Фрагмент без ошибок: начало не меньше нуля, конец позже начала; пустой — undefined
export function cleanClip(clip: Clip | undefined): Clip | undefined {
  if (!clip) return undefined
  const start = clip.start !== undefined && clip.start > 0 ? clip.start : undefined
  const end = clip.end !== undefined && clip.end > (start ?? 0) ? clip.end : undefined
  if (start === undefined && end === undefined) return undefined
  return { ...(start !== undefined ? { start } : {}), ...(end !== undefined ? { end } : {}) }
}

// Ссылка с новым фрагментом (пустой фрагмент — убрать)
export function withClip(media: MediaRef, clip: Clip | undefined): MediaRef {
  const next = { ...media }
  const clean = cleanClip(clip)
  if (clean) next.clip = clean
  else delete next.clip
  return next
}

export const clipStart = (clip: Clip | undefined) => clip?.start ?? 0

// Время вне фрагмента — значит, играть пора с его начала
export function outsideClip(clip: Clip | undefined, time: number): boolean {
  if (!clip) return false
  return time < clipStart(clip) - 0.3 || (clip.end !== undefined && time >= clip.end - 0.05)
}

// «с 0:45 до 1:05», «с 0:45 до конца», «с начала до 1:05»
export function describeClip(clip: Clip | undefined): string | null {
  const clean = cleanClip(clip)
  if (!clean) return null
  const from = clean.start !== undefined ? `с ${formatClipTime(clean.start)}` : 'с начала'
  const to = clean.end !== undefined ? `до ${formatClipTime(clean.end)}` : 'до конца'
  return `${from} ${to}`
}

// Плеер играет только фрагмент: встаёт на начало, запуск вне фрагмента — с начала, на конце — пауза.
// onEnd — дошли до конца фрагмента (пульт по нему останавливает видео в зале).
export function useClip(ref: RefObject<HTMLMediaElement | null>, clip: Clip | undefined, onEnd?: () => void) {
  const start = clip?.start
  const end = clip?.end
  useEffect(() => {
    const el = ref.current
    if (!el || (start === undefined && end === undefined)) return
    const range = { start, end }
    const toStart = () => {
      if (start !== undefined && el.currentTime < start) el.currentTime = start
    }
    const onPlay = () => {
      if (outsideClip(range, el.currentTime)) el.currentTime = clipStart(range)
    }
    const onTime = () => {
      if (end !== undefined && el.currentTime >= end && !el.paused) {
        el.pause()
        onEnd?.()
      }
    }
    if (el.readyState >= 1) toStart()
    el.addEventListener('loadedmetadata', toStart)
    el.addEventListener('play', onPlay)
    el.addEventListener('timeupdate', onTime)
    return () => {
      el.removeEventListener('loadedmetadata', toStart)
      el.removeEventListener('play', onPlay)
      el.removeEventListener('timeupdate', onTime)
    }
    // onEnd меняется при каждой перерисовке — слушаем только сам фрагмент
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, start, end])
}
