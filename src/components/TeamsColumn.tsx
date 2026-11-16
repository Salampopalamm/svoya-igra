import type { Player, Team } from '../types'
import PlayerAvatar from './PlayerAvatar'
import TeamIcon from './TeamIcon'

type Props = {
  teams: Team[]
  players: Player[]
  activeTeamId: string | null // чей ход (на табло) или кто отвечает (в вопросе)
  activeLabel?: string // подпись у этой команды: «ХОД», «ОТВЕЧАЕТ», «ПЕРЕХВАТ»
  outTeamIds?: string[] // ошиблись на этом вопросе — показаны бледно
  showPhotos: boolean // false — фото свёрнуты, остаются только имена
}

// Экран зала, вид «Имена + фото» (макет «Screen-board»): справа от табло колонка команд,
// в каждой — название, счёт и игроки. Команда, чей ход или кто отвечает, выделена толстой рамкой.
export default function TeamsColumn({ teams, players, activeTeamId, activeLabel, outTeamIds = [], showPhotos }: Props) {
  const avatar = teams.length <= 5 ? 44 : 32 // много команд — кружки поменьше, чтобы всё влезло

  return (
    <div className="flex flex-col gap-2.5">
      {teams.map((team) => {
        const active = team.id === activeTeamId
        const out = outTeamIds.includes(team.id)
        const members = players.filter((p) => p.teamId === team.id)
        return (
          <div
            key={team.id}
            className={`flex flex-col gap-2.5 rounded-xl px-4 py-3 ${active ? 'border-[3px] border-white bg-cell' : 'border border-line'} ${out ? 'opacity-40' : ''}`}
          >
            <div className="flex items-center justify-between gap-3">
              <TeamIcon team={team} size={36} />
              <span className="flex-1 text-lg font-semibold">
                {team.name}
                {active && activeLabel && (
                  <span className="ml-2 rounded bg-white px-2 py-0.5 align-middle text-xs text-black">{activeLabel}</span>
                )}
              </span>
              <span className="font-display text-2xl">{team.score}</span>
            </div>
            {members.length > 0 && (
              <div className={`flex flex-wrap ${showPhotos ? 'gap-3' : 'gap-x-3 gap-y-1'}`}>
                {members.map((p) => {
                  const firstName = p.name.split(/\s+/)[0]
                  return showPhotos ? (
                    <span key={p.id} className="flex flex-col items-center gap-1 text-sm">
                      <PlayerAvatar player={p} size={avatar} />
                      {firstName}
                    </span>
                  ) : (
                    <span key={p.id} className="text-sm text-muted">
                      {firstName}
                    </span>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
