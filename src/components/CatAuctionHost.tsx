import { useState } from 'react'
import {
  answerOrder,
  auctionLimit,
  auctionMode,
  auctionStartProblem,
  betProblem,
  bidders,
  catValue,
  circleFrom,
  maxBet,
  type AuctionState,
  type CatState,
} from '../catAuction'
import type { Game, Question, Team } from '../types'
import TeamIcon from './TeamIcon'

// «Кот в мешке» и аукцион на пульте — низ вопроса вместо обычных команд.
// Кот: сначала «Кому отдать?», потом отвечает только получатель (без перехвата).
// Аукцион: сначала ставки (или пас), потом отвечают по кругу команды со ставкой.

type Props = {
  game: Game
  question: Question
  turnTeamId: string | null
  answeringTeamId: string | null
  triedTeamIds: string[]
  cat: CatState | null
  auction: AuctionState | null
  nextTurnTeamName?: string
  onGive: (teamId: string) => void
  onSetBet: (teamId: string, bet: number | null | undefined) => void
  onStartAuction: () => void
  onSelectTeam: (teamId: string | null) => void
  onCorrect: (teamId: string) => void
  onWrong: (teamId: string) => void
  onClose: () => void
}

const keyNumber = (game: Game, team: Team) => {
  const i = game.teams.indexOf(team)
  return i === 9 ? 0 : i + 1
}

export default function CatAuctionHost(props: Props) {
  const { game, question, turnTeamId, cat, auction, onClose } = props
  const turnTeam = game.teams.find((t) => t.id === turnTeamId)

  // Кот ещё не отдан: в зале заставка «КОТ В МЕШКЕ» и тема
  if (cat && !cat.teamId) {
    return (
      <div className="mt-auto flex flex-col gap-3">
        <div className="text-xl font-semibold" aria-live="polite">
          🐱 Кот в мешке{question.cat?.theme?.trim() ? ` · тема «${question.cat.theme.trim()}»` : ''} · цена {catValue(question)}
        </div>
        <p className="text-muted">
          В зале — заставка «Кот в мешке». {turnTeam ? `Команда «${turnTeam.name}» отдаёт` : 'Команда отдаёт'} вопрос любой команде — можно и себе.
          Кому? Нажмите команду или её номер.
        </p>
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(game.teams.length, 5)}, 1fr)` }}>
          {circleFrom(game.teams, turnTeamId).map((team) => (
            <button
              key={team.id}
              type="button"
              onClick={() => props.onGive(team.id)}
              className="flex min-h-14 items-center gap-2 rounded-xl border border-white px-4 text-left font-semibold hover:bg-white hover:text-black"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line text-sm">{keyNumber(game, team)}</span>
              <TeamIcon team={team} size={28} />
              {team.name}
              {team.id === turnTeamId && <span className="ml-auto text-xs">себе</span>}
            </button>
          ))}
        </div>
        <CloseRow onClose={onClose} label="Закрыть без ответа · Esc" next={props.nextTurnTeamName} />
      </div>
    )
  }

  // Аукцион, торги: ведущий вписывает ставки (или пас), потом открывает вопрос
  if (auction && auction.phase === 'bets') {
    const teams = bidders(game, question, turnTeamId)
    const problem = auctionStartProblem(game, question, turnTeamId, auction.bets)
    const all = auctionMode(question) === 'all'
    return (
      <div className="mt-auto flex flex-col gap-3">
        <div className="text-xl font-semibold" aria-live="polite">
          🔨 Аукцион · {all ? 'торгуются все команды' : `ставку делает «${turnTeam?.name ?? '—'}»`} · предел {auctionLimit(game, question)}
        </div>
        <p className="text-muted">
          В зале — заставка «Аукцион» и ставки. Ставки — шагом 100, от 100.
          {all ? ' Без ставки — пас. Первой отвечает команда, чей ход, ошиблась — следующая со ставкой.' : ' Неверно — минус ставка, перехвата нет.'}
        </p>
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(22rem, 100%), 1fr))' }}>
          {circleFrom(teams, turnTeamId).map((team) => (
            <BetInput
              key={team.id}
              team={team}
              turn={team.id === turnTeamId}
              bet={auction.bets[team.id]}
              max={maxBet(game, question, team)}
              problem={(bet) => betProblem(game, question, team, bet)}
              canPass={all}
              onChange={(bet) => props.onSetBet(team.id, bet)}
            />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={props.onStartAuction}
            disabled={!!problem}
            className="h-12 rounded-lg bg-white px-6 font-semibold text-black hover:opacity-90 disabled:opacity-40"
          >
            Ставки сделаны — показать вопрос
          </button>
          {problem && <span className="text-sm">⚠ {problem}</span>}
          <button type="button" onClick={onClose} className="h-11 rounded-lg border border-line px-4 text-sm hover:bg-cell">
            Закрыть без ответа · Esc
          </button>
        </div>
      </div>
    )
  }

  return <Answering {...props} />
}

// Вопрос кота или аукциона идёт: отвечают получатель кота или команды со ставкой (по кругу)
function Answering({ game, question, turnTeamId, answeringTeamId, triedTeamIds, cat, auction, nextTurnTeamName, onSelectTeam, onCorrect, onWrong, onClose }: Props) {
  const teams = cat
    ? game.teams.filter((t) => t.id === cat.teamId)
    : auction
      ? answerOrder(game, turnTeamId, auction.bets)
      : []
  const passed = auction ? game.teams.filter((t) => !teams.includes(t) && bidders(game, question, turnTeamId).includes(t)) : []
  const points = (team: Team) => (cat ? catValue(question) : (auction?.bets[team.id] ?? 0))
  const answering = teams.find((t) => t.id === answeringTeamId)
  const left = teams.filter((t) => !triedTeamIds.includes(t.id))
  const status = answering
    ? cat
      ? `Кот у «${answering.name}»: отвечает только эта команда, перехвата нет`
      : `Отвечает «${answering.name}» · ставка ${points(answering)}`
    : left.length === 0
      ? `${teams.length > 1 ? 'Все ошиблись' : 'Ошиблись'} — покажите ответ и закройте вопрос`
      : 'Кто отвечает? Нажмите команду'

  return (
    <div className="mt-auto flex flex-col gap-3">
      <div className="text-xl font-semibold" aria-live="polite">
        {cat ? '🐱 ' : '🔨 '}
        {status}
      </div>
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(Math.max(teams.length, 2), 5)}, 1fr)` }}>
        {teams.map((team) => {
          const isAnswering = team.id === answeringTeamId
          const tried = triedTeamIds.includes(team.id)
          return (
            <div
              key={team.id}
              className={`flex flex-col gap-2 rounded-xl p-4 ${isAnswering ? 'border-2 border-white bg-cell' : 'border border-line'} ${tried ? 'opacity-40' : ''}`}
            >
              <button
                type="button"
                onClick={() => onSelectTeam(isAnswering ? null : team.id)}
                disabled={tried}
                aria-pressed={isAnswering}
                className="flex min-h-11 items-center gap-2 text-left font-semibold"
              >
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm ${isAnswering ? 'bg-white text-black' : 'border border-line'}`}>
                  {keyNumber(game, team)}
                </span>
                <TeamIcon team={team} size={28} />
                {team.name}
                <span className="ml-auto text-sm font-normal text-muted">{cat ? `цена ${points(team)}` : `ставка ${points(team)}`}</span>
              </button>
              {tried ? (
                <div className="flex h-11 items-center text-muted">Ошиблись −{points(team)}</div>
              ) : isAnswering ? (
                <div className="flex gap-2">
                  <button type="button" onClick={() => onCorrect(team.id)} className="h-11 flex-1 rounded-lg bg-white font-semibold text-black hover:opacity-90">
                    Верно +{points(team)}
                  </button>
                  <button type="button" onClick={() => onWrong(team.id)} className="h-11 flex-1 rounded-lg border border-white hover:bg-cell">
                    Неверно −{points(team)}
                  </button>
                </div>
              ) : (
                <div className="flex h-11 items-center text-muted">ждёт своей очереди</div>
              )}
            </div>
          )
        })}
      </div>
      {passed.length > 0 && <p className="text-sm text-muted">Пас: {passed.map((t) => `«${t.name}»`).join(', ')}</p>}
      <CloseRow
        onClose={onClose}
        label={left.length === 0 ? 'Закрыть вопрос · Esc' : 'Никто не ответил — закрыть · Esc'}
        next={nextTurnTeamName}
      />
    </div>
  )
}

function CloseRow({ onClose, label, next }: { onClose: () => void; label: string; next?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <button type="button" onClick={onClose} className="h-11 rounded-lg border border-line px-4 text-sm hover:bg-cell">
        {label}
      </button>
      {next && <span className="text-sm text-muted">Потом ход у «{next}»</span>}
    </div>
  )
}

const parseBet = (text: string) => {
  const n = Number(text.trim())
  return text.trim() === '' || !Number.isFinite(n) ? undefined : n
}

// Ставка команды: вписать число, «Макс» или «Пас». Печатаем свободно, ошибку показываем сразу.
function BetInput({ team, turn, bet, max, problem, canPass, onChange }: {
  team: Team
  turn: boolean
  bet: number | null | undefined
  max: number
  problem: (bet: number) => string | null
  canPass: boolean
  onChange: (bet: number | null | undefined) => void
}) {
  const [text, setText] = useState(typeof bet === 'number' ? String(bet) : '')
  // Ставку поменяли не здесь (Ctrl+Z, «Макс», «Пас») — поле показывает её
  const [shown, setShown] = useState(bet)
  if (shown !== bet) {
    setShown(bet)
    if (parseBet(text) !== bet) setText(typeof bet === 'number' ? String(bet) : '')
  }
  const passed = bet === null
  const error = typeof bet === 'number' ? problem(bet) : text.trim() ? 'впишите число' : null
  const ok = typeof bet === 'number' && !error
  return (
    <div className={`flex flex-col gap-2 rounded-xl p-4 ${ok ? 'border-2 border-white' : 'border border-line'} ${passed ? 'opacity-50' : ''}`}>
      <span className="flex items-center gap-2 font-semibold">
        <TeamIcon team={team} size={28} /> {team.name}
        {turn && <span className="rounded border border-line px-2 py-0.5 text-xs text-muted">ХОД</span>}
        <span className="ml-auto text-sm font-normal text-muted">счёт {team.score}</span>
      </span>
      <div className="flex gap-2">
        <input
          inputMode="numeric"
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            onChange(parseBet(e.target.value))
          }}
          aria-label={`Ставка команды «${team.name}»`}
          placeholder={passed ? 'пас' : `100 … ${max}`}
          className="h-11 min-w-0 flex-1 rounded-lg border border-line bg-bg px-3 text-lg text-white placeholder:text-muted/60 focus:border-white focus:outline-none"
        />
        <button type="button" onClick={() => onChange(max)} className="h-11 rounded-lg border border-line px-3 text-sm hover:bg-cell">
          Макс {max}
        </button>
        {canPass && (
          <button
            type="button"
            onClick={() => onChange(passed ? undefined : null)}
            aria-pressed={passed}
            className={`h-11 rounded-lg px-3 text-sm ${passed ? 'bg-white font-semibold text-black' : 'border border-line hover:bg-cell'}`}
          >
            Пас
          </button>
        )}
      </div>
      {error && <span className="text-sm">⚠ {error}</span>}
    </div>
  )
}
