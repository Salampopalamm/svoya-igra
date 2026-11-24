import { useEffect, useRef, useState } from 'react'
import Board from '../components/Board'
import ScreenQuestion from '../components/ScreenQuestion'
import Scoreboard from '../components/Scoreboard'
import { GameLogo, HallFrame } from '../components/HallFrame'
import TeamIcon from '../components/TeamIcon'
import TeamsColumn from '../components/TeamsColumn'
import FinalScreen from '../components/FinalScreen'
import HallMousePanel from '../components/HallMousePanel'
import ErrorBoundary from '../components/ErrorBoundary'
import { Resizable } from '../components/Resizable'
import { ResizeContext } from '../hallResize'
import { MediaView } from '../components/MediaView'
import { finalStateOf, remover } from '../final'
import { formatPoints, stepById, type BranchState } from '../tree'
import type { QuestionTree } from '../types'
import { roundById } from '../game'
import { CHANNEL, hallMouseOn, type HallAction, type HallStatus, type LiveState, type Message } from '../live'
import { usePreload } from '../preload'
import type { Theme } from '../types'
import { VideoContext } from '../videoControl'

// По залу уже щёлкнули (звук разрешён). Помним и после сбоя: зал перезапускается без заставки.
let startedBefore = false

// Экран зала: только показывает то, что прислал пульт. Ответ виден, лишь когда ведущий его открыл.
export default function ScreenApp() {
  const [live, setLive] = useState<LiveState | null>(null)
  // Браузер разрешает звук только после клика по окну — поэтому сначала заставка «Нажмите, чтобы начать»
  const [started, setStarted] = useState(startedBefore)
  const [barDown, setBarDown] = useState(false) // плашку «Растянуть» можно опустить вниз, чтобы не закрывала шапку
  const channelRef = useRef<BroadcastChannel | null>(null)
  const startedRef = useRef(started)
  // Файлы игры загружаем заранее, ещё на заставке; сколько готово — сообщаем пульту
  const media = usePreload(live?.game)
  const mediaRef = useRef(media)

  useEffect(() => {
    const channel = new BroadcastChannel(CHANNEL)
    channelRef.current = channel
    const report = (status: HallStatus) => channel.postMessage({ type: 'hall', status } satisfies Message)
    channel.onmessage = (e: MessageEvent<Message>) => {
      if (e.data.type !== 'state') return
      setLive(e.data.state)
      report(startedRef.current ? 'ready' : 'waiting-click') // пульт мог открыться позже зала — напоминаем о себе
      const m = mediaRef.current
      if (m) channel.postMessage({ type: 'hall-media', done: m.done, total: m.total } satisfies Message)
    }
    channel.postMessage({ type: 'hello' } satisfies Message) // попросить у пульта текущее состояние
    const onClose = () => report('closed')
    window.addEventListener('pagehide', onClose)
    return () => {
      window.removeEventListener('pagehide', onClose)
      channel.close()
      channelRef.current = null
    }
  }, [])

  useEffect(() => {
    mediaRef.current = media
    if (media) channelRef.current?.postMessage({ type: 'hall-media', done: media.done, total: media.total } satisfies Message)
  }, [media])

  function start() {
    setStarted(true)
    startedRef.current = true
    startedBefore = true
    channelRef.current?.postMessage({ type: 'hall', status: 'ready' } satisfies Message)
    // Во весь экран (на проекторе это и нужно). Не получилось — не страшно, есть F11.
    document.documentElement.requestFullscreen?.().catch(() => undefined)
  }

  // Видео в зале не удалось запустить со звуком — снова просим клик
  function soundBlocked() {
    setStarted(false)
    startedRef.current = false
    startedBefore = false
    channelRef.current?.postMessage({ type: 'hall', status: 'waiting-click' } satisfies Message)
  }

  if (!started) {
    const splash = (
      <button type="button" onClick={start} className="flex min-h-screen w-full flex-col items-center justify-center gap-8">
        <Splash theme={live?.game.theme} title={live?.game.title} />
        <span className="rounded-xl bg-accent px-10 py-5 text-3xl font-semibold text-on-accent">Нажмите, чтобы начать</span>
        <span className="text-lg text-muted">Включится звук и полный экран</span>
      </button>
    )
    return live ? (
      <HallFrame theme={live.game.theme} className="">
        {splash}
      </HallFrame>
    ) : (
      <div className="min-h-screen bg-bg text-white">{splash}</div>
    )
  }

  if (!live) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg text-2xl text-muted">
        Ожидание пульта ведущего…
      </div>
    )
  }

  const { game, current, slideIndex, showAnswer, answeringTeamId, screenHidden } = live

  // Заставка: ведущий скрыл экран
  if (screenHidden) {
    return (
      <HallFrame theme={game.theme} className="anim-appear flex flex-col items-center justify-center gap-6">
        <Splash theme={game.theme} title={game.title} />
      </HallFrame>
    )
  }

  const round = roundById(game, live.roundId)
  const category = current ? round.categories.find((c) => c.id === current.categoryId) : undefined
  const question = category?.questions.find((q) => q.id === current?.questionId)
  const answeringTeam = game.teams.find((t) => t.id === answeringTeamId)
  const turnTeam = game.teams.find((t) => t.id === live.turnTeamId)
  const triedTeamIds = live.triedTeamIds ?? []
  const stealing = triedTeamIds.length > 0
  const questionOpen = !!(category && question)
  // Финал идёт своими шагами: темы → ставки → вопрос → итоги
  const final = round.kind === 'final' ? finalStateOf(live.final, round) : null
  const finalRemover = final?.phase === 'themes' ? remover(game, final) : undefined
  // Подсветка команды: на табло — чей ход, в вопросе — кто отвечает; ошибившиеся — бледные; в финале — кто убирает тему
  const activeTeamId = final ? (finalRemover?.id ?? null) : questionOpen ? answeringTeamId : (turnTeam?.id ?? null)
  const activeLabel = final ? 'УБИРАЕТ' : questionOpen ? (stealing ? 'ПЕРЕХВАТ' : 'ОТВЕЧАЕТ') : 'ХОД'
  const outTeamIds = questionOpen ? triedTeamIds : []

  // «Мышь в зале»: нажатия на экране зала уходят на пульт, игру меняет он
  function act(action: HallAction) {
    channelRef.current?.postMessage({ type: 'hall-action', action } satisfies Message)
  }

  // «Растянуть в зале»: у объектов рамки и уголки; размеры и расстановку запоминает пульт
  const resizing = !!live.resizeHall

  // Ветвящийся вопрос: какой шаг показывать, его варианты и (в конце) итог ветки
  const branchNode = question?.tree && live.branch ? stepById(question.tree, live.branch.nodeId) : undefined
  const step =
    question?.tree && live.branch && branchNode
      ? {
          nodeId: branchNode.id,
          content: branchNode.content,
          answer: branchNode.answer,
          options: question.tree.branchBy === 'choice' && !live.branch.done ? branchNode.options.map((o) => o.label) : [],
          summary:
            live.branch.done && answeringTeam
              ? `${answeringTeam.name}: ${formatPoints(live.branch.earned)}${openedHidden(question.tree, live.branch) ? ' · открыт скрытый вопрос!' : ''}`
              : undefined,
        }
      : undefined

  // На экране слайд (или ответ) со своей расстановкой — его объекты в этом режиме можно ещё и двигать
  const placedNow =
    !!question &&
    !!(showAnswer && (step ? step.answer : question.answer)?.place
      ? true
      : (branchNode?.content ?? question.slides[slideIndex])?.place)

  const content =
    category && question ? (
      <VideoContext.Provider value={{ video: live.video ?? null, onBlocked: soundBlocked }}>
        <ScreenQuestion
          title={final ? `Финал · ${category.title}` : undefined}
          question={question}
          slideIndex={slideIndex}
          showAnswer={showAnswer}
          step={step}
          timer={live.timer ?? null}
          onPlace={resizing ? (target, place) => act({ kind: 'place', questionId: question.id, target, place }) : undefined}
        />
      </VideoContext.Provider>
    ) : final ? (
      <FinalScreen game={game} round={round} final={final} />
    ) : (
      // Размер табло — ползунок «Табло» (CSS zoom увеличивает ячейки и надписи целиком);
      // в режиме «Растянуть» у каждой ячейки и категории свой уголок
      <div className="[zoom:var(--board-scale,1)]">
        <Board
          round={round}
          interactive={false}
          unlockedIds={live.unlockedIds ?? []}
          onHallClick={hallMouseOn(live) && !resizing ? (categoryId, questionId) => act({ kind: 'open', categoryId, questionId }) : undefined}
        />
      </div>
    )
  // Вопрос или табло появляются плавно (новый ключ — новая анимация)
  const main = (
    <div
      key={question ? `${question.id}-${live.branch?.nodeId ?? ''}` : final ? `final-${final.phase}` : `board-${round.id}`}
      className="anim-appear flex min-h-0 flex-1 flex-col"
    >
      {/* Сломался вопрос или табло — зрители видят пустое место, а не ошибку; следующее действие пульта пробует снова */}
      <ErrorBoundary resetKey={live} fallback={() => null}>
        {content}
      </ErrorBoundary>
    </div>
  )

  // Вид команд выбирает ведущий на пульте: «Имена + фото» — колонка справа, иначе — полоса снизу
  const photosView = game.theme.teamView === 'photos'

  return (
    <ResizeContext.Provider
      value={
        resizing
          ? (target, value) =>
              act('id' in target ? { kind: 'size', id: target.id, value } : { kind: 'item-size', key: target.item, value })
          : null
      }
    >
      <HallFrame theme={game.theme} className="flex flex-col gap-6 px-12 py-10">
        {/* Правило «ЕСЛИ → ТО» показало картинку или видео: во весь экран поверх табло, пока ведущий не уберёт */}
        {live.shownMedia && (
          <div key={live.shownMedia.id} className="anim-appear fixed inset-0 z-40 flex items-center justify-center bg-bg p-10">
            <VideoContext.Provider
              value={{ video: { mediaId: live.shownMedia.id, playing: true, time: 0, volume: 1, seq: 1 }, onBlocked: soundBlocked }}
            >
              <MediaView media={live.shownMedia} mode="hall" className="max-h-full max-w-full" />
            </VideoContext.Provider>
          </div>
        )}
        {resizing && (
          <div className={`fixed inset-x-0 z-40 flex justify-center px-6 ${barDown ? 'bottom-3' : 'top-3'}`}>
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-line bg-cell/95 p-2 pl-5 text-lg shadow-2xl">
              <span>Тяните уголки ◢ — размер{placedNow ? ', объекты слайда — место' : ''}</span>
              <button
                type="button"
                onClick={() => act({ kind: 'resize-done' })}
                className="h-12 rounded-xl bg-accent px-6 font-semibold text-on-accent hover:opacity-90"
              >
                Готово
              </button>
              <button
                type="button"
                onClick={() => setBarDown(!barDown)}
                aria-label={barDown ? 'Поднять плашку наверх' : 'Опустить плашку вниз'}
                title={barDown ? 'Поднять плашку наверх' : 'Опустить плашку вниз'}
                className="h-12 w-12 rounded-xl border-2 border-line hover:border-white"
              >
                {barDown ? '▴' : '▾'}
              </button>
            </div>
          </div>
        )}
        {hallMouseOn(live) && !resizing && question && (
          <HallMousePanel
            question={question}
            slideIndex={slideIndex}
            showAnswer={showAnswer}
            teams={game.teams}
            answeringTeam={answeringTeam}
            triedTeamIds={triedTeamIds}
            timer={live.timer ?? null}
            scoring={!final && !question.tree && !live.viewOnly}
            final={!!final}
            onAction={act}
          />
        )}
        {/* Во время вопроса шапки нет — всё место вопросу и картинкам; в репетиции метка остаётся в углу */}
        {questionOpen && live.rehearsal && (
          <span className="fixed top-3 left-3 z-20 rounded-lg border-2 border-dashed border-white px-3 py-1 text-sm font-semibold tracking-widest">
            РЕПЕТИЦИЯ
          </span>
        )}
        {!questionOpen && (
          <header className="flex items-center justify-between">
            <Resizable item="head:title" label="Название игры">
              <GameLogo
                theme={game.theme}
                className="h-14 max-w-60"
                fallback={<span className="font-display text-2xl">{game.title.toUpperCase()}</span>}
              />
            </Resizable>
            <span className="flex items-center gap-4">
              <Resizable item="head:round" label="Раунд">
                <span className="font-display text-2xl">{round.title.toUpperCase()}</span>
              </Resizable>
              {/* Репетиция: в зале видно, что это не настоящая игра */}
              {live.rehearsal && (
                <span className="rounded-lg border-2 border-dashed border-white px-3 py-1 text-lg font-semibold tracking-widest">
                  РЕПЕТИЦИЯ
                </span>
              )}
            </span>
            {!final && turnTeam ? (
              <Resizable item="head:turn" label="Чей ход">
                <span className="flex items-center gap-2.5 rounded-xl border-[3px] border-accent bg-cell px-5 py-2 text-xl font-semibold">
                  <TeamIcon team={turnTeam} size={28} />
                  Ход: {turnTeam.name}
                </span>
              </Resizable>
            ) : (
              <span className="text-sm text-muted">F11 — во весь экран</span>
            )}
          </header>
        )}

        {photosView ? (
          // Колонка команд шире или уже вместе с ползунком «Команды и счёт», внутри всё увеличено так же
          <div className="grid flex-1 gap-8" style={{ gridTemplateColumns: 'minmax(0, 1fr) calc(380px * var(--teams-scale, 1))' }}>
            <div className="flex flex-col">{main}</div>
            <div className="[zoom:var(--teams-scale,1)]">
              <TeamsColumn
                teams={game.teams}
                players={game.players}
                activeTeamId={activeTeamId}
                activeLabel={activeLabel}
                outTeamIds={outTeamIds}
                showPhotos={game.theme.showPhotos}
              />
            </div>
          </div>
        ) : (
          <>
            {main}
            <div className="[zoom:var(--teams-scale,1)]">
              <Scoreboard
                teams={game.teams}
                activeTeamId={activeTeamId}
                activeLabel={activeLabel}
                outTeamIds={outTeamIds}
              />
            </div>
          </>
        )}
      </HallFrame>
    </ResizeContext.Provider>
  )
}

// Открыл ли пройденный путь ветки скрытый вопрос (для итога в зале)
function openedHidden(tree: QuestionTree, branch: BranchState): boolean {
  return branch.path.some((p) => !!stepById(tree, p.nodeId)?.options[p.option]?.unlockQuestionId)
}

// Заставка: логотип клиента (если есть), «СВОЯ ИГРА» и название игры
function Splash({ theme, title }: { theme?: Theme; title?: string }) {
  return (
    <div className="flex flex-col items-center gap-6">
      {theme && <GameLogo theme={theme} className="max-h-48 max-w-[60vw]" />}
      <span className="font-display text-6xl">СВОЯ ИГРА</span>
      {title && <span className="text-2xl text-muted">{title}</span>}
    </div>
  )
}
