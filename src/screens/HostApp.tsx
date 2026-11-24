import { APP_KEY } from '../site'
import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import Board from '../components/Board'
import SizeSliders from '../components/SizeSliders'
import PreviewView from '../components/PreviewView'
import HostSettings, { GearIcon } from '../components/HostSettings'
import MediaStatus from '../components/MediaStatus'
import HowToRun from '../components/HowToRun'
import FinalHost, { FinalAnswers } from '../components/FinalHost'
import {
  betsReady,
  FINAL_TIMER_SEC,
  finalStateOf,
  participants,
  remainingThemes,
  removeTheme,
  remover,
  withFinalScores,
} from '../final'
import QuestionView from '../components/QuestionView'
import Scoreboard from '../components/Scoreboard'
import {
  CHANNEL,
  clearRehearsal,
  clearState,
  hallMouseOn,
  loadRehearsal,
  loadState,
  newTimer,
  pauseTimer,
  saveRehearsal,
  saveState,
  startTimer,
  type Current,
  type LiveState,
  type HallAction,
  type HallStatus,
  type Message,
} from '../live'
import { VideoContext, type VideoCommand } from '../videoControl'
import { playTimeUp } from '../sounds'
import { updateStoredGame } from '../db'
import { hiddenQuestions, mergeProgress, nextTeamId, rehearsalCells, roundById, updateQuestion } from '../game'
import { setContentPlace } from '../placement'
import { chooseOption, startBranch } from '../tree'
import { describeRule, readyRules } from '../rules'
import { BranchBody, BranchControls } from '../components/BranchHost'
import type { Game, PlaceTarget, Placement, Question, Rule, Theme } from '../types'
import { clampSize, FONTS, hallSizes, TONES } from '../theme'
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
// (если вопрос открывали только посмотреть — ход остаётся у той же команды)
function withClosed(s: LiveState): LiveState {
  return {
    ...withPlayed(s, s.current),
    current: null,
    slideIndex: 0,
    showAnswer: false,
    answeringTeamId: null,
    triedTeamIds: [],
    viewOnly: false,
    turnTeamId: s.viewOnly ? s.turnTeamId : nextTeamId(s.game, s.turnTeamId),
    timer: null,
    video: null,
    branch: null,
  }
}

// Таймер вопроса: закреплённое на пульте время (📌) важнее времени из редактора
function questionTimer(question: Question | undefined, theme: Theme) {
  return newTimer(theme.pinnedTimerSec ?? question?.timerSec)
}

// Только что открытый вопрос: первый слайд, ответ скрыт, таймер ждёт запуска, ветвящийся — на первом шаге
function openedQuestion(question: Question | undefined, theme: Theme): Partial<LiveState> {
  return {
    slideIndex: 0,
    showAnswer: false,
    triedTeamIds: [],
    viewOnly: false,
    timer: questionTimer(question, theme),
    video: null,
    branch: question?.tree ? startBranch(question.tree) : null,
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
      rehearsal: !!saved.rehearsal && loadRehearsal()?.game?.id === initialGame.id, // без запомненной партии репетиция не продолжится
    }
  })
  const [history, setHistory] = useState<LiveState[]>([]) // для Ctrl+Z, только на пульте
  const historyBeforeRehearsal = useRef<LiveState[]>([]) // Ctrl+Z до репетиции — вернём после неё
  const [lastCell, setLastCell] = useState(-1) // какой вопрос репетиции открывали последним (номер в rehearsalCells)
  const [previewMode, setPreviewMode] = useState(false) // только на пульте
  const [preview, setPreview] = useState<CellRef | null>(null) // только на пульте
  const [hallStatus, setHallStatus] = useState<HallStatus | null>(null) // null — зал ещё не отзывался
  const [hallMedia, setHallMedia] = useState<{ done: number; total: number } | null>(null) // файлы, загруженные в зале
  const [settingsOpen, setSettingsOpen] = useState(false) // открыта панель настроек (⚙)
  const [howToOpen, setHowToOpen] = useState(false) // открыта памятка «Как провести игру»
  const { pinned, toggle: togglePin } = usePinnedControls() // кнопки на панели ведущего

  const channelRef = useRef<BroadcastChannel | null>(null)
  const liveRef = useRef(live)
  const hallActionRef = useRef<(action: HallAction) => void>(() => undefined) // свежий обработчик нажатий из зала

  const { game, current, slideIndex, showAnswer, answeringTeamId, turnTeamId, triedTeamIds, screenHidden } = live
  const unlockedIds = live.unlockedIds ?? []
  const unlockedRoundIds = live.unlockedRoundIds ?? []
  const rulesDone = live.rulesDone ?? []
  const round = roundById(game, live.roundId)
  // Финальный раунд идёт по своим шагам (final.ts); в обычном раунде final = null
  const isFinal = round.kind === 'final'
  const final = isFinal ? finalStateOf(live.final, round) : null
  const media = usePreload(game) // файлы игры заранее, и проверка, что все открываются

  // Канал связи: экран зала при открытии спрашивает «hello» — отвечаем текущим состоянием
  useEffect(() => {
    const channel = new BroadcastChannel(CHANNEL)
    channelRef.current = channel
    channel.onmessage = (e: MessageEvent<Message>) => {
      if (e.data.type === 'hello') channel.postMessage({ type: 'state', state: liveRef.current } satisfies Message)
      if (e.data.type === 'hall') setHallStatus(e.data.status)
      if (e.data.type === 'hall-media') setHallMedia({ done: e.data.done, total: e.data.total })
      if (e.data.type === 'hall-action') hallActionRef.current(e.data.action)
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
    openCell(categoryId, questionId)
  }

  // Сыграть вопрос: первой отвечает команда, чей ход. Таймер вопроса ждёт, пока ведущий его запустит.
  function openCell(categoryId: string, questionId: string) {
    // В репетиции «Следующий вопрос» продолжит с этой ячейки
    if (live.rehearsal) setLastCell(cells.findIndex((c) => c.questionId === questionId))
    const { question } = find({ categoryId, questionId })
    commit({ ...live, ...openedQuestion(question, game.theme), current: { categoryId, questionId }, answeringTeamId: turnTeamId })
  }

  // Клик по сыгранной (красной) ячейке: вопрос открывается только посмотреть — без «Верно / Неверно»
  function handlePlayedClick(categoryId: string, questionId: string) {
    if (previewMode) {
      setPreview({ categoryId, questionId })
      return
    }
    const { question } = find({ categoryId, questionId })
    commit({
      ...live,
      ...openedQuestion(question, game.theme),
      current: { categoryId, questionId },
      answeringTeamId: null,
      viewOnly: true,
    })
  }

  // Ветвящийся вопрос: ведущий нажал вариант. Баллы — сразу или одной суммой в конце ветки, следующий шаг.
  function chooseBranchOption(option: number) {
    const tree = currentCell.question?.tree
    if (!tree || !live.branch || live.branch.done || !answeringTeamId || live.viewOnly) return
    const node = tree.nodes.find((n) => n.id === live.branch!.nodeId)
    const points = node?.options[option]?.points ?? 0
    const branch = chooseOption(tree, live.branch, option)
    const gained = tree.scoring === 'per-step' ? points : branch.done ? branch.earned : 0
    // Вариант может открыть скрытый вопрос на табло
    const unlock = node?.options[option]?.unlockQuestionId
    const unlockable = unlock && hiddenQuestions(game).some((h) => h.id === unlock) && !unlockedIds.includes(unlock)
    commit({
      ...withScore(live, answeringTeamId, gained),
      unlockedIds: unlockable ? [...unlockedIds, unlock] : unlockedIds,
      branch,
      showAnswer: false,
      timer: questionTimer(currentCell.question, game.theme),
      video: null,
    })
  }

  // Ведущий нажал скрытую ячейку: в предпросмотре — посмотреть её, иначе — открыть (с подтверждением)
  function handleLockedClick(categoryId: string, questionId: string) {
    if (previewMode) {
      setPreview({ categoryId, questionId })
      return
    }
    const label = hiddenQuestions(game).find((h) => h.id === questionId)?.label ?? 'скрытый вопрос'
    if (!window.confirm(`Открыть скрытый вопрос «${label}»? В зале он появится на табло.`)) return
    commit({ ...live, unlockedIds: [...unlockedIds, questionId] })
  }

  function closeQuestion() {
    commit(withClosed(live))
  }

  // ---- Правила «ЕСЛИ → ТО» ----
  // Пока вопрос открыт, правила ждут; на табло пульт предлагает выполнить их по одному.
  const pendingRules = current ? [] : readyRules(game, rulesDone, unlockedIds)

  function runRule(rule: Rule) {
    const { then } = rule
    commit({
      ...live,
      rulesDone: [...rulesDone, rule.id],
      unlockedIds: then.kind === 'unlock-question' && !unlockedIds.includes(then.target) ? [...unlockedIds, then.target] : unlockedIds,
      unlockedRoundIds:
        then.kind === 'open-round' && !unlockedRoundIds.includes(then.target) ? [...unlockedRoundIds, then.target] : unlockedRoundIds,
      shownMedia: then.kind === 'show-media' && then.media ? then.media : live.shownMedia,
    })
  }

  function skipRule(rule: Rule) {
    commit({ ...live, rulesDone: [...rulesDone, rule.id] })
  }

  // Скрытый раунд закрыт, пока его не откроет правило или ведущий
  const roundLocked = (r: { id: string; hidden?: boolean }) => !!r.hidden && !unlockedRoundIds.includes(r.id)

  function openHiddenRound(roundId: string, title: string) {
    if (current) return
    if (!window.confirm(`Открыть скрытый раунд «${title}»? После этого на него можно переключиться.`)) return
    commit({ ...live, unlockedRoundIds: [...unlockedRoundIds, roundId] })
  }

  // Перейти к другому раунду (только с табло, не посреди вопроса); отменяется через Ctrl+Z
  function switchRound(roundId: string) {
    if (current || roundId === round.id) return
    const target = game.rounds.find((r) => r.id === roundId)
    if (target && roundLocked(target)) return
    commit({ ...live, roundId })
    setPreview(null)
  }

  // Верно: команда получает стоимость, вопрос закрывается, ход — следующей по кругу
  function handleCorrect(teamId: string) {
    if (!currentCell.question || currentCell.question.tree || live.viewOnly || triedTeamIds.includes(teamId)) return
    commit(withClosed(withScore(live, teamId, value)))
  }

  // Неверно: команда теряет стоимость, вопрос остаётся открытым — его могут перехватить остальные
  function handleWrong(teamId: string) {
    if (!currentCell.question || currentCell.question.tree || live.viewOnly || triedTeamIds.includes(teamId)) return
    commit({ ...withScore(live, teamId, -value), answeringTeamId: null, triedTeamIds: [...triedTeamIds, teamId] })
  }

  // ---- Финал ----

  // Команда убрала тему (ведущий нажал её на пульте)
  function finalRemoveTheme(categoryId: string) {
    if (final) commit({ ...live, final: removeTheme(round, final, categoryId) })
  }

  // Ставку вписывают по цифре — каждую не запоминаем для Ctrl+Z
  function finalSetBet(teamId: string, bet: number | undefined) {
    setLive((s) => {
      const f = finalStateOf(s.final, roundById(s.game, s.roundId))
      const bets = { ...f.bets }
      if (bet === undefined) delete bets[teamId]
      else bets[teamId] = bet
      return { ...s, final: { ...f, bets } }
    })
  }

  // Ставки сделаны — открываем вопрос оставшейся темы. Отвечают все играющие сразу (на бумажках).
  function finalShowQuestion() {
    if (!final || !betsReady(game, final)) return
    const theme = remainingThemes(round, final)[0]
    if (!theme) return
    const bets = Object.fromEntries(participants(game, final).map((t) => [t.id, final.bets[t.id]]))
    commit({
      ...live,
      final: { ...final, bets, correct: {}, phase: 'question' },
      current: { categoryId: theme.category.id, questionId: theme.question.id },
      slideIndex: 0,
      showAnswer: false,
      answeringTeamId: null,
      triedTeamIds: [],
      timer: newTimer(theme.question.timerSec ?? FINAL_TIMER_SEC),
      video: null,
    })
  }

  // Ведущий отметил ответ команды: верно / неверно
  function finalMark(teamId: string, correct: boolean) {
    if (final) commit({ ...live, final: { ...final, correct: { ...final.correct, [teamId]: correct } } })
  }

  // Итоги: счёт по ставкам, вопрос сыгран, зал показывает таблицу и ответ
  function finalReveal() {
    if (!final) return
    commit({
      ...withPlayed({ ...live, game: withFinalScores(game, final) }, current),
      final: { ...final, phase: 'results' },
      current: null,
      slideIndex: 0,
      showAnswer: false,
      timer: null,
      video: null,
    })
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
      const timer = s.timer ?? newTimer(s.game.theme.pinnedTimerSec ?? DEFAULT_TIMER_SEC)
      if (!s.current || !timer) return s
      return { ...s, timer: timer.endsAt === null ? startTimer(timer) : pauseTimer(timer) }
    })
  }

  // Ведущий выбрал время таймера (null — убрать таймер из зала). Таймер встаёт на начало и ждёт запуска.
  function setTimerLength(sec: number | null) {
    setLive((s) => (s.current ? { ...s, timer: newTimer(sec ?? undefined) } : s))
  }

  // Закрепить время таймера на всю игру (null — открепить). Это настройка игры: запоминаем в хранилище.
  function pinTimer(sec: number | null) {
    changeTheme({ pinnedTimerSec: sec ?? undefined })
  }

  // Таймер сначала (например, для перехвата)
  function resetTimer() {
    setLive((s) => (s.timer ? { ...s, timer: newTimer(s.timer.totalSec) } : s))
  }

  // Кто отвечает сейчас (основная команда или перехват). Ошибившимся командам отвечать нельзя.
  function selectTeam(teamId: string | null) {
    if (live.viewOnly || (teamId && triedTeamIds.includes(teamId))) return
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

  // Ведущий передвинул объект слайда со своей расстановкой прямо в зале — правим вопрос в партии и в хранилище
  function changeQuestionPlace(questionId: string, target: PlaceTarget, place: Placement) {
    const change = (q: Question) => setContentPlace(q, target, place)
    setLive((s) => ({ ...s, game: updateQuestion(s.game, questionId, change) }))
    void updateStoredGame(game.id, (g) => updateQuestion(g, questionId, change))
  }

  function toggleResizeHall() {
    setLive((s) => ({ ...s, resizeHall: !s.resizeHall }))
  }

  function toggleHallMouse() {
    setLive((s) => ({ ...s, hallMouse: !hallMouseOn(s) }))
  }

  function toggleScreenHidden() {
    setLive((s) => ({ ...s, screenHidden: !s.screenHidden }))
  }

  function togglePreviewMode() {
    setPreviewMode((m) => !m)
    setPreview(null)
  }

  function openScreen() {
    window.open(`${window.location.pathname}#/screen`, `${APP_KEY}-screen`, 'popup,width=1280,height=720')
  }

  // ---- Репетиция ----
  // Ведущий проходит вопросы с открытым залом (проверить проектор, звук, картинки).
  // Всё, что сделано в репетиции, потом отменяется: партия возвращается такой, какой была до неё.

  function startRehearsal() {
    if (live.rehearsal || current) return
    saveRehearsal(live)
    historyBeforeRehearsal.current = history
    setHistory([])
    setPreview(null)
    setPreviewMode(false)
    setLive({ ...live, rehearsal: true })
  }

  function endRehearsal() {
    const before = loadRehearsal()
    clearRehearsal()
    setLive(before && before.game.id === game.id ? { ...before, rehearsal: false, video: null } : { ...withClosed(live), rehearsal: false })
    setHistory(historyBeforeRehearsal.current)
    historyBeforeRehearsal.current = []
    setLastCell(-1)
  }

  const cells = live.rehearsal ? rehearsalCells(game) : []
  const cellIndex = current ? cells.findIndex((c) => c.questionId === current.questionId) : -1
  const position = cellIndex >= 0 ? cellIndex : lastCell // откуда считать «следующий» (вопрос мог быть уже закрыт)

  // Открыть в зале соседний вопрос по порядку табло (даже из другого раунда)
  function rehearseStep(delta: number) {
    const cell = cells[position + delta]
    if (!cell) return
    setLastCell(position + delta)
    const question = game.rounds
      .find((r) => r.id === cell.roundId)
      ?.categories.find((c) => c.id === cell.categoryId)
      ?.questions.find((q) => q.id === cell.questionId)
    commit({
      ...live,
      ...openedQuestion(question, game.theme),
      roundId: cell.roundId,
      current: { categoryId: cell.categoryId, questionId: cell.questionId },
      answeringTeamId: turnTeamId,
    })
  }

  function resetGame() {
    clearRehearsal()
    historyBeforeRehearsal.current = []
    clearState()
    setLive(freshState({ ...initialGame, theme: game.theme })) // вид команд, выбранный в игре, оставляем
    setHistory([])
    setPreview(null)
  }

  // Ведущий нажал мышью на экране зала (включено «Мышь в зале»): делаем то же, что кнопки пульта
  function handleHallAction(action: HallAction) {
    // «Растянуть в зале» — свой режим, работает и без «Мыши в зале»
    if (action.kind === 'size' || action.kind === 'place' || action.kind === 'resize-done') {
      if (!live.resizeHall) return
      if (action.kind === 'size') changeTheme({ sizes: { ...hallSizes(game.theme), [action.id]: clampSize(action.value) } })
      else if (action.kind === 'place') changeQuestionPlace(action.questionId, action.target, action.place)
      else toggleResizeHall()
      return
    }
    if (!hallMouseOn(live) || live.screenHidden) return
    const tree = currentCell.question?.tree
    switch (action.kind) {
      case 'open': {
        if (current || isFinal) return
        const { question } = find(action)
        // Сыгранные и скрытые ячейки из зала не открываются
        if (!question || question.played || (question.hidden && !unlockedIds.includes(question.id))) return
        openCell(action.categoryId, action.questionId)
        return
      }
      case 'slide':
        if (current) goToSlide(action.delta)
        return
      case 'timer':
        if (current) toggleTimer()
        return
      case 'answer':
        if (current && !showAnswer && !isFinal) showAnswerInHall()
        return
      case 'team':
        if (current && !isFinal && !tree) selectTeam(action.teamId)
        return
      case 'correct':
        if (answeringTeamId && !isFinal && !tree) handleCorrect(answeringTeamId)
        return
      case 'wrong':
        if (answeringTeamId && !isFinal && !tree) handleWrong(answeringTeamId)
        return
      case 'close':
        if (current && !isFinal) closeQuestion()
        return
    }
  }
  useEffect(() => {
    hallActionRef.current = handleHallAction
  })

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
        if (howToOpen) setHowToOpen(false)
        else if (settingsOpen) setSettingsOpen(false)
        else if (preview) setPreview(null)
        else if (current && !isFinal) closeQuestion() // вопрос финала закрывается только итогами
      }
      // P — режим предпросмотра (когда вопрос не открыт; в финале табло нет)
      if (e.code === 'KeyP' && !current && !isFinal) togglePreviewMode()

      // 1–9 и 0 — команда по номеру (0 = десятая): на табло — чей ход, в вопросе — кто отвечает
      const digit = /^(Digit|Numpad)(\d)$/.exec(e.code)
      if (digit && !isFinal) {
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
        if (!showAnswer && !isFinal) showAnswerInHall() // в финале ответ — вместе с итогами
      }
      // + / − — «Верно» / «Неверно» для выбранной команды (в дереве по правильности — варианты «Верно / Неверно»)
      if (answeringTeamId && currentCell.question?.tree) {
        if (currentCell.question.tree.branchBy === 'correctness') {
          if (e.key === '+' || e.key === '=' || e.code === 'NumpadAdd') chooseBranchOption(0)
          if (e.key === '-' || e.code === 'NumpadSubtract') chooseBranchOption(1)
        }
      } else if (answeringTeamId) {
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
  // В финале подсвечена только команда, которая убирает тему
  const finalRemover = final?.phase === 'themes' ? remover(game, final) : undefined
  const activeTeamId = final ? (finalRemover?.id ?? null) : current ? answeringTeamId : turnTeamId
  const activeLabel = final ? 'УБИРАЕТ' : current ? (stealing ? 'ПЕРЕХВАТ' : 'ОТВЕЧАЕТ') : 'ХОД'
  const teamsStatus = final
    ? finalRemover && ` · тему убирает ${finalRemover.name}`
    : !current
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
      case 'rehearsal':
        return (
          <button
            type="button"
            onClick={live.rehearsal ? endRehearsal : startRehearsal}
            disabled={!live.rehearsal && !!current}
            aria-pressed={!!live.rehearsal}
            title={!live.rehearsal && current ? 'Сначала закройте вопрос' : undefined}
            className={`${toggleClass(!!live.rehearsal)} disabled:opacity-40`}
          >
            {live.rehearsal ? 'Закончить репетицию' : 'Репетиция'}
          </button>
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
      case 'hall-mouse':
        return (
          <button
            type="button"
            onClick={toggleHallMouse}
            aria-pressed={hallMouseOn(live)}
            title="Выбирать вопросы и вести игру мышкой прямо на экране зала"
            className={toggleClass(hallMouseOn(live))}
          >
            Мышь в зале: {hallMouseOn(live) ? 'вкл' : 'выкл'}
          </button>
        )
      case 'how-to':
        return (
          <button
            type="button"
            onClick={() => {
              setSettingsOpen(false)
              setHowToOpen(true)
            }}
            aria-expanded={howToOpen}
            className="h-11 rounded-lg border border-line px-4 text-sm hover:bg-cell"
          >
            ? Как провести игру
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
      case 'hall-resize':
        return (
          <button
            type="button"
            onClick={toggleResizeHall}
            aria-pressed={!!live.resizeHall}
            title="В зале у табло, команд, текста, картинок и таймера появятся уголки — тяните их мышью"
            className={toggleClass(!!live.resizeHall)}
          >
            Растянуть в зале: {live.resizeHall ? 'вкл' : 'выкл'}
          </button>
        )
      case 'sizes':
        return <SizeSliders theme={game.theme} onChange={(sizes) => changeTheme({ sizes })} />
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
              {game.rounds.map((r) =>
                roundLocked(r) ? (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => openHiddenRound(r.id, r.title)}
                    disabled={!!current}
                    title="Скрытый раунд: нажмите, чтобы открыть его"
                    className="h-11 rounded-lg border border-dashed border-line px-3 text-sm text-muted hover:text-white disabled:opacity-40"
                  >
                    🔒 {r.title}
                  </button>
                ) : (
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
                ),
              )}
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

      {howToOpen && <HowToRun onClose={() => setHowToOpen(false)} />}

      {/* Зал ещё не открыт (или его закрыли) — подсказываем, с чего начать */}
      {(hallStatus === null || hallStatus === 'closed') && !current && (
        <div role="status" className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-cell px-5 py-3">
          <span className="min-w-0 flex-1">
            {hallStatus === 'closed' ? 'Экран зала закрыт' : 'Экран зала ещё не открыт'} — зрители пока ничего не видят.
          </span>
          <button
            type="button"
            onClick={openScreen}
            className="h-11 rounded-lg bg-white px-4 text-sm font-semibold text-black hover:bg-muted"
          >
            Открыть экран для зала
          </button>
          <button
            type="button"
            onClick={() => setHowToOpen(true)}
            className="h-11 rounded-lg border border-line px-4 text-sm hover:bg-bg"
          >
            Как вывести на проектор
          </button>
        </div>
      )}

      {/* Правило «ЕСЛИ → ТО» сработало — ведущий решает, выполнить ли его */}
      {pendingRules.slice(0, 1).map((rule) => {
        const text = describeRule(game, rule)
        return (
          <div key={rule.id} role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border-2 border-white bg-cell px-5 py-3">
            <span className="mr-auto">
              <span className="font-semibold">Сработало правило:</span> ЕСЛИ {text.when} → ТО {text.then}
              {pendingRules.length > 1 && <span className="text-sm text-muted"> · и ещё {pendingRules.length - 1}</span>}
            </span>
            <button type="button" onClick={() => runRule(rule)} className="h-11 rounded-lg bg-white px-5 font-semibold text-black hover:opacity-90">
              Выполнить
            </button>
            <button type="button" onClick={() => skipRule(rule)} className="h-11 rounded-lg border border-line px-4 text-sm hover:bg-bg">
              Пропустить
            </button>
          </div>
        )
      })}

      {live.shownMedia && (
        <div role="status" className="flex flex-wrap items-center gap-3 rounded-xl border border-white px-5 py-3">
          <span className="mr-auto">В зале во весь экран: «{live.shownMedia.name}»</span>
          <button
            type="button"
            onClick={() => commit({ ...live, shownMedia: null })}
            className="h-11 rounded-lg bg-white px-5 font-semibold text-black hover:opacity-90"
          >
            Убрать из зала
          </button>
        </div>
      )}

      {live.rehearsal && (
        <div role="status" className="flex flex-wrap items-center gap-3 rounded-xl border-2 border-dashed border-white px-5 py-3">
          <div className="mr-auto flex flex-col">
            <span className="font-semibold">РЕПЕТИЦИЯ · в зале видна метка «Репетиция»</span>
            <span className="text-sm text-muted">
              Играйте как обычно. Когда закончите, счёт, сыгранные вопросы и ход вернутся такими, какими были до репетиции.
            </span>
          </div>
          <button
            type="button"
            onClick={() => rehearseStep(-1)}
            disabled={position <= 0}
            className="h-11 rounded-lg border border-line px-4 text-sm hover:bg-cell disabled:opacity-40"
          >
            ← Предыдущий вопрос
          </button>
          <span className="text-sm text-muted tabular-nums">
            {cellIndex >= 0 ? `Вопрос ${cellIndex + 1} из ${cells.length}` : `Вопросов: ${cells.length}`}
          </span>
          <button
            type="button"
            onClick={() => rehearseStep(1)}
            disabled={position >= cells.length - 1}
            className="h-11 rounded-lg bg-white px-4 text-sm font-semibold text-black hover:opacity-90 disabled:opacity-40"
          >
            {position < 0 ? 'Первый вопрос →' : 'Следующий вопрос →'}
          </button>
          <button type="button" onClick={endRehearsal} className="h-11 rounded-lg border border-white px-4 text-sm font-semibold hover:bg-white hover:text-black">
            Закончить репетицию
          </button>
        </div>
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
            categoryTitle={final ? `Финал · ${currentCell.category.title}` : currentCell.category.title}
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
            pinnedTimerSec={game.theme.pinnedTimerSec}
            onPinTimer={pinTimer}
            viewOnly={!!live.viewOnly}
            onTimeUp={() => {
              if (game.theme.sounds.enabled) playTimeUp()
            }}
            final={final ? <FinalAnswers game={game} final={final} onMark={finalMark} onReveal={finalReveal} /> : undefined}
            branch={
              currentCell.question.tree && live.branch
                ? {
                    body: (
                      <BranchBody
                        tree={currentCell.question.tree}
                        branch={live.branch}
                        showAnswer={showAnswer}
                        onShowAnswer={showAnswerInHall}
                      />
                    ),
                    bottom: (
                      <BranchControls
                        tree={currentCell.question.tree}
                        branch={live.branch}
                        teams={game.teams}
                        answeringTeamId={answeringTeamId}
                        onSelectTeam={selectTeam}
                        onChoose={chooseBranchOption}
                        hiddenQuestions={hiddenQuestions(game)}
                        onClose={closeQuestion}
                      />
                    ),
                  }
                : undefined
            }
          />
        </VideoContext.Provider>
      ) : final ? (
        <FinalHost
          game={game}
          round={round}
          final={final}
          onRemoveTheme={finalRemoveTheme}
          onSetBet={finalSetBet}
          onShowQuestion={finalShowQuestion}
        />
      ) : (
        <Board
          round={round}
          onCellClick={handleCellClick}
          onPlayedClick={handlePlayedClick}
          unlockedIds={unlockedIds}
          onLockedClick={handleLockedClick}
        />
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
        onPickTeam={isFinal ? () => undefined : pickTeam}
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
