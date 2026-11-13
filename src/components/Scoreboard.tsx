import type { Team } from '../types'

type Props = {
  teams: Team[]
  answeringTeamId?: string | null // подсветить отвечающую команду
}

// Счёт команд внизу экрана (компактный вид: номер, название, очки).
export default function Scoreboard({ teams, answeringTeamId }: Props) {
  return (
    <div className="grid gap-2.5" style={{ gridTemplateColumns: `repeat(${Math.min(teams.length, 5)}, 1fr)` }}>
      {teams.map((team, i) => {
        const answering = team.id === answeringTeamId
        return (
          <div
            key={team.id}
            className={`flex items-center gap-4 rounded-xl px-5 py-3 ${answering ? 'border-[3px] border-white bg-cell' : 'border border-line'}`}
          >
            <span
              className={`flex h-11 w-11 items-center justify-center rounded-full font-display text-lg ${answering ? 'bg-white text-black' : 'border-2 border-white'}`}
            >
              {i === 9 ? 0 : i + 1}
            </span>
            <span className="flex-1 text-lg font-semibold">{team.name}</span>
            <span className="font-display text-2xl">{team.score}</span>
          </div>
        )
      })}
    </div>
  )
}
