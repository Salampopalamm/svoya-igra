import { auctionMode, betProblem, bidders, catValue, circleFrom, maxBet, type AuctionState } from '../catAuction'
import type { Category, Game, Question } from '../types'
import TeamIcon from './TeamIcon'

// Заставка в зале перед вопросом: «КОТ В МЕШКЕ» с темой, пока кота не отдали,
// или «АУКЦИОН» со ставками команд, пока идут торги. Сам вопрос потом — обычным экраном вопроса.
export default function CatAuctionScreen({ game, category, question, turnTeamId, auction }: {
  game: Game
  category: Category
  question: Question
  turnTeamId: string | null
  auction: AuctionState | null // null — кот
}) {
  const turnTeam = game.teams.find((t) => t.id === turnTeamId)

  if (!auction) {
    const theme = question.cat?.theme?.trim()
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-10 text-center">
        <span className="font-display text-[min(8rem,10vw)] leading-none">КОТ В МЕШКЕ</span>
        {theme && <span className="max-w-5xl text-6xl font-semibold break-words">{theme}</span>}
        <span className="rounded-xl bg-accent px-8 py-3 font-display text-5xl text-on-accent">{catValue(question)}</span>
        {turnTeam && (
          <span className="flex items-center gap-3 text-3xl text-muted">
            <TeamIcon team={turnTeam} size={40} />
            Команда «{turnTeam.name}» отдаёт вопрос
          </span>
        )}
      </div>
    )
  }

  const teams = circleFrom(bidders(game, question, turnTeamId), turnTeamId)
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-10 text-center">
      <span className="font-display text-[min(8rem,10vw)] leading-none">АУКЦИОН</span>
      <span className="font-display text-5xl">{category.title.toUpperCase()}</span>
      <span className="text-3xl text-muted">
        {auctionMode(question) === 'turn' ? 'Ставку делает команда, чей ход' : 'Команды делают ставки'}
      </span>
      <div className="flex flex-wrap justify-center gap-4">
        {teams.map((team) => {
          const bet = auction.bets[team.id]
          const ok = typeof bet === 'number' && !betProblem(game, question, team, bet)
          return (
            <span
              key={team.id}
              className={`flex items-center gap-3 rounded-xl px-6 py-4 text-3xl font-semibold ${ok ? 'border-[3px] border-accent bg-cell' : 'border-2 border-dashed border-line text-muted'}`}
            >
              <TeamIcon team={team} size={40} />
              {team.name}
              <span className="font-display">{ok ? bet : bet === null ? 'пас' : `до ${maxBet(game, question, team)}`}</span>
            </span>
          )
        })}
      </div>
    </div>
  )
}
