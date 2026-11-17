import type { PreloadProgress } from '../preload'

type Props = {
  own: PreloadProgress | null // предзагрузка в окне пульта (она же находит сломанные файлы)
  hall: { done: number; total: number } | null // сколько загрузил экран зала (null — зал не открыт)
  gameId: string
  quiet: boolean // идёт вопрос — «всё готово» не показываем, чтобы не занимать место
}

// Строка на пульте: файлы игры загружаются / готовы / какие-то не открываются
export default function MediaStatus({ own, hall, gameId, quiet }: Props) {
  if (!own || own.total === 0) return null

  if (own.broken.length > 0) {
    const missing = own.broken.filter((f) => f.reason === 'missing')
    const broken = own.broken.filter((f) => f.reason === 'broken')
    return (
      <div role="alert" className="flex flex-col gap-1 rounded-xl border-2 border-white bg-cell px-5 py-3">
        <span className="font-semibold">⚠ Не все файлы игры откроются</span>
        {missing.length > 0 && (
          <span>Нет в этом браузере: {missing.map((f) => `«${f.name}»`).join(', ')}.</span>
        )}
        {broken.length > 0 && (
          <span>Браузер не может показать: {broken.map((f) => `«${f.name}»`).join(', ')}.</span>
        )}
        <span className="text-sm text-muted">
          Замените их в{' '}
          <a href={`#/edit/${encodeURIComponent(gameId)}`} className="underline hover:text-white">
            редакторе
          </a>
          . Видео лучше сохранять в MP4.
        </span>
      </div>
    )
  }

  if (own.done < own.total) {
    return (
      <p role="status" className="text-sm text-muted">
        Загружаю файлы игры: {own.done} из {own.total}…
      </p>
    )
  }
  if (hall && hall.done < hall.total) {
    return (
      <p role="status" className="text-sm text-muted">
        Экран зала загружает файлы игры: {hall.done} из {hall.total}…
      </p>
    )
  }
  if (quiet) return null
  return (
    <p role="status" className="text-sm text-muted">
      ✓ Файлы игры загружены{hall ? ' и в зале' : ''}: {own.total}
    </p>
  )
}
