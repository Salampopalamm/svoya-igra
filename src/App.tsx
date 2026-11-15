import { useEffect, useState, type ReactNode } from 'react'
import { getGame } from './db'
import EditorApp from './screens/EditorApp'
import HostApp from './screens/HostApp'
import LibraryApp from './screens/LibraryApp'
import ScreenApp from './screens/ScreenApp'
import TeamsApp from './screens/TeamsApp'
import type { Game } from './types'

// Адреса внутри приложения (часть после #):
//   #/              — «Мои игры»
//   #/play/<id>     — пульт ведущего для игры <id>
//   #/edit/<id>     — редактор игры <id>
//   #/teams/<id>    — команды игры <id>
//   #/screen        — экран зала (открывается кнопкой на пульте)
//   #/new           — мастер «Быстрая игра» (следующий шаг)
export default function App() {
  const [hash, setHash] = useState(window.location.hash)

  useEffect(() => {
    const onChange = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  if (hash === '#/screen') return <ScreenApp />

  // key={hash} — при переходе между пультом и редактором игра загружается из хранилища заново
  const play = /^#\/play\/(.+)$/.exec(hash)
  if (play) {
    return (
      <GameRoute key={hash} gameId={decodeURIComponent(play[1])}>
        {(game) => <HostApp initialGame={game} />}
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

  if (hash === '#/new') return <Placeholder text="Мастер «Быстрая игра» появится на следующем шаге." />

  return <LibraryApp />
}

// Загружает игру из хранилища и показывает для неё нужный экран
function GameRoute({ gameId, children }: { gameId: string; children: (game: Game) => ReactNode }) {
  const [game, setGame] = useState<Game | null | undefined>(undefined)

  useEffect(() => {
    getGame(gameId).then((g) => setGame(g ?? null))
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
