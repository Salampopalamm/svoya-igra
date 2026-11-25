// Уменьшение больших картинок при добавлении в игру.
// Фото с телефона — 4000×3000 точек и 5–15 МБ, а на проекторе видно не больше 1920 точек в ширину.
// Большие фото раздувают хранилище и файл игры, а пульт и зал держат каждую картинку в памяти готовой к показу:
// сотня таких фото может уронить вкладку на слабом ноутбуке. Поэтому уменьшаем — на глаз разницы нет.

const MAX_SIDE = 2560 // длинная сторона, точек: с запасом для 4K-экрана, где картинка занимает часть зала
const BIG_FILE = 1.5 * 1024 * 1024 // файл меньше — не трогаем, даже если точек много (уже хорошо сжат)
const QUALITY = 0.88

// Новое имя с другим расширением: «Фото.png» → «Фото.webp»
function renamed(name: string, ext: string) {
  const dot = name.lastIndexOf('.')
  return `${dot > 0 ? name.slice(0, dot) : name}.${ext}`
}

function toBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, QUALITY))
}

// Уменьшенная копия файла или сам файл, если уменьшать не нужно или не вышло.
// GIF (анимация) и SVG (рисунок без точек) не трогаем.
export async function shrinkImage(file: File): Promise<File> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (file.type === 'image/gif' || file.type === 'image/svg+xml' || ext === 'gif' || ext === 'svg') return file
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file) // поворот по данным телефона (EXIF) браузер учитывает сам
  } catch {
    return file // браузер не смог открыть — пусть решает обычная проверка
  }
  try {
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
    if (scale === 1 && file.size <= BIG_FILE) return file
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

    // PNG и WebP могут быть с прозрачностью — сохраняем в WebP (прозрачность остаётся), фото — в JPEG
    const mayBeTransparent = file.type === 'image/png' || file.type === 'image/webp' || ext === 'png' || ext === 'webp'
    let blob = await toBlob(canvas, mayBeTransparent ? 'image/webp' : 'image/jpeg')
    // Браузер без WebP (старый Safari) вернёт PNG — для фото это хуже исходника, проверим размер ниже
    if (!blob) return file
    if (blob.size >= file.size) return file // не выиграли — оставляем как было
    const type = blob.type || 'image/jpeg'
    const newExt = type === 'image/webp' ? 'webp' : type === 'image/png' ? 'png' : 'jpg'
    blob = blob.type ? blob : new Blob([blob], { type })
    return new File([blob], renamed(file.name, newExt), { type, lastModified: file.lastModified })
  } finally {
    bitmap.close()
  }
}
