import { getMedia } from './db'
import type { Theme } from './types'

// Сигналы игры. Играют в окне пульта: там ведущий кликает, и браузер не глушит звук.
// Стандартные сигналы браузер синтезирует сам (файлы не нужны), «верно» и «неверно» можно заменить своими.

export type SoundKind = 'correct' | 'wrong' | 'time-up'

let audio: AudioContext | null = null

// Один тон: частота (Гц), начало и длительность (секунды от «сейчас»)
function tone(ctx: AudioContext, freq: number, start: number, length: number, wave: OscillatorType, volume: number) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = wave
  osc.frequency.value = freq
  const t = ctx.currentTime + start
  // Плавно включить и выключить, чтобы не щёлкало
  gain.gain.setValueAtTime(0, t)
  gain.gain.linearRampToValueAtTime(volume, t + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.001, t + length)
  osc.connect(gain).connect(ctx.destination)
  osc.start(t)
  osc.stop(t + length + 0.05)
}

function playBuiltIn(kind: SoundKind) {
  audio ??= new AudioContext()
  const ctx = audio
  void ctx.resume()
  if (kind === 'correct') {
    // Три ноты вверх: до — ми — соль
    tone(ctx, 523, 0, 0.18, 'triangle', 0.35)
    tone(ctx, 659, 0.12, 0.18, 'triangle', 0.35)
    tone(ctx, 784, 0.24, 0.45, 'triangle', 0.35)
  } else if (kind === 'wrong') {
    // Два низких гудка вниз
    tone(ctx, 196, 0, 0.3, 'sawtooth', 0.18)
    tone(ctx, 147, 0.28, 0.5, 'sawtooth', 0.18)
  } else {
    // Время вышло: три коротких сигнала
    for (const start of [0, 0.25, 0.5]) tone(ctx, 880, start, 0.18, 'square', 0.12)
  }
}

// Свои файлы держим наготове, чтобы сигнал звучал сразу, без задержки
const loaded = new Map<string, Promise<string | null>>()

function fileUrl(id: string): Promise<string | null> {
  let url = loaded.get(id)
  if (!url) {
    url = getMedia(id).then((file) => (file ? URL.createObjectURL(file.blob) : null))
    loaded.set(id, url)
  }
  return url
}

// Заранее подгрузить свои сигналы игры (при открытии пульта)
export function preloadSounds(sounds: Theme['sounds']) {
  for (const ref of [sounds.correct, sounds.wrong]) if (ref) void fileUrl(ref.id)
}

// Сыграть сигнал. force — даже если звуки выключены (кнопка «Прослушать» в редакторе).
export async function playSound(kind: SoundKind, sounds: Theme['sounds'], force = false) {
  if (!sounds.enabled && !force) return
  const custom = kind === 'correct' ? sounds.correct : kind === 'wrong' ? sounds.wrong : undefined
  const url = custom ? await fileUrl(custom.id) : null
  if (!url) {
    playBuiltIn(kind) // своего файла нет (или он пропал) — стандартный сигнал
    return
  }
  try {
    await new Audio(url).play()
  } catch {
    playBuiltIn(kind)
  }
}
