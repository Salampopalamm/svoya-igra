import { lazy, Suspense, useEffect, useState, type ComponentType, type ReactNode } from 'react'
import ErrorBoundary, { ErrorScreen } from './components/ErrorBoundary'
import { getGame } from './db'
import { CHANNEL, closeSavedQuestion, type Message } from './live'
import HostApp from './screens/HostApp'
import LibraryApp from './screens/LibraryApp'
import ScreenApp from './screens/ScreenApp'
import { APP_KEY } from './site'
import type { Game } from './types'

// Редактор, команды и мастер грузятся, только когда их открывают, — сайт открывается быстрее.
// Пульт и зал — сразу: они нужны во время игры, когда интернет может пропасть.
const EditorApp = lazyScreen(() => import('./screens/EditorApp'))
const TeamsApp = lazyScreen(() => import('./screens/TeamsApp'))
const WizardApp = lazyScreen(() => import('./screens/WizardApp'))

// Если сайт обновили, пока вкладка была открыта, старых частей сайта на сервере уже нет —
// тогда один раз перезагружаем страницу, и она возьмёт новые. Не помогло — покажем ошибку.
function lazyScreen<P extends object>(load: () => Promise<{ default: ComponentType<P> }>) {
  const key = `${APP_KEY}:reloaded-for-update`
  return lazy(() =>
    load().then(
      (module) => {
        sessionStorage.removeItem(key)
        return module
      },
      (error: unknown) => {
        if (!sessionStorage.getItem(key)) {
          sessionStorage.setItem(key, '1')
          window.location.reload()
          return new Promise<never>(() => {}) // ждём перезагрузки
        }
        throw error
      },
    ),
  )
}

// Адреса внутри приложения (часть после #):
//   #/              — «Мои игры»
//   #/play/<id>     — пульт ведущего для игры <id>
//   #/edit/<id>     — редактор игры <id>
//   #/teams/<id>    — команды игры <id>
//   #/screen        — экран зала (открывается кнопкой на пульте)
//   #/new           — мастер «Быстрая игра»
export default function App() {
  const [hash, setHash] = useState(window.location.hash)

  useEffect(() => {
    const onChange = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  // Сломалось — вместо белого экрана объясняем и даём кнопки. Перешли на другой экран — пробуем снова.
  return (
    <ErrorBoundary
      resetKey={hash}
      fallback={(error, retry) =>
        hash === '#/screen' ? (
          <HallError retry={retry} />
        ) : (
          <ErrorScreen error={error}>
            <button type="button" onClick={retry} className={BUTTON}>
              Попробовать снова
            </button>
            <a href="#/" className={BUTTON}>
              ← Мои игры
            </a>
          </ErrorScreen>
        )
      }
    >
      <Suspense fallback={<Placeholder text="Загрузка…" />}>
        <Page hash={hash} />
      </Suspense>
    </ErrorBoundary>
  )
}

const BUTTON = 'flex h-11 items-center rounded-lg border border-line px-4 hover:bg-cell'

// Какой экран показать по адресу
function Page({ hash }: { hash: string }) {
  if (hash === '#/screen') return <ScreenApp />

  // key={hash} — при переходе между пультом и редактором игра загружается из хранилища заново
  const play = /^#\/play\/(.+)$/.exec(hash)
  if (play) {
    return (
      <GameRoute key={hash} gameId={decodeURIComponent(play[1])}>
        {(game) => <HostGuard game={game} />}
      </GameRoute>
    )
  }

  const edit = /^#\/edit\/(.+)$/.exec(hash)
  if (edit) {
    return (
      <GameRoute key={hash} gameId={decodeURIComponent(edit[1])}>
        {(game) => <EditorApp initialGame={game} />}
      </GameRoute>
    )
  }

  const teams = /^#\/teams\/(.+)$/.exec(hash)
  if (teams) {
    return (
      <GameRoute key={hash} gameId={decodeURIComponent(teams[1])}>
        {(game) => <TeamsApp initialGame={game} />}
      </GameRoute>
    )
  }

  if (hash === '#/new') return <WizardApp />

  return <LibraryApp />
}

// Загружает игру из хранилища и показывает для неё нужный экран
function GameRoute({ gameId, children }: { gameId: string; children: (game: Game) => ReactNode }) {
  const [game, setGame] = useState<Game | null | undefined>(undefined)

  useEffect(() => {
    getGame(gameId).then((g) => setGame(g ?? null)) // getGame игру ещё и чинит
  }, [gameId])

  if (game === undefined) return <Placeholder text="Загрузка игры…" />
  if (game === null) return <Placeholder text="Игра не найдена." />
  return children(game)
}

function Placeholder({ text }: { text: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-bg text-white">
      <span className="text-2xl text-muted">{text}</span>
      <a href="#/" className="rounded-lg border border-line px-4 py-3 hover:bg-cell">
        ← Мои игры
      </a>
    </div>
  )
}

// Пульт со страховкой: если сломался открытый вопрос — можно закрыть его и вернуться к табло, счёт останется
function HostGuard({ game }: { game: Game }) {
  return (
    <ErrorBoundary
      fallback={(error, retry) => (
        <ErrorScreen error={error}>
          <button
            type="button"
            onClick={() => {
              closeSavedQuestion(game.id)
              retry()
            }}
            className="h-11 rounded-lg bg-white px-5 font-semibold text-black hover:opacity-90"
          >
            Закрыть вопрос и вернуться к табло
          </button>
          <button type="button" onClick={retry} className={BUTTON}>
            Попробовать снова
          </button>
          <a href="#/" className={BUTTON}>
            ← Мои игры
          </a>
        </ErrorScreen>
      )}
    >
      <HostApp initialGame={game} />
    </ErrorBoundary>
  )
}

// Экран зала сломался: зрители видят спокойный экран, а не ошибку. Клик или следующее действие пульта — снова
function HallError({ retry }: { retry: () => void }) {
  useEffect(() => {
    const channel = new BroadcastChannel(CHANNEL)
    channel.onmessage = (e: MessageEvent<Message>) => {
      if (e.data.type === 'state') retry()
    }
    return () => channel.close()
  }, [retry])
  return (
    <button type="button" onClick={retry} className="flex min-h-screen w-full items-center justify-center bg-bg text-2xl text-muted">
      Секунду…
    </button>
  )
}
