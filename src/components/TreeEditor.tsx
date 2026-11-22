import { useState } from 'react'
import { contentMedia } from '../pictures'
import {
  correctnessOptions,
  LETTERS,
  MAX_OPTIONS,
  newStep,
  removeStep,
  setBranchBy,
  stepNumber,
  treeProblems,
  updateStep,
  type TreeOption,
} from '../tree'
import type { HiddenChoice } from '../game'
import type { Content, QuestionTree, TreeNode } from '../types'
import { ContentEditor, SmallButton } from './ContentEditor'

type Props = {
  tree: QuestionTree
  value: number // стоимость вопроса — баллы по умолчанию за верный вариант
  hiddenQuestions: HiddenChoice[] // скрытые вопросы игры: вариант может открыть один из них
  onChange: (change: (tree: QuestionTree) => QuestionTree) => void
  onMediaRemoved: (mediaId: string) => void
}

const toggle = (on: boolean) =>
  `h-11 rounded-lg px-3 text-sm ${on ? 'bg-white font-semibold text-black' : 'border border-line hover:bg-bg'}`

// Редактор ветвящегося вопроса: шаги списком сверху вниз, у каждого — что видит зал и варианты ответа.
// Вариант даёт баллы и ведёт к другому шагу или к концу ветки.
export default function TreeEditor({ tree, value, hiddenQuestions, onChange, onMediaRemoved }: Props) {
  const problems = treeProblems(tree)
  const byChoice = tree.branchBy === 'choice'

  function changeStep(id: string, change: (n: TreeNode) => TreeNode) {
    onChange((t) => updateStep(t, id, change))
  }

  function changeOption(id: string, index: number, change: (o: TreeOption) => TreeOption) {
    changeStep(id, (n) => ({ ...n, options: n.options.map((o, i) => (i === index ? change(o) : o)) }))
  }

  // «Дальше → новый шаг»: создаём пустой шаг в конце списка и ведём вариант туда
  function linkToNewStep(id: string, index: number) {
    const created = newStep()
    onChange((t) => {
      const withStep = { ...t, nodes: [...t.nodes, created] }
      return updateStep(withStep, id, (n) => ({
        ...n,
        options: n.options.map((o, i) => (i === index ? { ...o, nextNodeId: created.id } : o)),
      }))
    })
  }

  function deleteStep(node: TreeNode) {
    const filled = node.content.text?.trim() || node.content.media || node.options.length > 0
    if (filled && !window.confirm(`Удалить шаг ${stepNumber(tree, node.id)}? Варианты, которые вели сюда, будут вести к концу ветки.`)) return
    for (const c of [node.content, node.answer]) for (const m of c ? contentMedia(c) : []) onMediaRemoved(m.id)
    onChange((t) => removeStep(t, node.id))
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div role="group" aria-label="Тип ветвления" className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-sm text-muted">Ветвление:</span>
          <button type="button" onClick={() => onChange((t) => setBranchBy(t, 'choice', value))} aria-pressed={byChoice} className={toggle(byChoice)}>
            По выбору варианта
          </button>
          <button
            type="button"
            onClick={() => onChange((t) => setBranchBy(t, 'correctness', value))}
            aria-pressed={!byChoice}
            className={toggle(!byChoice)}
          >
            По правильности ответа
          </button>
        </div>
        <div role="group" aria-label="Когда начислять баллы" className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-sm text-muted">Баллы:</span>
          {(['per-step', 'at-end'] as const).map((scoring) => (
            <button
              key={scoring}
              type="button"
              onClick={() => onChange((t) => ({ ...t, scoring }))}
              aria-pressed={tree.scoring === scoring}
              className={toggle(tree.scoring === scoring)}
            >
              {scoring === 'per-step' ? 'За каждый шаг' : 'Одной суммой в конце'}
            </button>
          ))}
        </div>
      </div>
      <p className="text-sm text-muted">
        {byChoice
          ? 'Команда называет вариант (А, Б, В…), ведущий нажимает его на пульте — у каждого варианта свои баллы и свой следующий шаг.'
          : 'Ведущий нажимает «Верно» или «Неверно» — верный и неверный ответ ведут каждый к своему шагу.'}{' '}
        Отвечает команда, которая выбрала ячейку. Шаг без вариантов — конец ветки, после него ведущий возвращается к табло.
      </p>

      {tree.nodes.map((node, i) => (
        <StepCard
          key={node.id}
          tree={tree}
          node={node}
          index={i}
          byChoice={byChoice}
          hiddenQuestions={hiddenQuestions}
          onChangeContent={(change) => changeStep(node.id, (n) => ({ ...n, content: change(n.content) }))}
          onChangeAnswer={(change) => changeStep(node.id, (n) => ({ ...n, answer: change(n.answer ?? {}) }))}
          onRemoveAnswer={() => {
            for (const m of node.answer ? contentMedia(node.answer) : []) onMediaRemoved(m.id)
            changeStep(node.id, (n) => ({ ...n, answer: undefined }))
          }}
          onAddAnswer={() => changeStep(node.id, (n) => ({ ...n, answer: {} }))}
          onChangeOption={(index, change) => changeOption(node.id, index, change)}
          onLinkNew={(index) => linkToNewStep(node.id, index)}
          onAddOption={() =>
            changeStep(node.id, (n) =>
              byChoice ? { ...n, options: [...n.options, { label: '', points: 0 }] } : { ...n, options: correctnessOptions(value) },
            )
          }
          onRemoveOption={(index) => changeStep(node.id, (n) => ({ ...n, options: n.options.filter((_, k) => k !== index) }))}
          onEndBranch={() => changeStep(node.id, (n) => ({ ...n, options: [] }))}
          onDelete={() => deleteStep(node)}
          onMediaRemoved={onMediaRemoved}
        />
      ))}

      <button
        type="button"
        onClick={() => onChange((t) => ({ ...t, nodes: [...t.nodes, newStep()] }))}
        className="h-11 self-start rounded-lg border border-white px-5 font-semibold hover:bg-white hover:text-black"
      >
        + Добавить шаг
      </button>

      {problems.length > 0 ? (
        <div role="status" className="flex flex-col gap-1 rounded-xl border border-white p-4">
          <span className="font-semibold">⚠ Проверка дерева</span>
          {problems.map((p, k) => (
            <span key={k}>{p.text}</span>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted">✓ Проверка дерева: тупиков и забытых шагов нет.</p>
      )}
    </section>
  )
}

// Один шаг дерева: что видит зал, ответ (по желанию) и варианты
function StepCard({
  tree,
  node,
  index,
  byChoice,
  hiddenQuestions,
  onChangeContent,
  onChangeAnswer,
  onRemoveAnswer,
  onAddAnswer,
  onChangeOption,
  onLinkNew,
  onAddOption,
  onRemoveOption,
  onEndBranch,
  onDelete,
  onMediaRemoved,
}: {
  tree: QuestionTree
  node: TreeNode
  index: number
  byChoice: boolean
  hiddenQuestions: HiddenChoice[]
  onChangeContent: (change: (c: Content) => Content) => void
  onChangeAnswer: (change: (c: Content) => Content) => void
  onRemoveAnswer: () => void
  onAddAnswer: () => void
  onChangeOption: (index: number, change: (o: TreeOption) => TreeOption) => void
  onLinkNew: (index: number) => void
  onAddOption: () => void
  onRemoveOption: (index: number) => void
  onEndBranch: () => void
  onDelete: () => void
  onMediaRemoved: (mediaId: string) => void
}) {
  const isStart = node.id === tree.startNodeId
  const others = tree.nodes.filter((n) => n.id !== node.id)

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-line bg-bg p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="mr-auto text-sm font-semibold tracking-widest text-muted">
          ШАГ {index + 1}
          {isStart && ' · СТАРТ'}
          {node.options.length === 0 && ' · КОНЕЦ ВЕТКИ'}
        </h3>
        {!isStart && (
          <SmallButton onClick={onDelete} label={`Удалить шаг ${index + 1}`}>
            Удалить шаг
          </SmallButton>
        )}
      </div>

      <ContentEditor
        content={node.content}
        textLabel={`Текст шага ${index + 1}`}
        placeholder={isStart ? 'Вопрос или ситуация: что увидит зал' : 'Следующий вопрос, ситуация или итог ветки'}
        onChange={onChangeContent}
        onMediaRemoved={onMediaRemoved}
      />

      {node.answer ? (
        <div className="flex flex-col gap-2 rounded-lg border border-dashed border-muted p-3">
          <div className="flex items-center gap-2">
            <span className="mr-auto text-xs font-semibold tracking-widest text-muted">
              ОТВЕТ НА ЭТОТ ШАГ · ВЕДУЩИЙ ВИДИТ ВСЕГДА, ЗАЛ — ПО ПРОБЕЛУ
            </span>
            <SmallButton onClick={onRemoveAnswer} label={`Убрать ответ шага ${index + 1}`}>
              Убрать
            </SmallButton>
          </div>
          <ContentEditor
            content={node.answer}
            textLabel={`Ответ шага ${index + 1}`}
            placeholder="Правильный ответ (необязательно)"
            onChange={onChangeAnswer}
            onMediaRemoved={onMediaRemoved}
          />
        </div>
      ) : (
        <button type="button" onClick={onAddAnswer} className="h-11 self-start rounded-lg border border-line px-4 text-sm hover:bg-cell">
          + Ответ на этот шаг
        </button>
      )}

      {node.options.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold tracking-widest text-muted">ВАРИАНТЫ</span>
          {node.options.map((o, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              {byChoice ? (
                <>
                  <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-white font-semibold text-black">{LETTERS[i]}</span>
                  <input
                    value={o.label}
                    onChange={(e) => {
                      const label = e.target.value
                      onChangeOption(i, (x) => ({ ...x, label }))
                    }}
                    aria-label={`Вариант ${LETTERS[i]} шага ${index + 1}`}
                    placeholder="Подпись варианта"
                    className={`h-11 min-w-48 flex-1 rounded-lg border bg-bg px-3 text-white focus:border-white focus:outline-none ${o.label.trim() ? 'border-line' : 'border-white placeholder:text-white'}`}
                  />
                </>
              ) : (
                <span className="flex h-11 min-w-28 items-center rounded-lg border border-line px-3 font-semibold">{o.label}</span>
              )}
              <PointsInput
                points={o.points}
                label={`Баллы за вариант ${byChoice ? LETTERS[i] : o.label} шага ${index + 1}`}
                onChange={(points) => onChangeOption(i, (x) => ({ ...x, points }))}
              />
              <label className="flex items-center gap-2 text-sm text-muted">
                дальше →
                <select
                  value={o.nextNodeId && others.some((n) => n.id === o.nextNodeId) ? o.nextNodeId : ''}
                  onChange={(e) => {
                    if (e.target.value === '__new') onLinkNew(i)
                    else {
                      const nextNodeId = e.target.value || undefined
                      onChangeOption(i, (x) => ({ ...x, nextNodeId }))
                    }
                  }}
                  aria-label={`Куда ведёт вариант ${byChoice ? LETTERS[i] : o.label} шага ${index + 1}`}
                  className="h-11 rounded-lg border border-line bg-bg px-2 text-white focus:border-white focus:outline-none"
                >
                  <option value="">Конец ветки</option>
                  {others.map((n) => (
                    <option key={n.id} value={n.id}>
                      Шаг {stepNumber(tree, n.id)}
                      {n.content.text?.trim() ? ` · ${n.content.text.trim().slice(0, 30)}` : ''}
                    </option>
                  ))}
                  <option value="__new">+ Новый шаг</option>
                </select>
              </label>
              {hiddenQuestions.length > 0 && (
                <label className="flex items-center gap-2 text-sm text-muted">
                  🔓 открывает
                  <select
                    value={hiddenQuestions.some((h) => h.id === o.unlockQuestionId) ? o.unlockQuestionId : ''}
                    onChange={(e) => {
                      const unlockQuestionId = e.target.value || undefined
                      onChangeOption(i, (x) => ({ ...x, unlockQuestionId }))
                    }}
                    aria-label={`Какой скрытый вопрос открывает вариант ${byChoice ? LETTERS[i] : o.label} шага ${index + 1}`}
                    className="h-11 max-w-64 rounded-lg border border-line bg-bg px-2 text-white focus:border-white focus:outline-none"
                  >
                    <option value="">ничего</option>
                    {hiddenQuestions.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {byChoice && (
                <SmallButton onClick={() => onRemoveOption(i)} label={`Удалить вариант ${LETTERS[i]} шага ${index + 1}`}>
                  ✕
                </SmallButton>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {byChoice && node.options.length < MAX_OPTIONS && (
          <button type="button" onClick={onAddOption} className="h-11 rounded-lg border border-line px-4 text-sm hover:bg-cell">
            + Вариант
          </button>
        )}
        {!byChoice && node.options.length === 0 && (
          <button type="button" onClick={onAddOption} className="h-11 rounded-lg border border-line px-4 text-sm hover:bg-cell">
            + Варианты «Верно / Неверно»
          </button>
        )}
        {node.options.length > 0 && !isStart && (
          <button type="button" onClick={onEndBranch} className="h-11 rounded-lg border border-line px-4 text-sm hover:bg-cell">
            Сделать концом ветки
          </button>
        )}
        {node.options.length === 0 && (
          <span className="flex h-11 items-center text-sm text-muted">
            Конец ветки: зал увидит этот шаг и сколько баллов набрала команда.
          </span>
        )}
      </div>
    </section>
  )
}

// Баллы варианта: целое число, можно с минусом. Пока печатают «-», в игру ничего не попадает.
function PointsInput({ points, label, onChange }: { points: number; label: string; onChange: (points: number) => void }) {
  const [text, setText] = useState(String(points))
  return (
    <label className="flex items-center gap-2 text-sm text-muted">
      баллы
      <input
        inputMode="numeric"
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          const n = Number(e.target.value.trim().replace('−', '-'))
          if (e.target.value.trim() !== '' && Number.isInteger(n)) onChange(n)
        }}
        onBlur={() => setText(String(points))}
        aria-label={label}
        className="h-11 w-24 rounded-lg border border-line bg-bg px-3 text-white focus:border-white focus:outline-none"
      />
    </label>
  )
}
