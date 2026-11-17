import { useState } from 'react'
import { betsReady, isValidBet, participants, remainingThemes, remover, finalThemes } from '../final'
import type { FinalState } from '../live'
import type { Game, Round, Team } from '../types'
import TeamIcon from './TeamIcon'

// Финал на пульте: убирание тем, ставки и итоги. Сам вопрос финала идёт обычным экраном вопроса
// (QuestionView), а внизу вместо кнопок команд — FinalAnswers.

type Props = {
  game: Game
  round: Round
  final: FinalState
  onRemoveTheme: (categoryId: string) => void
  onSetBet: (teamId: string, bet: number | undefined) => void
  onShowQuestion: () => void
}

const sectionTitle = 'text-sm font-semibold tracking-widest text-muted'

export default function FinalHost({ game, round, final, onRemoveTheme, onSetBet, onShowQuestion }: Props) {
  const themes = finalThemes(round)
  const left = remainingThemes(round, final)

  if (themes.length === 0) {
    return (
      <div className="flex flex-1 flex-col gap-3 rounded-xl border border-line p-6">
        <span className="font-display text-2xl">ФИНАЛ</span>
        <p className="text-lg">В финальном раунде нет ни одного заполненного вопроса — добавьте темы в редакторе.</p>
      </div>
    )
  }

  if (final.phase === 'themes') {
    const team = remover(game, final)
    return (
      <div className="flex flex-1 flex-col gap-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <span className="font-display text-2xl">ФИНАЛ · УБИРАЕМ ТЕМЫ</span>
          <span className="text-muted">
            Осталось {left.length} из {themes.length} · убирают по очереди, начинает отстающая команда
          </span>
        </div>
        {team && (
          <div className="flex items-center gap-3 text-xl font-semibold" aria-live="polite">
            Убирает тему: <TeamIcon team={team} size={32} /> {team.name}
          </div>
        )}
        <div className="flex flex-col gap-2">
          {themes.map(({ category }) => {
            const removed = final.removedIds.includes(category.id)
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => onRemoveTheme(category.id)}
                disabled={removed}
                className={`flex min-h-14 items-center justify-between gap-4 rounded-xl px-5 text-left font-display text-xl ${removed ? 'border-2 border-dashed border-line text-muted line-through' : 'bg-cell hover:bg-white hover:text-black'}`}
              >
                {category.title.toUpperCase()}
                {!removed && <span className="font-sans text-sm font-normal">убрать</span>}
              </button>
            )
          })}
        </div>
        <p className="text-sm text-muted">Ошиблись темой — Ctrl+Z.</p>
      </div>
    )
  }

  if (final.phase === 'bets') {
    const playing = participants(game, final)
    const watching = game.teams.filter((t) => !playing.includes(t))
    const ready = betsReady(game, final)
    return (
      <div className="flex flex-1 flex-col gap-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <span className="font-display text-2xl">ФИНАЛ · СТАВКИ</span>
          <span className="text-xl">
            Тема: <span className="font-display">{left[0]?.category.title.toUpperCase()}</span>
          </span>
        </div>
        <p className="text-muted">
          Команды пишут ставку на бумажке — от 1 до своего счёта — и отдают вам. Впишите ставки: зал увидит только, кто
          уже поставил, а суммы — на итогах.
        </p>
        {playing.length === 0 ? (
          <p className="text-lg">Ни у одной команды нет плюсового счёта — ставить некому. Финал можно сыграть без ставок.</p>
        ) : (
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
            {playing.map((team) => (
              <BetInput key={team.id} team={team} bet={final.bets[team.id]} onChange={(bet) => onSetBet(team.id, bet)} />
            ))}
          </div>
        )}
        {watching.length > 0 && (
          <p className="text-sm text-muted">
            Не играют (счёт 0 или меньше): {watching.map((t) => t.name).join(', ')}
          </p>
        )}
        <button
          type="button"
          onClick={onShowQuestion}
          disabled={!ready}
          className="h-12 self-start rounded-lg bg-white px-6 font-semibold text-black hover:opacity-90 disabled:opacity-40"
        >
          Показать вопрос финала
        </button>
        {!ready && <span className="text-sm text-muted">Сначала впишите ставки всех играющих команд</span>}
      </div>
    )
  }

  // Итоги (phase === 'results'): счёт уже начислен, зал видит таблицу и ответ
  const theme = left[0]
  return (
    <div className="flex flex-1 flex-col gap-5">
      <span className="font-display text-2xl">ФИНАЛ · ИТОГИ</span>
      <FinalResultsTable game={game} final={final} />
      {theme && (
        <div className="rounded-xl border-2 border-dashed border-muted p-5">
          <div className={sectionTitle}>ОТВЕТ · ПОКАЗАН В ЗАЛЕ</div>
          <div className="mt-1 text-2xl font-semibold">{theme.question.answer.text}</div>
        </div>
      )}
      <p className="text-sm text-muted">Финал сыгран, счёт обновлён. Ошиблись с отметкой — Ctrl+Z вернёт к вопросу.</p>
    </div>
  )
}

// Поле ставки: печатаем свободно, в игру попадает только целое число
function BetInput({ team, bet, onChange }: { team: Team; bet: number | undefined; onChange: (bet: number | undefined) => void }) {
  const [text, setText] = useState(bet === undefined ? '' : String(bet))
  const valid = isValidBet(team, bet)
  return (
    <label className={`flex flex-col gap-2 rounded-xl p-4 ${valid ? 'border-2 border-white' : 'border border-line'}`}>
      <span className="flex items-center gap-2 font-semibold">
        <TeamIcon team={team} size={28} /> {team.name}
        <span className="ml-auto text-sm font-normal text-muted">счёт {team.score}</span>
      </span>
      <input
        inputMode="numeric"
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          const n = Number(e.target.value.trim())
          onChange(e.target.value.trim() === '' || !Number.isFinite(n) ? undefined : n)
        }}
        aria-label={`Ставка команды «${team.name}»`}
        placeholder={`от 1 до ${team.score}`}
        className="h-11 rounded-lg border border-line bg-bg px-3 text-lg text-white placeholder:text-muted/60 focus:border-white focus:outline-none"
      />
      {text.trim() !== '' && !valid && <span className="text-sm">⚠ ставка — от 1 до {team.score}</span>}
    </label>
  )
}

// Отметки на вопросе финала: кто ответил верно. Итоги уходят в зал одной кнопкой.
export function FinalAnswers({ game, final, onMark, onReveal }: {
  game: Game
  final: FinalState
  onMark: (teamId: string, correct: boolean) => void
  onReveal: () => void
}) {
  const playing = participants(game, final)
  const allMarked = playing.every((t) => final.correct[t.id] !== undefined)
  return (
    <div className="mt-auto flex flex-col gap-3">
      <div className="text-xl font-semibold">Кто ответил верно? Ставки и итоги зал увидит после «Раскрыть итоги».</div>
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.max(1, Math.min(playing.length, 5))}, 1fr)` }}>
        {playing.map((team) => {
          const mark = final.correct[team.id]
          const bet = final.bets[team.id]
          return (
            <div key={team.id} className={`flex flex-col gap-2 rounded-xl p-4 ${mark !== undefined ? 'border-2 border-white' : 'border border-line'}`}>
              <span className="flex items-center gap-2 font-semibold">
                <TeamIcon team={team} size={28} /> {team.name}
                <span className="ml-auto text-sm font-normal text-muted">ставка {bet}</span>
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onMark(team.id, true)}
                  aria-pressed={mark === true}
                  className={`h-11 flex-1 rounded-lg font-semibold ${mark === true ? 'bg-white text-black' : 'border border-line hover:bg-cell'}`}
                >
                  Верно +{bet}
                </button>
                <button
                  type="button"
                  onClick={() => onMark(team.id, false)}
                  aria-pressed={mark === false}
                  className={`h-11 flex-1 rounded-lg ${mark === false ? 'bg-white font-semibold text-black' : 'border border-line hover:bg-cell'}`}
                >
                  Неверно −{bet}
                </button>
              </div>
            </div>
          )
        })}
      </div>
      {playing.length === 0 && <p className="text-muted">Ставок нет — можно сразу показать ответ.</p>}
      <button
        type="button"
        onClick={onReveal}
        disabled={!allMarked}
        className="h-12 self-start rounded-lg bg-white px-6 font-semibold text-black hover:opacity-90 disabled:opacity-40"
      >
        Раскрыть итоги в зале
      </button>
      {!allMarked && <span className="text-sm text-muted">Отметьте каждую команду: верно или неверно</span>}
    </div>
  )
}

// Таблица итогов на пульте: ставка, верно / неверно, новый счёт
function FinalResultsTable({ game, final }: { game: Game; final: FinalState }) {
  const playing = participants(game, final)
  if (playing.length === 0) return <p className="text-muted">Ставок не было — счёт не изменился.</p>
  return (
    <div className="flex flex-col gap-2">
      {playing.map((team) => {
        const bet = final.bets[team.id]
        const ok = final.correct[team.id]
        return (
          <div key={team.id} className="flex flex-wrap items-center gap-4 rounded-xl border border-line px-5 py-3 text-lg">
            <span className="flex min-w-48 items-center gap-2 font-semibold">
              <TeamIcon team={team} size={28} /> {team.name}
            </span>
            <span className="text-muted">ставка {bet}</span>
            <span className="font-semibold">{ok ? `✓ +${bet}` : `✗ −${bet}`}</span>
            <span className="ml-auto font-display">{team.score}</span>
          </div>
        )
      })}
    </div>
  )
}
