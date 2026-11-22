import { formatPoints, LETTERS, stepById, stepNumber, type BranchState } from '../tree'
import type { HiddenChoice } from '../game'
import type { QuestionTree, Team } from '../types'
import { ContentMedia, SlideView } from './MediaView'
import TeamIcon from './TeamIcon'

// Ветвящийся вопрос на пульте. Верх (BranchBody) — текущий шаг и его ответ, низ (BranchControls) —
// кто отвечает, варианты и итог ветки. Обе части встают в обычный экран вопроса (QuestionView).

export function BranchBody({ tree, branch, showAnswer, onShowAnswer }: {
  tree: QuestionTree
  branch: BranchState
  showAnswer: boolean
  onShowAnswer: () => void
}) {
  const node = stepById(tree, branch.nodeId)
  if (!node) return null
  return (
    <div className="flex flex-col gap-5">
      <BranchPath tree={tree} branch={branch} />
      <SlideView slide={node.content} mode="host" textClass="text-4xl" mediaClass="max-h-[40vh] self-start" />
      {node.answer && (node.answer.text || node.answer.media) && (
        <div className="flex flex-wrap items-center gap-4 rounded-xl border-2 border-dashed border-muted p-5">
          <div className="flex-1">
            <div className="text-sm font-semibold tracking-widest text-muted">ОТВЕТ НА ЭТОТ ШАГ · ВИДИТ ТОЛЬКО ВЕДУЩИЙ</div>
            <div className="mt-1 text-3xl font-semibold">{node.answer.text}</div>
            <ContentMedia content={node.answer} mode="host" className="mt-3 max-h-48" gridHeight="12rem" />
          </div>
          {showAnswer ? (
            <span className="text-muted">Ответ показан в зале</span>
          ) : (
            <button type="button" onClick={onShowAnswer} className="h-11 rounded-lg border border-white px-5 hover:bg-white hover:text-black">
              Показать ответ в зале · Пробел
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// Пройденный путь: «Шаг 1 · А Извиниться +100 → Шаг 2 · …»
function BranchPath({ tree, branch }: { tree: QuestionTree; branch: BranchState }) {
  const total = tree.nodes.length
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
      {branch.path.map((p, i) => {
        const option = stepById(tree, p.nodeId)?.options[p.option]
        const label = tree.branchBy === 'choice' ? `${LETTERS[p.option]} ${option?.label ?? ''}` : (option?.label ?? '')
        return (
          <span key={i}>
            Шаг {stepNumber(tree, p.nodeId)} · {label} {formatPoints(option?.points ?? 0)} →
          </span>
        )
      })}
      <span className="font-semibold text-white">
        Шаг {stepNumber(tree, branch.nodeId)} из {total}
      </span>
    </div>
  )
}

export function BranchControls({ tree, branch, teams, answeringTeamId, onSelectTeam, onChoose, onClose, hiddenQuestions }: {
  tree: QuestionTree
  branch: BranchState
  teams: Team[]
  answeringTeamId: string | null
  onSelectTeam: (teamId: string | null) => void
  onChoose: (option: number) => void
  onClose: () => void
  hiddenQuestions: HiddenChoice[] // чтобы подписать, какой скрытый вопрос откроет вариант
}) {
  const node = stepById(tree, branch.nodeId)
  const team = teams.find((t) => t.id === answeringTeamId)
  const byChoice = tree.branchBy === 'choice'

  if (branch.done) {
    return (
      <div className="mt-auto flex flex-col gap-3">
        <div className="text-xl font-semibold" aria-live="polite">
          Ветка пройдена{team ? `: «${team.name}» ${formatPoints(branch.earned)}` : ''}
          {tree.scoring === 'at-end' && team ? ' — баллы начислены' : ''}
        </div>
        <button type="button" onClick={onClose} className="h-12 self-start rounded-lg bg-white px-6 font-semibold text-black hover:opacity-90">
          Вернуться к табло · Esc
        </button>
      </div>
    )
  }

  return (
    <div className="mt-auto flex flex-col gap-3">
      <div className="text-xl font-semibold" aria-live="polite">
        {team ? `Отвечает: «${team.name}»` : 'Кто отвечает? Нажмите команду или её номер'}
        {tree.scoring === 'at-end' && branch.earned !== 0 && (
          <span className="ml-3 text-base font-normal text-muted">в ветке пока {formatPoints(branch.earned)} — начислятся в конце</span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {teams.map((t, i) => {
          const active = t.id === answeringTeamId
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelectTeam(active ? null : t.id)}
              aria-pressed={active}
              className={`flex h-11 items-center gap-2 rounded-lg px-3 text-sm ${active ? 'bg-white font-semibold text-black' : 'border border-line hover:bg-cell'}`}
            >
              <span className="text-xs">{i === 9 ? 0 : i + 1}</span>
              <TeamIcon team={t} size={22} />
              {t.name}
            </button>
          )
        })}
      </div>

      <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
        {node?.options.map((o, i) => {
          const next = stepById(tree, o.nextNodeId)
          return (
            <button
              key={i}
              type="button"
              onClick={() => onChoose(i)}
              disabled={!team}
              className="flex min-h-14 items-center gap-3 rounded-xl border-2 border-white px-4 py-2 text-left hover:bg-white hover:text-black disabled:opacity-40"
            >
              {byChoice && <span className="font-display text-xl">{LETTERS[i]}</span>}
              <span className="flex-1 font-semibold">{byChoice ? o.label || 'без подписи' : `${o.label}${i === 0 ? ' · +' : ' · −'}`}</span>
              <span className="flex flex-col items-end text-sm">
                <span>
                  {formatPoints(o.points)} → {next ? `Шаг ${stepNumber(tree, next.id)}` : 'конец'}
                </span>
                {o.unlockQuestionId && hiddenQuestions.some((h) => h.id === o.unlockQuestionId) && (
                  <span>🔓 {hiddenQuestions.find((h) => h.id === o.unlockQuestionId)!.label}</span>
                )}
              </span>
            </button>
          )
        })}
      </div>

      <button type="button" onClick={onClose} className="h-11 self-start rounded-lg border border-line px-4 text-sm hover:bg-cell">
        Закрыть вопрос, не доходя до конца · Esc
      </button>
    </div>
  )
}
