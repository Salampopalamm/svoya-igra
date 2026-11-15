import { useEffect, useRef, useState } from 'react'
import Board from '../components/Board'
import QuestionEditor from '../components/QuestionEditor'
import { deleteMediaIfUnused, saveGame } from '../db'
import { updateQuestion } from '../game'
import type { Game, Question } from '../types'

// Подпись под номиналом на табло редактора: видно, где уже есть картинка или музыка
function cellNote(question: Question): string | null {
  const kinds = { image: 'картинка', gif: 'GIF', video: 'видео', audio: 'музыка' }
  const media = question.slides.map((s) => s.media && kinds[s.media.type]).filter(Boolean)
  if (media.length > 0) return media.join(' + ')
  const count = question.slides.length
  return count > 1 ? `${count} ${count < 5 ? 'слайда' : 'слайдов'}` : null
}

// Редактор игры: клик по ячейке табло открывает редактор вопроса. Правки сохраняются сами.
export default function EditorApp({ initialGame }: { initialGame: Game }) {
  const [game, setGame] = useState(initialGame)
  const [selectedId, setSelectedId] = useState<string | null>(null) // какой вопрос открыт
  const [saved, setSaved] = useState(true)
  const removedMedia = useRef<string[]>([]) // файлы, убранные из вопросов: удалим после сохранения

  // Автосохранение: после каждой правки кладём игру в хранилище
  useEffect(() => {
    if (game === initialGame) return // ничего ещё не меняли
    let cancelled = false
    saveGame(game).then(async () => {
      for (const id of removedMedia.current.splice(0)) await deleteMediaIfUnused(id)
      if (!cancelled) setSaved(true)
    })
    return () => {
      cancelled = true
    }
  }, [game, initialGame])

  function changeQuestion(questionId: string, change: (q: Question) => Question) {
    setSaved(false)
    setGame((g) => updateQuestion(g, questionId, change))
  }

  const round = game.rounds[0]
  const category = round.categories.find((c) => c.questions.some((q) => q.id === selectedId))
  const question = category?.questions.find((q) => q.id === selectedId)

  return (
    <div className="flex min-h-screen flex-col gap-6 bg-bg px-10 py-8 text-white">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-baseline gap-4">
          <a href="#/" className="text-sm text-muted hover:text-white">
            ← Мои игры
          </a>
          <span className="font-display text-xl">РЕДАКТОР</span>
          <span className="text-muted">
            {game.title} · {round.title}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted" aria-live="polite">
            {saved ? 'Все изменения сохранены' : 'Сохраняю…'}
          </span>
          <a
            href={`#/play/${encodeURIComponent(game.id)}`}
            className="flex h-11 items-center rounded-lg bg-white px-5 font-semibold text-black hover:opacity-90"
          >
            Играть
          </a>
        </div>
      </header>

      {category && question ? (
        <QuestionEditor
          key={question.id}
          categoryTitle={category.title}
          question={question}
          onChange={(change) => changeQuestion(question.id, change)}
          onMediaRemoved={(id) => removedMedia.current.push(id)}
          onClose={() => setSelectedId(null)}
        />
      ) : (
        <>
          <p className="text-muted">Нажмите на ячейку, чтобы изменить вопрос: текст, слайды, картинку или музыку.</p>
          <Board round={round} onCellClick={(_, questionId) => setSelectedId(questionId)} cellNote={cellNote} />
        </>
      )}
    </div>
  )
}
