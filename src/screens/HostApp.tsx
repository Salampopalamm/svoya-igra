import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import Board from '../components/Board'
import PreviewView from '../components/PreviewView'
import HostSettings, { GearIcon } from '../components/HostSettings'
import MediaStatus from '../components/MediaStatus'
import QuestionView from '../components/QuestionView'
import Scoreboard from '../components/Scoreboard'
import {
  CHANNEL,
  clearState,
  loadState,
  newTimer,
  pauseTimer,
  saveState,
  startTimer,
  type Current,
  type LiveState,
  type HallStatus,
  type Message,
} from '../live'
import { VideoContext, type VideoCommand } from '../videoControl'
import { playTimeUp } from '../sounds'
import { updateStoredGame } from '../db'
import { mergeProgress, nextTeamId, roundById } from '../game'
import type { Game, Theme } from '../types'
import { FONTS, TONES } from '../theme'
import { usePinnedControls, type ControlId } from '../hostControls'
import { usePreload } from '../preload'

// Свежая партия: игра из хранилища, всё по нулям
function freshState(game: Game): LiveState {
  return {
    game,
    roundId: game.rounds[0]?.id ?? null,
    current: null,
    slideIndex: 0,
    showAnswer: false,
    answeringTeamId: null,
    turnTeamId: game.teams[0]?.id ?? null,
    triedTeamIds: [],
    screenHidden: false,
    timer: null,
    video: null,
  }
}

const HISTORY_LIMIT = 50
const DEFAULT_TIMER_SEC = 30 // клавиша T на вопросе без таймера

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

// Закрыть вопрос: ячейка сыграна, ход переходит к следующей команде по кругу
function withClosed(s: LiveState): LiveState {
  return {
    ...withPlayed(s, s.current),
    current: null,
    slideIndex: 0,
    showAnswer: false,
    answeringTeamId: null,
    triedTeamIds: [],
    turnTeamId: nextTeamId(s.game, s.turnTeamId),
    timer: null,
    video: null,
  }
}

// Пульт ведущего: управляет игрой и передаёт состояние экрану зала.
export default function HostApp({ initialGame }: { initialGame: Game }) {
  // Если вкладку закрывали посреди этой же игры — продолжаем с того же места.
  // Вопросы берём свежие из хранилища (их могли поправить в редакторе), счёт и сыгранные ячейки — из партии.
  const [live, setLive] = useState<LiveState>(() => {
    const saved = loadState()
    if (saved?.game?.id !== initialGame.id) return freshState(initialGame)
    const game = mergeProgress(initialGame, saved.game)
    // Команды могли удалить на экране «Команды» — тогда снимаем выбор, а ход отдаём первой
    const exists = (id: string | null | undefined): id is string => game.teams.some((t) => t.id === id)
    return {
      ...freshState(initialGame),
      ...saved,
      game,
      answeringTeamId: exists(saved.answeringTeamId) ? saved.answeringTeamId : null,
      turnTeamId: exists(saved.turnTeamId) ? saved.turnTeamId : (game.teams[0]?.id ?? null),
      triedTeamIds: (saved.triedTeamIds ?? []).filter(exists),
      video: null, // видео после перезагрузки не продолжаем само — ведущий запустит снова
    }
  })
  const [history, setHistory] = useState<LiveState[]>([]) // для Ctrl+Z, только на пульте
  const [previewMode, setPreviewMode] = useState(false) // только на пульте
  const [preview, setPreview] = useState<CellRef | null>(null) // только на пульте
  const [hallStatus, setHallStatus] = useState<HallStatus | null>(null) // null — зал ещё не отзывался
  const [hallMedia, setHallMedia] = useState<{ done: number; total: number } | null>(null) // файлы, загруженные в зале
  const [settingsOpen, setSettingsOpen] = useState(false) // открыта панель настроек (⚙)
  const { pinned, toggle: togglePin } = usePinnedControls() // кнопки на панели ведущего

  const channelRef = useRef<BroadcastChannel | null>(null)
  const liveRef = useRef(live)

  const { game, current, slideIndex, showAnswer, answeringTeamId, turnTeamId, triedTeamIds, screenHidden } = live
  const round = roundById(game, live.roundId)
  const media = usePreload(game) // файлы игры заранее, и проверка, что все открываются

  // Канал связи: экран зала при открытии спрашивает «hello» — отвечаем текущим состоянием
  useEffect(() => {
    const channel = new BroadcastChannel(CHANNEL)
    channelRef.current = channel
    channel.onmessage = (e: MessageEvent<Message>) => {
      if (e.data.type === 'hello') channel.postMessage({ type: 'state', state: liveRef.current } satisfies Message)
      if (e.data.type === 'hall') setHallStatus(e.data.status)
      if (e.data.type === 'hall-media') setHallMedia({ done: e.data.done, total: e.data.total })
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
    // Первой отвечает команда, чей ход. Таймер вопроса ждёт, пока ведущий его запустит.
    const { question } = find({ categoryId, questionId })
    commit({
      ...live,
      current: { categoryId, questionId },
      slideIndex: 0,
      showAnswer: false,
      answeringTeamId: turnTeamId,
      triedTeamIds: [],
      timer: newTimer(question?.timerSec),
      video: null,
    })
  }

  function closeQuestion() {
    commit(withClosed(live))
  }

  // Перейти к другому раунду (только с табло, не посреди вопроса); отменяется через Ctrl+Z
  function switchRound(roundId: string) {
    if (current || roundId === round.id) return
    commit({ ...live, roundId })
    setPreview(null)
  }

  // Верно: команда получает стоимость, вопрос закрывается, ход — следующей по кругу
  function handleCorrect(teamId: string) {
    if (!currentCell.question || triedTeamIds.includes(teamId)) return
    commit(withClosed(withScore(live, teamId, value)))
  }

  // Неверно: команда теряет стоимость, вопрос остаётся открытым — его могут перехватить остальные
  function handleWrong(teamId: string) {
    if (!currentCell.question || triedTeamIds.includes(teamId)) return
    commit({ ...withScore(live, teamId, -value), answeringTeamId: null, triedTeamIds: [...triedTeamIds, teamId] })
  }

  // Сигнал «время вышло» можно выключить
  function toggleSounds() {
    changeTheme({ sounds: { ...game.theme.sounds, enabled: !game.theme.sounds.enabled } })
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
    setLive((s) => {
      const slideIndex = Math.min(Math.max(s.slideIndex + delta, 0), count - 1)
      // Ушли со слайда с видео — оно останавливается
      return slideIndex === s.slideIndex ? s : { ...s, slideIndex, video: null }
    })
  }

  // Команда видео в зале: играть / стоять, с какой секунды, громкость. Не отменяется через Ctrl+Z.
  function sendVideo(mediaId: string, command: VideoCommand) {
    setLive((s) => {
      const prev = s.video?.mediaId === mediaId ? s.video : null
      const video = {
        mediaId,
        playing: command.playing ?? prev?.playing ?? false,
        time: command.time ?? prev?.time ?? 0,
        volume: command.volume ?? prev?.volume ?? 1,
        // Громкость меняется без перемотки — для неё номер команды не растёт
        seq: (s.video?.seq ?? 0) + (command.playing !== undefined || command.time !== undefined ? 1 : 0),
      }
      return { ...s, video }
    })
  }

  // Ответ в зале — таймер больше не нужен, останавливаем
  function showAnswerInHall() {
    commit({ ...live, showAnswer: true, timer: live.timer && pauseTimer(live.timer) })
  }

  // Таймер: запустить / пауза (клавиша T). Не отменяется через Ctrl+Z — это не ход игры.
  // Если таймера у вопроса нет — запускаем на стандартное время.
  function toggleTimer() {
    setLive((s) => {
      const timer = s.timer ?? newTimer(DEFAULT_TIMER_SEC)
      if (!s.current || !timer) return s
      return { ...s, timer: timer.endsAt === null ? startTimer(timer) : pauseTimer(timer) }
    })
  }

  // Ведущий выбрал время таймера (null — убрать таймер из зала). Таймер встаёт на начало и ждёт запуска.
  function setTimerLength(sec: number | null) {
    setLive((s) => (s.current ? { ...s, timer: newTimer(sec ?? undefined) } : s))
  }

  // Таймер сначала (например, для перехвата)
  function resetTimer() {
    setLive((s) => (s.timer ? { ...s, timer: newTimer(s.timer.totalSec) } : s))
  }

  // Кто отвечает сейчас (основная команда или перехват). Ошибившимся командам отвечать нельзя.
  function selectTeam(teamId: string | null) {
    if (teamId && triedTeamIds.includes(teamId)) return
    setLive((s) => ({ ...s, answeringTeamId: teamId }))
  }

  // Ведущий передал ход другой команде — отменяется через Ctrl+Z
  function setTurn(teamId: string) {
    if (teamId !== turnTeamId) commit({ ...live, turnTeamId: teamId })
  }

  // Номер команды (клавиша или кружок на счёте): на табло — передать ход, в вопросе — кто отвечает
  function pickTeam(teamId: string) {
    if (!current) setTurn(teamId)
    else selectTeam(teamId === answeringTeamId ? null : teamId)
  }

  // Вид команд в зале — это оформление игры: меняем в партии (зал видит сразу) и запоминаем в хранилище
  function changeTheme(patch: Partial<Theme>) {
    setLive((s) => ({ ...s, game: { ...s.game, theme: { ...s.game.theme, ...patch } } }))
    void updateStoredGame(game.id, (g) => ({ ...g, theme: { ...g.theme, ...patch } }))
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
    setLive(freshState({ ...initialGame, theme: game.theme })) // вид команд, выбранный в игре, оставляем
    setHistory([])
    setPreview(null)
  }

  // Горячие клавиши
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Пока ведущий вписывает счёт или жмёт клавиши в плеере — горячие клавиши молчат
      const target = e.target as HTMLElement | null
      if (target?.closest('input, textarea, select, audio, video')) return

      // Ctrl+Z — отменить последнее действие
      if (e.ctrlKey && e.code === 'KeyZ') {
        e.preventDefault()
        undo()
        return
      }
      // H — скрыть / показать экран зала
      if (e.code === 'KeyH') toggleScreenHidden()
      // Esc — закрыть настройки, предпросмотр или вопрос
      if (e.code === 'Escape') {
        if (settingsOpen) setSettingsOpen(false)
        else if (preview) setPreview(null)
        else if (current) closeQuestion()
      }
      // P — режим предпросмотра (когда вопрос не открыт)
      if (e.code === 'KeyP' && !current) togglePreviewMode()

      // 1–9 и 0 — команда по номеру (0 = десятая): на табло — чей ход, в вопросе — кто отвечает
      const digit = /^(Digit|Numpad)(\d)$/.exec(e.code)
      if (digit) {
        const index = digit[2] === '0' ? 9 : Number(digit[2]) - 1
        const team = game.teams[index]
        if (team) pickTeam(team.id)
      }

      if (!current) return

      // ← / → — предыдущий / следующий слайд вопроса
      if (e.code === 'ArrowRight') goToSlide(1)
      if (e.code === 'ArrowLeft') goToSlide(-1)

      // T — запустить / остановить таймер вопроса
      if (e.code === 'KeyT') toggleTimer()

      // Пробел — показать ответ в зале
      if (e.code === 'Space') {
        e.preventDefault()
        if (!showAnswer) showAnswerInHall()
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

  const turnTeam = game.teams.find((t) => t.id === turnTeamId)
  const answeringTeam = game.teams.find((t) => t.id === answeringTeamId)
  const stealing = triedTeamIds.length > 0 // основная команда ошиблась — идёт перехват
  // Что подсвечено на счёте: на табло — чей ход, в вопросе — кто отвечает
  const activeTeamId = current ? answeringTeamId : turnTeamId
  const activeLabel = current ? (stealing ? 'ПЕРЕХВАТ' : 'ОТВЕЧАЕТ') : 'ХОД'
  const teamsStatus = !current
    ? turnTeam && ` · ход: ${turnTeam.name}`
    : answeringTeam
      ? ` · ${stealing ? 'перехватывает' : 'отвечает'} ${answeringTeam.name}`
      : stealing && ' · перехват'
  const photosView = game.theme.teamView === 'photos'
  const allQuestions = round.categories.flatMap((c) => c.questions)
  const played = allQuestions.filter((q) => q.played).length
  // Шаг ручной правки — самый маленький номинал раунда (обычно 100)
  const scoreStep = allQuestions.length > 0 ? Math.min(...allQuestions.map((q) => q.value)) : 100

  // Кнопка пульта по её id: одна и та же — и на панели ведущего, и в настройках
  function renderControl(id: ControlId): ReactNode {
    const toggleClass = (on: boolean) =>
      `h-11 rounded-lg px-4 text-sm ${on ? 'bg-white font-semibold text-black' : 'border border-line hover:bg-cell'}`
    switch (id) {
      case 'preview':
        return (
          <button type="button" onClick={togglePreviewMode} aria-pressed={previewMode} className={toggleClass(previewMode)}>
            Предпросмотр: {previewMode ? 'вкл' : 'выкл'} · P
          </button>
        )
      case 'undo':
        return (
          <button
            type="button"
            onClick={undo}
            disabled={history.length === 0}
            className="h-11 rounded-lg border border-line px-4 text-sm hover:bg-cell disabled:opacity-40"
          >
            Отменить · Ctrl+Z
          </button>
        )
      case 'teams':
        return (
          <a
            href={`#/teams/${encodeURIComponent(game.id)}`}
            className="flex h-11 items-center rounded-lg border border-line px-4 text-sm hover:bg-cell"
          >
            Команды и игроки
          </a>
        )
      case 'reset':
        return (
          <button type="button" onClick={resetGame} className="h-11 rounded-lg border border-line px-4 text-sm hover:bg-cell">
            Начать заново
          </button>
        )
      case 'open-screen':
        return (
          <button
            type="button"
            onClick={openScreen}
            className="h-11 rounded-lg border border-white px-4 text-sm font-semibold hover:bg-white hover:text-black"
          >
            {hallStatus === 'ready' ? 'Экран зала открыт · звук вкл' : 'Открыть экран для зала'}
          </button>
        )
      case 'hide-screen':
        return (
          <button type="button" onClick={toggleScreenHidden} aria-pressed={screenHidden} className={toggleClass(screenHidden)}>
            {screenHidden ? 'Экран зала скрыт · H' : 'Скрыть экран зала · H'}
          </button>
        )
      case 'tone':
        return <ToneButtons theme={game.theme} onChange={changeTheme} />
      case 'font':
        return <FontSelect theme={game.theme} onChange={changeTheme} />
      case 'grayscale':
        return (
          <button
            type="button"
            onClick={() => changeTheme({ grayscaleMedia: !game.theme.grayscaleMedia })}
            aria-pressed={game.theme.grayscaleMedia}
            className={toggleClass(game.theme.grayscaleMedia)}
          >
            Обесцветить медиа: {game.theme.grayscaleMedia ? 'вкл' : 'выкл'}
          </button>
        )
      case 'team-view':
        return (
          <div role="group" aria-label="Вид команд в зале" className="flex flex-wrap gap-2">
            <button type="button" onClick={() => changeTheme({ teamView: 'photos' })} aria-pressed={photosView} className={toggleClass(photosView)}>
              Вид: имена + фото
            </button>
            <button type="button" onClick={() => changeTheme({ teamView: 'compact' })} aria-pressed={!photosView} className={toggleClass(!photosView)}>
              Вид: номера / названия
            </button>
          </div>
        )
      case 'photos':
        return (
          <button
            type="button"
            onClick={() => changeTheme({ showPhotos: !game.theme.showPhotos })}
            disabled={!photosView}
            title={photosView ? undefined : 'Фото видны только в виде «имена + фото»'}
            className="h-11 rounded-lg border border-line px-4 text-sm hover:bg-cell disabled:opacity-40"
          >
            {game.theme.showPhotos ? 'Свернуть фото' : 'Показать фото'}
          </button>
        )
      case 'timer-sound':
        return (
          <button type="button" onClick={toggleSounds} aria-pressed={game.theme.sounds.enabled} className={toggleClass(game.theme.sounds.enabled)}>
            Звук таймера: {game.theme.sounds.enabled ? 'вкл' : 'выкл'}
          </button>
        )
    }
  }

  return (
    <div className="flex min-h-screen flex-col gap-6 bg-bg px-10 py-8 text-white">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <a href="#/" className="text-sm text-muted hover:text-white">
            ← Мои игры
          </a>
          <span className="font-display text-xl">ПУЛЬТ</span>
          <span className="text-muted">
            {game.title} · {round.title} · сыграно {played} из {allQuestions.length}
          </span>
          {game.rounds.length > 1 && (
            <div role="group" aria-label="Раунд на табло" className="flex gap-1.5">
              {game.rounds.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => switchRound(r.id)}
                  disabled={!!current}
                  aria-pressed={r.id === round.id}
                  title={current ? 'Сначала закройте вопрос' : undefined}
                  className={`h-11 rounded-lg px-3 text-sm ${r.id === round.id ? 'bg-white font-semibold text-black' : 'border border-line hover:bg-cell disabled:opacity-40'}`}
                >
                  {r.title}
                </button>
              ))}
            </div>
          )}
        </div>
        {/* Панель ведущего: закреплённые кнопки и ⚙ — все настройки по категориям */}
        <div className="flex flex-wrap items-center gap-2">
          {pinned.map((id) => (
            <Fragment key={id}>{renderControl(id)}</Fragment>
          ))}
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            aria-label="Настройки пульта"
            aria-expanded={settingsOpen}
            title="Настройки"
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-line hover:bg-cell"
          >
            <GearIcon />
          </button>
        </div>
      </header>

      {settingsOpen && (
        <HostSettings
          render={renderControl}
          pinned={pinned}
          onTogglePin={togglePin}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      <MediaStatus
        own={media}
        hall={hallStatus && hallStatus !== 'closed' ? hallMedia : null}
        gameId={game.id}
        quiet={!!current}
      />

      {hallStatus === 'waiting-click' && (
        <div role="status" className="rounded-xl border-2 border-white bg-cell px-5 py-3 font-semibold">
          Экран зала ждёт клика: щёлкните по нему мышкой один раз — включится звук и полный экран.
        </div>
      )}

      {preview && previewCell.category && previewCell.question ? (
        <PreviewView
          categoryTitle={previewCell.category.title}
          question={previewCell.question}
          onClose={() => setPreview(null)}
        />
      ) : current && currentCell.category && currentCell.question ? (
        <VideoContext.Provider value={{ video: live.video, send: sendVideo }}>
          <QuestionView
            categoryTitle={currentCell.category.title}
            question={currentCell.question}
            showAnswer={showAnswer}
            teams={game.teams}
            answeringTeamId={answeringTeamId}
            turnTeamId={turnTeamId}
            triedTeamIds={triedTeamIds}
            nextTurnTeamName={game.teams.find((t) => t.id === nextTeamId(game, turnTeamId))?.name}
            onSelectTeam={selectTeam}
            onShowAnswer={showAnswerInHall}
            onCorrect={handleCorrect}
            onWrong={handleWrong}
            onClose={closeQuestion}
            slideIndex={slideIndex}
            onPrevSlide={() => goToSlide(-1)}
            onNextSlide={() => goToSlide(1)}
            timer={live.timer}
            onToggleTimer={toggleTimer}
            onResetTimer={resetTimer}
            onSetTimerLength={setTimerLength}
            onTimeUp={() => {
              if (game.theme.sounds.enabled) playTimeUp()
            }}
          />
        </VideoContext.Provider>
      ) : (
        <Board round={round} onCellClick={handleCellClick} />
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xs font-semibold tracking-widest text-muted">
          КОМАНДЫ{teamsStatus || ''}
        </h2>
      </div>

      <Scoreboard
        teams={game.teams}
        players={game.players}
        activeTeamId={activeTeamId}
        activeLabel={activeLabel}
        outTeamIds={current ? triedTeamIds : []}
        onPickTeam={pickTeam}
        pickLabel={current ? 'Отвечает команда' : 'Передать ход команде'}
        onAdjust={adjustScore}
        onSetScore={setScore}
        step={scoreStep}
      />

      <footer className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted">
        <span>P — предпросмотр</span>
        <span>← / → — слайды вопроса</span>
        <span>Пробел — ответ в зале</span>
        <span>T — таймер</span>
        <span>Клик по счёту — вписать счёт</span>
        <span>1–9, 0 — чей ход / кто отвечает</span>
        <span>+ / − — верно / неверно</span>
        <span>Ctrl+Z — отменить</span>
        <span>H — скрыть экран зала</span>
        <span>Esc — закрыть</span>
      </footer>
    </div>
  )
}

// Фон зала (макет «Main»): пять тонов кружками. Меняется только экран зала; выбор запоминается в игре.
function ToneButtons({ theme, onChange }: { theme: Theme; onChange: (patch: Partial<Theme>) => void }) {
  return (
    <div role="group" aria-label="Фон зала" className="flex flex-wrap items-center gap-2">
      <span className="mr-1 text-sm text-muted">Фон зала</span>
      {TONES.map((tone) => {
        const chosen = theme.backgroundTone === tone.id
        return (
          <button
            key={tone.id}
            type="button"
            onClick={() => onChange({ backgroundTone: tone.id })}
            aria-pressed={chosen}
            aria-label={`Фон: ${tone.name}`}
            title={tone.name}
            className={`flex h-11 w-11 items-center justify-center rounded-lg ${chosen ? 'border-2 border-white' : 'border border-line hover:bg-cell'}`}
          >
            <span className="h-6 w-6 rounded-full border border-line" style={{ background: tone.bg }} />
          </button>
        )
      })}
    </div>
  )
}

// Шрифт заголовков и номиналов в зале — один из восьми
function FontSelect({ theme, onChange }: { theme: Theme; onChange: (patch: Partial<Theme>) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm text-muted">
      Шрифт
      <select
        value={theme.headingFont}
        onChange={(e) => onChange({ headingFont: e.target.value })}
        className="h-11 rounded-lg border border-line bg-cell px-3 text-sm text-white"
      >
        {FONTS.map((f) => (
          <option key={f.family} value={f.family}>
            {f.family} — {f.note}
          </option>
        ))}
      </select>
    </label>
  )
}
