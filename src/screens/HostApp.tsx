import { useEffect, useRef, useState } from 'react'
import Board from '../components/Board'
import PreviewView from '../components/PreviewView'
import QuestionView from '../components/QuestionView'
import Scoreboard from '../components/Scoreboard'
import { CHANNEL, clearState, loadState, saveState, type Current, type LiveState, type Message } from '../live'
import { mergeProgress } from '../game'
import type { Game } from '../types'

// Свежая партия: игра из хранилища, всё по нулям
function freshState(game: Game): LiveState {
  return { game, current: null, slideIndex: 0, showAnswer: false, answeringTeamId: null, screenHidden: false }
}

const HISTORY_LIMIT = 50

type CellRef = { categoryId: string; questionId: string }

// ---- Чистые функции: берут состояние и возвращают новое ----

function withPlayed(s: LiveState, cell: Current): LiveState {
  if (!cell) return s
  return {
    ...s,
    game: {
      ...s.game,
      rounds: s.game.rounds.map((r) => ({
        ...r,
        categories: r.categories.map((c) =>
          c.id !== cell.categoryId
            ? c
            : { ...c, questions: c.questions.map((q) => (q.id === cell.questionId ? { ...q, played: true } : q)) },
        ),
      })),
    },
  }
}

function withScore(s: LiveState, teamId: string, delta: number): LiveState {
  return withTeamScore(s, teamId, (score) => score + delta)
}

function withTeamScore(s: LiveState, teamId: string, change: (score: number) => number): LiveState {
  return {
    ...s,
    game: { ...s.game, teams: s.game.teams.map((t) => (t.id === teamId ? { ...t, score: change(t.score) } : t)) },
  }
}

function withClosed(s: LiveState): LiveState {
  return { ...withPlayed(s, s.current), current: null, slideIndex: 0, showAnswer: false, answeringTeamId: null }
}

// Пульт ведущего: управляет игрой и передаёт состояние экрану зала.
export default function HostApp({ initialGame }: { initialGame: Game }) {
  // Если вкладку закрывали посреди этой же игры — продолжаем с того же места.
  // Вопросы берём свежие из хранилища (их могли поправить в редакторе), счёт и сыгранные ячейки — из партии.
  const [live, setLive] = useState<LiveState>(() => {
    const saved = loadState()
    if (saved?.game?.id !== initialGame.id) return freshState(initialGame)
    const game = mergeProgress(initialGame, saved.game)
    // Отвечающую команду могли удалить на экране «Команды» — тогда снимаем выбор
    const answering = game.teams.some((t) => t.id === saved.answeringTeamId) ? saved.answeringTeamId : null
    return { ...freshState(initialGame), ...saved, game, answeringTeamId: answering ?? null }
  })
  const [history, setHistory] = useState<LiveState[]>([]) // для Ctrl+Z, только на пульте
  const [previewMode, setPreviewMode] = useState(false) // только на пульте
  const [preview, setPreview] = useState<CellRef | null>(null) // только на пульте

  const channelRef = useRef<BroadcastChannel | null>(null)
  const liveRef = useRef(live)

  const { game, current, slideIndex, showAnswer, answeringTeamId, screenHidden } = live
  const round = game.rounds[0]

  // Канал связи: экран зала при открытии спрашивает «hello» — отвечаем текущим состоянием
  useEffect(() => {
    const channel = new BroadcastChannel(CHANNEL)
    channelRef.current = channel
    channel.onmessage = (e: MessageEvent<Message>) => {
      if (e.data.type === 'hello') channel.postMessage({ type: 'state', state: liveRef.current } satisfies Message)
    }
    return () => {
      channel.close()
      channelRef.current = null
    }
  }, [])

  // При каждом изменении: сохранить и отправить в зал
  useEffect(() => {
    liveRef.current = live
    saveState(live)
    channelRef.current?.postMessage({ type: 'state', state: live } satisfies Message)
  }, [live])

  // Действие, которое можно отменить через Ctrl+Z
  function commit(next: LiveState) {
    setHistory((h) => [...h.slice(-(HISTORY_LIMIT - 1)), live])
    setLive(next)
  }

  function undo() {
    const previous = history[history.length - 1]
    if (!previous) return
    setHistory((h) => h.slice(0, -1))
    setLive(previous)
    setPreview(null)
  }

  function find(cell: CellRef | null) {
    const category = cell ? round.categories.find((c) => c.id === cell.categoryId) : undefined
    const question = category?.questions.find((q) => q.id === cell?.questionId)
    return { category, question }
  }

  const currentCell = find(current)
  const previewCell = find(preview)
  const value = currentCell.question?.value ?? 0

  // Клик по ячейке: в режиме предпросмотра — только на пульте, иначе — играем вопрос
  function handleCellClick(categoryId: string, questionId: string) {
    if (previewMode) {
      setPreview({ categoryId, questionId })
      return
    }
    commit({ ...live, current: { categoryId, questionId }, slideIndex: 0, showAnswer: false, answeringTeamId: null })
  }

  function closeQuestion() {
    commit(withClosed(live))
  }

  function handleCorrect(teamId: string) {
    if (!currentCell.question) return
    commit(withClosed(withScore(live, teamId, value)))
  }

  function handleWrong(teamId: string) {
    if (!currentCell.question) return
    commit({ ...withScore(live, teamId, -value), answeringTeamId: null })
  }

  // Ручная правка счёта (вне вопроса тоже) — отменяется через Ctrl+Z
  function adjustScore(teamId: string, delta: number) {
    commit(withScore(live, teamId, delta))
  }

  // Ведущий вписал счёт целиком — тоже отменяется через Ctrl+Z
  function setScore(teamId: string, score: number) {
    commit(withTeamScore(live, teamId, () => score))
  }

  // Листать слайды открытого вопроса: зал сразу показывает выбранный слайд
  function goToSlide(delta: number) {
    const count = currentCell.question?.slides.length ?? 1
    setLive((s) => ({ ...s, slideIndex: Math.min(Math.max(s.slideIndex + delta, 0), count - 1) }))
  }

  function showAnswerInHall() {
    commit({ ...live, showAnswer: true })
  }

  function selectTeam(teamId: string | null) {
    setLive((s) => ({ ...s, answeringTeamId: teamId }))
  }

  function toggleScreenHidden() {
    setLive((s) => ({ ...s, screenHidden: !s.screenHidden }))
  }

  function togglePreviewMode() {
    setPreviewMode((m) => !m)
    setPreview(null)
  }

  function openScreen() {
    window.open(`${window.location.pathname}#/screen`, 'svoya-igra-screen', 'popup,width=1280,height=720')
  }

  function resetGame() {
    clearState()
    setLive(freshState(initialGame))
    setHistory([])
    setPreview(null)
  }

  // Горячие клавиши
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Пока ведущий вписывает счёт или жмёт клавиши в плеере — горячие клавиши молчат
      const target = e.target as HTMLElement | null
      if (target?.closest('input, textarea, audio, video')) return

      // Ctrl+Z — отменить последнее действие
      if (e.ctrlKey && e.code === 'KeyZ') {
        e.preventDefault()
        undo()
        return
      }
      // H — скрыть / показать экран зала
      if (e.code === 'KeyH') toggleScreenHidden()
      // Esc — закрыть предпросмотр или вопрос
      if (e.code === 'Escape') {
        if (preview) setPreview(null)
        else if (current) closeQuestion()
      }
      // P — режим предпросмотра (когда вопрос не открыт)
      if (e.code === 'KeyP' && !current) togglePreviewMode()

      if (!current) return

      // ← / → — предыдущий / следующий слайд вопроса
      if (e.code === 'ArrowRight') goToSlide(1)
      if (e.code === 'ArrowLeft') goToSlide(-1)

      // Пробел — показать ответ в зале
      if (e.code === 'Space') {
        e.preventDefault()
        if (!showAnswer) showAnswerInHall()
      }
      // 1–9 и 0 — выбрать отвечающую команду (0 = десятая)
      const digit = /^(Digit|Numpad)(\d)$/.exec(e.code)
      if (digit) {
        const index = digit[2] === '0' ? 9 : Number(digit[2]) - 1
        const team = game.teams[index]
        if (team) selectTeam(team.id === answeringTeamId ? null : team.id)
      }
      // + / − — «Верно» / «Неверно» для выбранной команды
      if (answeringTeamId) {
        if (e.key === '+' || e.key === '=' || e.code === 'NumpadAdd') handleCorrect(answeringTeamId)
        if (e.key === '-' || e.code === 'NumpadSubtract') handleWrong(answeringTeamId)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const allQuestions = round.categories.flatMap((c) => c.questions)
  const played = allQuestions.filter((q) => q.played).length
  // Шаг ручной правки — самый маленький номинал раунда (обычно 100)
  const scoreStep = allQuestions.length > 0 ? Math.min(...allQuestions.map((q) => q.value)) : 100

  return (
    <div className="flex min-h-screen flex-col gap-6 bg-bg px-10 py-8 text-white">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-baseline gap-4">
          <a href="#/" className="text-sm text-muted hover:text-white">
            ← Мои игры
          </a>
          <a href={`#/teams/${encodeURIComponent(game.id)}`} className="text-sm text-muted hover:text-white">
            Команды
          </a>
          <span className="font-display text-xl">ПУЛЬТ</span>
          <span className="text-muted">
            {game.title} · {round.title} · сыграно {played} из {allQuestions.length}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={togglePreviewMode}
            aria-pressed={previewMode}
            className={`h-11 rounded-lg px-4 text-sm ${previewMode ? 'bg-white font-semibold text-black' : 'border border-line hover:bg-cell'}`}
          >
            Предпросмотр: {previewMode ? 'вкл' : 'выкл'} · P
          </button>
          <button
            type="button"
            onClick={toggleScreenHidden}
            aria-pressed={screenHidden}
            className={`h-11 rounded-lg px-4 text-sm ${screenHidden ? 'bg-white font-semibold text-black' : 'border border-line hover:bg-cell'}`}
          >
            {screenHidden ? 'Экран зала скрыт · H' : 'Скрыть экран зала · H'}
          </button>
          <button
            type="button"
            onClick={undo}
            disabled={history.length === 0}
            className="h-11 rounded-lg border border-line px-4 text-sm hover:bg-cell disabled:opacity-40"
          >
            Отменить · Ctrl+Z
          </button>
          <button
            type="button"
            onClick={openScreen}
            className="h-11 rounded-lg border border-white px-4 text-sm font-semibold hover:bg-white hover:text-black"
          >
            Открыть экран для зала
          </button>
          <button
            type="button"
            onClick={resetGame}
            className="h-11 rounded-lg border border-line px-4 text-sm hover:bg-cell"
          >
            Начать заново
          </button>
        </div>
      </header>

      {preview && previewCell.category && previewCell.question ? (
        <PreviewView
          categoryTitle={previewCell.category.title}
          question={previewCell.question}
          onClose={() => setPreview(null)}
        />
      ) : current && currentCell.category && currentCell.question ? (
        <QuestionView
          categoryTitle={currentCell.category.title}
          question={currentCell.question}
          showAnswer={showAnswer}
          teams={game.teams}
          answeringTeamId={answeringTeamId}
          onSelectTeam={selectTeam}
          onShowAnswer={showAnswerInHall}
          onCorrect={handleCorrect}
          onWrong={handleWrong}
          onClose={closeQuestion}
          slideIndex={slideIndex}
          onPrevSlide={() => goToSlide(-1)}
          onNextSlide={() => goToSlide(1)}
        />
      ) : (
        <Board round={round} onCellClick={handleCellClick} />
      )}

      <Scoreboard
        teams={game.teams}
        answeringTeamId={answeringTeamId}
        onAdjust={adjustScore}
        onSetScore={setScore}
        step={scoreStep}
      />

      <footer className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted">
        <span>P — предпросмотр</span>
        <span>← / → — слайды вопроса</span>
        <span>Пробел — ответ в зале</span>
        <span>Клик по счёту — вписать счёт</span>
        <span>1–9, 0 — отвечающая команда</span>
        <span>+ / − — верно / неверно</span>
        <span>Ctrl+Z — отменить</span>
        <span>H — скрыть экран зала</span>
        <span>Esc — закрыть</span>
      </footer>
    </div>
  )
}
