// Сигнал «время вышло». Играет в окне пульта: там ведущий кликает, и браузер не глушит звук.
// Звук синтезирует сам браузер (Web Audio) — файл не нужен.

let audio: AudioContext | null = null

// Один тон: частота (Гц), начало и длительность (секунды от «сейчас»)
function tone(ctx: AudioContext, freq: number, start: number, length: number) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'square'
  osc.frequency.value = freq
  const t = ctx.currentTime + start
  // Плавно включить и выключить, чтобы не щёлкало
  gain.gain.setValueAtTime(0, t)
  gain.gain.linearRampToValueAtTime(0.12, t + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.001, t + length)
  osc.connect(gain).connect(ctx.destination)
  osc.start(t)
  osc.stop(t + length + 0.05)
}

// Три коротких сигнала
export function playTimeUp() {
  audio ??= new AudioContext()
  void audio.resume()
  for (const start of [0, 0.25, 0.5]) tone(audio, 880, start, 0.18)
}
