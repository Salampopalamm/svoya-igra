import { useEffect, useRef, useState } from 'react'
import Board from '../components/Board'
import ScreenQuestion from '../components/ScreenQuestion'
import Scoreboard from '../components/Scoreboard'
import { GameLogo, HallFrame } from '../components/HallFrame'
import TeamIcon from '../components/TeamIcon'
import TeamsColumn from '../components/TeamsColumn'
import { roundById } from '../game'
import { CHANNEL, type HallStatus, type LiveState, type Message } from '../live'
import { usePreload } from '../preload'
import type { Theme } from '../types'
import { VideoContext } from '../videoControl'

// Экран зала: только показывает то, что прислал пульт. Ответ виден, лишь когда ведущий его открыл.
export default function ScreenApp() {
  const [live, setLive] = useState<LiveState | null>(null)
  // Браузер разрешает звук только после клика по окну — поэтому сначала заставка «Нажмите, чтобы начать»
  const [started, setStarted] = useState(false)
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
    channelRef.current?.postMessage({ type: 'hall', status: 'ready' } satisfies Message)
    // Во весь экран (на проекторе это и нужно). Не получилось — не страшно, есть F11.
    document.documentElement.requestFullscreen?.().catch(() => undefined)
  }

  // Видео в зале не удалось запустить со звуком — снова просим клик
  function soundBlocked() {
    setStarted(false)
    startedRef.current = false
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
  // Подсветка команды: на табло — чей ход, в вопросе — кто отвечает; ошибившиеся — бледные
  const activeTeamId = questionOpen ? answeringTeamId : (turnTeam?.id ?? null)
  const activeLabel = questionOpen ? (stealing ? 'ПЕРЕХВАТ' : 'ОТВЕЧАЕТ') : 'ХОД'
  const outTeamIds = questionOpen ? triedTeamIds : []

  const content =
    category && question ? (
      <VideoContext.Provider value={{ video: live.video ?? null, onBlocked: soundBlocked }}>
        <ScreenQuestion
          categoryTitle={category.title}
          question={question}
          slideIndex={slideIndex}
          showAnswer={showAnswer}
          answeringTeam={answeringTeam}
          stealing={stealing}
          canSteal={game.teams.some((t) => !triedTeamIds.includes(t.id))}
          timer={live.timer ?? null}
        />
      </VideoContext.Provider>
    ) : (
      <Board round={round} interactive={false} />
    )
  // Вопрос или табло появляются плавно (новый ключ — новая анимация)
  const main = (
    <div key={question?.id ?? `board-${round.id}`} className="anim-appear flex min-h-0 flex-1 flex-col">
      {content}
    </div>
  )

  // Вид команд выбирает ведущий на пульте: «Имена + фото» — колонка справа, иначе — полоса снизу
  const photosView = game.theme.teamView === 'photos'

  return (
    <HallFrame theme={game.theme} className="flex flex-col gap-6 px-12 py-10">
      <header className="flex items-center justify-between">
        <GameLogo
          theme={game.theme}
          className="h-14 max-w-60"
          fallback={<span className="font-display text-2xl">{game.title.toUpperCase()}</span>}
        />
        <span className="font-display text-2xl">{round.title.toUpperCase()}</span>
        {!questionOpen && turnTeam ? (
          <span className="flex items-center gap-2.5 rounded-xl border-[3px] border-accent bg-cell px-5 py-2 text-xl font-semibold">
            <TeamIcon team={turnTeam} size={28} />
            Ход: {turnTeam.name}
          </span>
        ) : (
          <span className="text-sm text-muted">F11 — во весь экран</span>
        )}
      </header>

      {photosView ? (
        <div className="grid flex-1 gap-8" style={{ gridTemplateColumns: 'minmax(0, 1fr) 380px' }}>
          <div className="flex flex-col">{main}</div>
          <TeamsColumn
            teams={game.teams}
            players={game.players}
            activeTeamId={activeTeamId}
            activeLabel={activeLabel}
            outTeamIds={outTeamIds}
            showPhotos={game.theme.showPhotos}
          />
        </div>
      ) : (
        <>
          {main}
          <Scoreboard
            teams={game.teams}
            activeTeamId={activeTeamId}
            activeLabel={activeLabel}
            outTeamIds={outTeamIds}
          />
        </>
      )}
    </HallFrame>
  )
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
