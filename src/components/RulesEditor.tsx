import { useState } from 'react'
import { addMediaFile } from '../db'
import { hiddenQuestions } from '../game'
import { hiddenRounds, newRule, playableQuestions, ruleProblem, THEN_NAMES, WHEN_NAMES, type ThenKind, type WhenKind } from '../rules'
import type { Game, Rule } from '../types'
import { MediaView } from './MediaView'

type Props = {
  game: Game
  onChange: (change: (rules: Rule[]) => Rule[]) => void
  onMediaRemoved: (mediaId: string) => void
}

const field = 'h-11 rounded-lg border border-line bg-bg px-2 text-white focus:border-white focus:outline-none'

// Правила игры «ЕСЛИ → ТО»: каждое — одной строкой. В игре пульт предложит ведущему выполнить правило,
// когда условие выполнится.
export default function RulesEditor({ game, onChange, onMediaRemoved }: Props) {
  const change = (id: string, f: (r: Rule) => Rule) => onChange((rules) => rules.map((r) => (r.id === id ? f(r) : r)))

  function remove(rule: Rule) {
    if (rule.then.media) onMediaRemoved(rule.then.media.id)
    onChange((rules) => rules.filter((r) => r.id !== rule.id))
  }

  return (
    <section id="rules" className="flex flex-col gap-4 rounded-xl border border-line p-4">
      <h2 className="text-sm font-semibold tracking-widest text-muted">ПРАВИЛА ИГРЫ · ЕСЛИ → ТО</h2>
      <p className="text-sm text-muted">
        Когда условие выполнится, пульт предложит ведущему выполнить правило — «Выполнить» или «Пропустить». Каждое
        правило срабатывает один раз за игру. Скрытые вопросы и раунды отмечаются в самих вопросах и раундах.
      </p>

      {game.rules.map((rule, i) => (
        <RuleRow key={rule.id} game={game} rule={rule} index={i} onChange={(f) => change(rule.id, f)} onRemove={() => remove(rule)} onMediaRemoved={onMediaRemoved} />
      ))}
      {game.rules.length === 0 && <p className="text-muted">Правил пока нет.</p>}

      <button
        type="button"
        onClick={() => onChange((rules) => [...rules, newRule()])}
        className="h-11 self-start rounded-lg border border-white px-5 font-semibold hover:bg-white hover:text-black"
      >
        + Правило
      </button>
    </section>
  )
}

function RuleRow({ game, rule, index, onChange, onRemove, onMediaRemoved }: {
  game: Game
  rule: Rule
  index: number
  onChange: (f: (r: Rule) => Rule) => void
  onRemove: () => void
  onMediaRemoved: (mediaId: string) => void
}) {
  const problem = ruleProblem(game, rule)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const { when, then } = rule
  const n = index + 1

  async function attach(file: File | undefined) {
    if (!file) return
    setError(null)
    setBusy(true)
    try {
      const ref = await addMediaFile(file)
      if (ref.type === 'audio') {
        onMediaRemoved(ref.id)
        setError('Музыку зал не показывает — выберите картинку, GIF или видео.')
        return
      }
      const old = then.media
      onChange((r) => ({ ...r, then: { ...r.then, target: ref.id, media: ref } }))
      if (old) onMediaRemoved(old.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не получилось сохранить файл.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`flex flex-col gap-3 rounded-xl bg-bg p-4 ${problem ? 'border border-white' : 'border border-line'}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-display text-lg">ЕСЛИ</span>
        <select
          value={when.kind}
          onChange={(e) => {
            const kind = e.target.value as WhenKind
            onChange((r) => ({ ...r, when: { kind, value: kind === 'score-reached' ? 1000 : '' } }))
          }}
          aria-label={`Условие правила ${n}`}
          className={field}
        >
          {(Object.keys(WHEN_NAMES) as WhenKind[]).map((k) => (
            <option key={k} value={k}>
              {WHEN_NAMES[k]}
            </option>
          ))}
        </select>

        {when.kind === 'score-reached' && (
          <ScoreInput
            value={Number(when.value) || 0}
            label={`Сколько баллов в правиле ${n}`}
            onChange={(value) => onChange((r) => ({ ...r, when: { ...r.when, value } }))}
          />
        )}
        {when.kind === 'round-finished' && (
          <select
            value={String(when.value)}
            onChange={(e) => {
              const value = e.target.value
              onChange((r) => ({ ...r, when: { ...r.when, value } }))
            }}
            aria-label={`Раунд в правиле ${n}`}
            className={field}
          >
            <option value="">— выберите раунд —</option>
            {game.rounds.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
        )}
        {when.kind === 'question-played' && (
          <select
            value={String(when.value)}
            onChange={(e) => {
              const value = e.target.value
              onChange((r) => ({ ...r, when: { ...r.when, value } }))
            }}
            aria-label={`Вопрос в правиле ${n}`}
            className={`${field} max-w-72`}
          >
            <option value="">— выберите вопрос —</option>
            {playableQuestions(game).map((q) => (
              <option key={q.id} value={q.id}>
                {q.label}
              </option>
            ))}
          </select>
        )}

        <span className="font-display text-lg">→ ТО</span>
        <select
          value={then.kind}
          onChange={(e) => {
            const kind = e.target.value as ThenKind
            if (then.media) onMediaRemoved(then.media.id)
            onChange((r) => ({ ...r, then: { kind, target: '' } }))
          }}
          aria-label={`Действие правила ${n}`}
          className={field}
        >
          {(Object.keys(THEN_NAMES) as ThenKind[]).map((k) => (
            <option key={k} value={k}>
              {THEN_NAMES[k]}
            </option>
          ))}
        </select>

        {then.kind === 'unlock-question' && (
          <select
            value={then.target}
            onChange={(e) => {
              const target = e.target.value
              onChange((r) => ({ ...r, then: { ...r.then, target } }))
            }}
            aria-label={`Скрытый вопрос в правиле ${n}`}
            className={`${field} max-w-72`}
          >
            <option value="">— скрытый вопрос —</option>
            {hiddenQuestions(game).map((h) => (
              <option key={h.id} value={h.id}>
                {h.label}
              </option>
            ))}
          </select>
        )}
        {then.kind === 'open-round' && (
          <select
            value={then.target}
            onChange={(e) => {
              const target = e.target.value
              onChange((r) => ({ ...r, then: { ...r.then, target } }))
            }}
            aria-label={`Скрытый раунд в правиле ${n}`}
            className={field}
          >
            <option value="">— скрытый раунд —</option>
            {hiddenRounds(game).map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
        )}

        <button
          type="button"
          onClick={onRemove}
          aria-label={`Удалить правило ${n}`}
          className="ml-auto h-11 rounded-lg border border-line px-3 text-sm hover:bg-cell"
        >
          Удалить
        </button>
      </div>

      {then.kind === 'show-media' && (
        <div className="flex flex-wrap items-center gap-3">
          {then.media && <MediaView media={then.media} mode="editor" className="max-h-32" />}
          <label className="flex h-11 cursor-pointer items-center rounded-lg border border-line px-4 text-sm hover:bg-cell">
            {busy ? 'Сохраняю…' : then.media ? 'Заменить файл' : '+ Картинка, GIF или видео'}
            <input
              type="file"
              accept="image/*,video/*"
              className="sr-only"
              onChange={(e) => {
                void attach(e.target.files?.[0])
                e.target.value = ''
              }}
            />
          </label>
          {error && <span className="text-sm">⚠ {error}</span>}
        </div>
      )}

      {problem && <span className="text-sm">⚠ {problem}</span>}
    </div>
  )
}

// Сколько баллов: печатаем свободно, в правило попадает только целое число больше нуля
function ScoreInput({ value, label, onChange }: { value: number; label: string; onChange: (value: number) => void }) {
  const [text, setText] = useState(String(value))
  return (
    <span className="flex items-center gap-2">
      <input
        inputMode="numeric"
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          const n = Number(e.target.value.trim())
          if (Number.isInteger(n) && n > 0) onChange(n)
        }}
        onBlur={() => setText(String(value))}
        aria-label={label}
        className="h-11 w-24 rounded-lg border border-line bg-bg px-3 text-white focus:border-white focus:outline-none"
      />
      <span className="text-sm text-muted">баллов</span>
    </span>
  )
}
