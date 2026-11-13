import type { Team } from '../types'

// Счёт команд внизу экрана (компактный вид: номер, название, очки).
export default function Scoreboard({ teams }: { teams: Team[] }) {
  return (
    <div className="grid gap-2.5" style={{ gridTemplateColumns: `repeat(${Math.min(teams.length, 5)}, 1fr)` }}>
      {teams.map((team, i) => (
        <div key={team.id} className="flex items-center gap-4 rounded-xl border border-line px-5 py-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-white font-display text-lg">
            {i + 1}
          </span>
          <span className="flex-1 text-lg font-semibold">{team.name}</span>
          <span className="font-display text-2xl">{team.score}</span>
        </div>
      ))}
    </div>
  )
}
