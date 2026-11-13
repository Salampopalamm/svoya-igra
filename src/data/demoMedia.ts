import type { MediaFile, MediaRef } from '../types'

// Файлы для тестовой игры. Рисуем картинку и «сочиняем» мелодию прямо в коде,
// чтобы не хранить в проекте настоящие файлы. Настоящие игры будут загружать свои.

export const demoImageRef: MediaRef = { id: 'demo-image', type: 'image', name: 'найди-звезду.svg' }
export const demoAudioRef: MediaRef = { id: 'demo-audio', type: 'audio', name: 'гамма.wav' }

export function demoMediaFiles(): MediaFile[] {
  return [
    { ...demoImageRef, blob: new Blob([starImageSvg()], { type: 'image/svg+xml' }) },
    { ...demoAudioRef, blob: scaleWav() },
  ]
}

// Картинка 16:9: много кругов и одна маленькая звезда справа внизу
function starImageSvg(): string {
  let seed = 7
  const random = () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }

  const circles: string[] = []
  for (let i = 0; i < 140; i++) {
    const x = Math.round(random() * 1280)
    const y = Math.round(random() * 720)
    const r = Math.round(12 + random() * 34)
    const gray = Math.round(70 + random() * 120)
    circles.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="rgb(${gray},${gray},${gray + 8})" />`)
  }

  // Звезда: 5 лучей вокруг точки (1010, 590)
  const points: string[] = []
  for (let i = 0; i < 10; i++) {
    const angle = (Math.PI / 5) * i - Math.PI / 2
    const radius = i % 2 === 0 ? 26 : 11
    points.push(`${(1010 + radius * Math.cos(angle)).toFixed(1)},${(590 + radius * Math.sin(angle)).toFixed(1)}`)
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" width="1280" height="720">
<rect width="1280" height="720" fill="#34363C" />
${circles.join('\n')}
<polygon points="${points.join(' ')}" fill="rgb(150,150,158)" />
</svg>`
}

// Гамма до мажор: 7 нот по 0,45 секунды, WAV 22 кГц, моно
function scaleWav(): Blob {
  const rate = 22050
  const noteSec = 0.45
  const notes = [261.63, 293.66, 329.63, 349.23, 392.0, 440.0, 493.88]
  const perNote = Math.round(rate * noteSec)
  const samples = new Int16Array(perNote * notes.length)

  notes.forEach((freq, n) => {
    for (let i = 0; i < perNote; i++) {
      const t = i / rate
      const fade = Math.min(1, i / 400, (perNote - i) / 2500) // мягкое начало и конец ноты
      samples[n * perNote + i] = Math.round(Math.sin(2 * Math.PI * freq * t) * fade * 0.4 * 32767)
    }
  })

  const header = new DataView(new ArrayBuffer(44))
  const text = (offset: number, value: string) =>
    [...value].forEach((ch, i) => header.setUint8(offset + i, ch.charCodeAt(0)))
  text(0, 'RIFF')
  header.setUint32(4, 36 + samples.byteLength, true)
  text(8, 'WAVE')
  text(12, 'fmt ')
  header.setUint32(16, 16, true) // размер блока fmt
  header.setUint16(20, 1, true) // PCM
  header.setUint16(22, 1, true) // моно
  header.setUint32(24, rate, true)
  header.setUint32(28, rate * 2, true) // байт в секунду
  header.setUint16(32, 2, true) // байт на отсчёт
  header.setUint16(34, 16, true) // бит на отсчёт
  text(36, 'data')
  header.setUint32(40, samples.byteLength, true)

  return new Blob([header.buffer, samples.buffer], { type: 'audio/wav' })
}
