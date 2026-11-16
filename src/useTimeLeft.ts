import { useEffect, useState } from 'react'
import { timeLeft, type TimerState } from './live'

// Сколько осталось на таймере, мс. Пока таймер идёт, экран перерисовывается несколько раз в секунду.
export function useTimeLeft(timer: TimerState | null): number {
  const [, setTick] = useState(0)
  const running = timer?.endsAt != null

  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => setTick((t) => t + 1), 200)
    return () => window.clearInterval(id)
  }, [running])

  return timer ? timeLeft(timer) : 0
}
