import { useState } from 'react'
import { questionProblem, type HiddenChoice } from '../game'
import { contentMedia } from '../pictures'
import { newTree, treeContents } from '../tree'
import type { Content, Question } from '../types'
import { ContentEditor, SmallButton } from './ContentEditor'
import TreeEditor from './TreeEditor'

type Props = {
  categoryTitle: string
  question: Question
  // Изменить вопрос: получает текущий вопрос, возвращает новый
  onChange: (change: (q: Question) => Question) => void
  onMediaRemoved: (mediaId: string) => void // файл убрали из вопроса — его можно удалить из хранилища
  onDelete: () => void
  onClose: () => void
  onPreview: () => void // показать вопрос так, как его увидит зал
  hiddenQuestions: HiddenChoice[] // скрытые вопросы игры — их может открыть вариант дерева
  canHide: boolean // в финале скрытых вопросов нет
}

// Редактор вопроса: стоимость, слайды (текст и файл на каждом) и ответ. Сохраняется сам после каждой правки.
export default function QuestionEditor({
  categoryTitle,
  question,
  onChange,
  onMediaRemoved,
  onDelete,
  onClose,
  onPreview,
  hiddenQuestions,
  canHide,
}: Props) {
  const { slides } = question
  const problem = questionProblem(question) // недочёт: нет ответа или нет вопроса
  const [valueText, setValueText] = useState(String(question.value)) // что набрано в поле «Стоимость»
  const [timerText, setTimerText] = useState(question.timerSec ? String(question.timerSec) : '') // поле «Таймер»

  function changeValue(text: string) {
    setValueText(text)
    const value = Number(text.trim())
    if (text.trim() !== '' && Number.isInteger(value) && value > 0) onChange((q) => ({ ...q, value }))
  }

  // Таймер в секундах: пусто — без таймера
  function changeTimer(text: string) {
    setTimerText(text)
    const sec = Number(text.trim())
    if (text.trim() === '') onChange((q) => ({ ...q, timerSec: undefined }))
    else if (Number.isInteger(sec) && sec > 0 && sec <= MAX_TIMER_SEC) onChange((q) => ({ ...q, timerSec: sec }))
  }

  function setTimerPreset(sec: number) {
    setTimerText(String(sec))
    onChange((q) => ({ ...q, timerSec: sec }))
  }

  function changeSlide(index: number, change: (slide: Content) => Content) {
    onChange((q) => ({ ...q, slides: q.slides.map((s, i) => (i === index ? change(s) : s)) }))
  }

  function addSlide() {
    onChange((q) => ({ ...q, slides: [...q.slides, {}] }))
  }

  function removeSlide(index: number) {
    const files = slides[index] ? contentMedia(slides[index]) : []
    onChange((q) => (q.slides.length > 1 ? { ...q, slides: q.slides.filter((_, i) => i !== index) } : q))
    for (const m of files) onMediaRemoved(m.id)
  }

  // Обычный вопрос ↔ ветвящийся. Дерево начинается с того, что уже есть в вопросе (первый слайд и ответ).
  function setBranching(on: boolean) {
    if (on === !!question.tree) return
    if (on) {
      onChange((q) => ({ ...q, tree: newTree(q) }))
      return
    }
    const tree = question.tree!
    if (tree.nodes.length > 1 && !window.confirm(`Убрать дерево? Его шаги (${tree.nodes.length}) удалятся, останутся слайды и ответ вопроса. Это нельзя отменить.`)) return
    for (const c of treeContents(tree)) for (const m of contentMedia(c)) onMediaRemoved(m.id)
    onChange((q) => ({ ...q, tree: undefined }))
  }

  // Поменять слайд местами с соседним: delta = -1 — выше, +1 — ниже
  function moveSlide(index: number, delta: number) {
    onChange((q) => {
      const target = index + delta
      if (target < 0 || target >= q.slides.length) return q
      const next = [...q.slides]
      ;[next[index], next[target]] = [next[target], next[index]]
      return { ...q, slides: next }
    })
  }

  return (
    <div className="flex flex-col gap-5 rounded-xl border border-line bg-cell p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-display text-xl">{categoryTitle.toUpperCase()}</span>
          <label className="flex items-center gap-2 text-sm text-muted">
            Стоимость
            <input
              inputMode="numeric"
              value={valueText}
              onChange={(e) => changeValue(e.target.value)}
              onBlur={() => setValueText(String(question.value))} // неверное число — вернуть сохранённое
              className="h-11 w-28 rounded-lg border border-line bg-bg px-3 font-display text-xl text-white focus:border-white focus:outline-none"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-muted">
            Таймер, сек
            <input
              inputMode="numeric"
              value={timerText}
              placeholder="нет"
              onChange={(e) => changeTimer(e.target.value)}
              onBlur={() => setTimerText(question.timerSec ? String(question.timerSec) : '')}
              className="h-11 w-20 rounded-lg border border-line bg-bg px-3 text-lg text-white placeholder:text-muted/60 focus:border-white focus:outline-none"
            />
          </label>
          <div role="group" aria-label="Готовые значения таймера" className="flex gap-1.5">
            {TIMER_PRESETS.map((sec) => (
              <button
                key={sec}
                type="button"
                onClick={() => setTimerPreset(sec)}
                aria-pressed={question.timerSec === sec}
                className={`h-11 min-w-11 rounded-lg px-2 text-sm ${question.timerSec === sec ? 'bg-white font-semibold text-black' : 'border border-line hover:bg-bg'}`}
              >
                {sec}
              </button>
            ))}
            {question.timerSec && (
              <button
                type="button"
                onClick={() => changeTimer('')}
                className="h-11 rounded-lg border border-line px-3 text-sm hover:bg-bg"
              >
                Без таймера
              </button>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onPreview} className="h-11 rounded-lg border border-line px-4 text-sm hover:bg-bg">
            Предпросмотр
          </button>
          <button type="button" onClick={onDelete} className="h-11 rounded-lg border border-line px-4 text-sm hover:bg-bg">
            Удалить вопрос
          </button>
          <button type="button" onClick={onClose} className="h-11 rounded-lg border border-white px-5 hover:bg-white hover:text-black">
            Готово
          </button>
        </div>
      </div>

      <div role="group" aria-label="Вид вопроса" className="flex flex-wrap items-center gap-1.5">
        {[false, true].map((branching) => (
          <button
            key={String(branching)}
            type="button"
            onClick={() => setBranching(branching)}
            aria-pressed={branching === !!question.tree}
            className={`h-11 rounded-lg px-4 text-sm ${branching === !!question.tree ? 'bg-white font-semibold text-black' : 'border border-line hover:bg-bg'}`}
          >
            {branching ? 'Ветвящийся вопрос (дерево)' : 'Обычный вопрос'}
          </button>
        ))}
      </div>

      {canHide && (
        <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-line px-4 py-2">
          <input
            type="checkbox"
            checked={!!question.hidden}
            onChange={(e) => {
              const hidden = e.target.checked || undefined
              onChange((q) => ({ ...q, hidden }))
            }}
            className="h-5 w-5 accent-white"
          />
          <span>
            <span className="font-semibold">🔒 Скрытый вопрос</span>
            <span className="block text-sm text-muted">
              В зале вместо цены — «?». Открывается вариантом ветвящегося вопроса или ведущим на пульте.
            </span>
          </span>
        </label>
      )}

      {question.tree ? (
        <TreeEditor
          tree={question.tree}
          value={question.value}
          hiddenQuestions={hiddenQuestions}
          onChange={(change) => onChange((q) => (q.tree ? { ...q, tree: change(q.tree) } : q))}
          onMediaRemoved={onMediaRemoved}
        />
      ) : (
        <>
          <p className="text-sm text-muted">
            Вопрос показывается слайдами по порядку. Обычно на первом — задание, на втором — картинка или музыка. Ведущий
            листает слайды стрелками ← / →. Всё сохраняется само.
          </p>

          {slides.map((slide, i) => (
            <section key={i} className="flex flex-col gap-3 rounded-xl border border-line bg-bg p-4">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="mr-auto text-sm font-semibold tracking-widest text-muted">
                  СЛАЙД {i + 1} ИЗ {slides.length}
                </h3>
                <SmallButton onClick={() => moveSlide(i, -1)} disabled={i === 0} label={`Поднять слайд ${i + 1} выше`}>
                  ↑
                </SmallButton>
                <SmallButton
                  onClick={() => moveSlide(i, 1)}
                  disabled={i === slides.length - 1}
                  label={`Опустить слайд ${i + 1} ниже`}
                >
                  ↓
                </SmallButton>
                <SmallButton onClick={() => removeSlide(i)} disabled={slides.length === 1} label={`Удалить слайд ${i + 1}`}>
                  Удалить слайд
                </SmallButton>
              </div>
              <ContentEditor
                content={slide}
                textLabel={`Текст слайда ${i + 1}`}
                placeholder={i === 0 ? 'Текст вопроса или описание задания' : 'Подпись к файлу (необязательно)'}
                warning={i === 0 && problem === 'no-question' ? '⚠ впишите вопрос или добавьте файл' : undefined}
                onChange={(change) => changeSlide(i, change)}
                onMediaRemoved={onMediaRemoved}
              />
            </section>
          ))}

          <button
            type="button"
            onClick={addSlide}
            className="h-11 self-start rounded-lg border border-white px-5 font-semibold hover:bg-white hover:text-black"
          >
            + Добавить слайд
          </button>

          <section className="flex flex-col gap-3 rounded-xl border-2 border-dashed border-muted p-4">
            <h3 className="text-sm font-semibold tracking-widest text-muted">ОТВЕТ · ЗАЛ УВИДИТ ЕГО ПО КНОПКЕ ВЕДУЩЕГО</h3>
            <ContentEditor
              content={question.answer}
              textLabel="Текст ответа"
              placeholder="Правильный ответ"
              warning={problem === 'no-answer' ? '⚠ впишите ответ' : undefined}
              onChange={(change) => onChange((q) => ({ ...q, answer: change(q.answer) }))}
              onMediaRemoved={onMediaRemoved}
            />
          </section>
        </>
      )}

      <section className="flex flex-col gap-3 rounded-xl border border-line p-4">
        <h3 className="text-sm font-semibold tracking-widest text-muted">ЗАМЕТКА ВЕДУЩЕМУ · ЗАЛ НЕ УВИДИТ НИКОГДА</h3>
        <textarea
          value={question.hostNote ?? ''}
          onChange={(e) => {
            const text = e.target.value
            onChange((q) => ({ ...q, hostNote: text || undefined }))
          }}
          aria-label="Заметка ведущему"
          placeholder="Подсказка себе: что засчитать верным ответом, что сказать залу, откуда взят вопрос"
          rows={2}
          className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-base text-white placeholder:text-muted/60 focus:border-white focus:outline-none"
        />
      </section>
    </div>
  )
}

const MAX_TIMER_SEC = 600 // таймер — до 10 минут
const TIMER_PRESETS = [15, 30, 60]
