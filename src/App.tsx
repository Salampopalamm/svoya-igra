import { useEffect, useState } from 'react'
import { getGame } from './db'
import HostApp from './screens/HostApp'
import LibraryApp from './screens/LibraryApp'
import ScreenApp from './screens/ScreenApp'
import type { Game } from './types'

// Адреса внутри приложения (часть после #):
//   #/              — «Мои игры»
//   #/play/<id>     — пульт ведущего для игры <id>
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

  const play = /^#\/play\/(.+)$/.exec(hash)
  if (play) return <HostRoute gameId={decodeURIComponent(play[1])} />

  if (hash === '#/new') return <Placeholder text="Мастер «Быстрая игра» появится на следующем шаге." />

  return <LibraryApp />
}

// Загружает игру из хранилища и открывает пульт
function HostRoute({ gameId }: { gameId: string }) {
  const [game, setGame] = useState<Game | null | undefined>(undefined)

  useEffect(() => {
    getGame(gameId).then((g) => setGame(g ?? null))
  }, [gameId])

  if (game === undefined) return <Placeholder text="Загрузка игры…" />
  if (game === null) return <Placeholder text="Игра не найдена." />
  return <HostApp key={game.id} initialGame={game} />
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
