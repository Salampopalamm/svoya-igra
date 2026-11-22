import { finalThemes, isValidBet, participants, remainingThemes, remover } from '../final'
import type { FinalState } from '../live'
import type { Game, Round } from '../types'
import { ContentMedia } from './MediaView'
import TeamIcon from './TeamIcon'

// Финал в зале: убирание тем, ставки (только кто поставил — суммы не видны) и итоги.
// Сам вопрос финала зал показывает обычным экраном вопроса (ScreenQuestion).
export default function FinalScreen({ game, round, final }: { game: Game; round: Round; final: FinalState }) {
  const themes = finalThemes(round)
  const left = remainingThemes(round, final)
  const theme = left[0]

  if (themes.length === 0) {
    return <div className="flex flex-1 items-center justify-center font-display text-5xl">ФИНАЛ</div>
  }

  if (final.phase === 'themes') {
    const team = remover(game, final)
    return (
      <div className="flex flex-1 flex-col justify-center gap-6">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <span className="font-display text-4xl">ФИНАЛ · ТЕМЫ</span>
          {team && (
            <span className="flex items-center gap-3 rounded-xl border-[3px] border-accent bg-cell px-5 py-3 text-2xl font-semibold">
              <TeamIcon team={team} size={36} />
              Убирает тему: {team.name}
            </span>
          )}
        </div>
        <div className="flex flex-col gap-3">
          {themes.map(({ category }) => {
            const removed = final.removedIds.includes(category.id)
            return (
              <div
                key={category.id}
                className={`flex min-h-20 items-center rounded-xl px-8 font-display text-4xl transition ${removed ? 'border-2 border-dashed border-line text-muted line-through' : 'bg-cell'}`}
              >
                {category.title.toUpperCase()}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  if (final.phase === 'bets') {
    const playing = participants(game, final)
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-10 text-center">
        <span className="font-display text-3xl text-muted">ФИНАЛ</span>
        <span className="font-display text-6xl">{theme?.category.title.toUpperCase()}</span>
        <span className="text-3xl">Команды делают ставки</span>
        <div className="flex flex-wrap justify-center gap-4">
          {playing.map((team) => {
            const done = isValidBet(team, final.bets[team.id]) // ставка вписана и подходит
            return (
              <span
                key={team.id}
                className={`flex items-center gap-3 rounded-xl px-5 py-3 text-2xl font-semibold ${done ? 'border-[3px] border-accent bg-cell' : 'border-2 border-dashed border-line text-muted'}`}
              >
                <TeamIcon team={team} size={32} />
                {team.name} {done ? '✓' : '…'}
              </span>
            )
          })}
        </div>
      </div>
    )
  }

  // Итоги: ставки, верно / неверно и новый счёт — все сразу, ниже ответ
  const playing = participants(game, final)
  const answer = theme?.question.answer
  return (
    <div className="flex flex-1 flex-col justify-center gap-8">
      <span className="font-display text-4xl">ФИНАЛ · ИТОГИ</span>
      <div className="flex flex-col gap-3">
        {playing.map((team) => {
          const bet = final.bets[team.id]
          const ok = final.correct[team.id]
          return (
            <div
              key={team.id}
              className={`grid items-center gap-6 rounded-xl px-8 py-4 text-3xl ${ok ? 'border-[3px] border-accent bg-cell' : 'border-2 border-line'}`}
              style={{ gridTemplateColumns: 'minmax(0, 1fr) auto auto auto' }}
            >
              <span className="flex items-center gap-3 font-semibold">
                <TeamIcon team={team} size={40} />
                {team.name}
              </span>
              <span className="text-muted">ставка {bet}</span>
              <span className="font-semibold">{ok ? `✓ +${bet}` : `✗ −${bet}`}</span>
              <span className="min-w-32 text-right font-display">{team.score}</span>
            </div>
          )
        })}
      </div>
      {answer && (
        <div className="rounded-xl border-2 border-white p-8">
          <div className="text-sm font-semibold tracking-widest text-muted">ОТВЕТ</div>
          <div className="mt-2 text-5xl font-semibold">{answer.text}</div>
          <ContentMedia content={answer} mode="hall" className="mt-4 max-h-[30vh]" gridHeight="30vh" />
        </div>
      )}
    </div>
  )
}
