import { useState } from 'react'
import { questionProblem, type HiddenChoice } from '../game'
import { contentMedia } from '../pictures'
import { newTree, treeContents } from '../tree'
import { cleanSpecial, MULTIPLIERS, specialParts, specialTitle } from '../special'
import type { Content, Question, Special } from '../types'
import { catValue, cleanCat } from '../catAuction'

// Вид вопроса в редакторе: обычный, кот, аукцион или ветвящийся (дерево)
type QuestionKind = Question['kind'] | 'tree'
const KINDS: { id: QuestionKind; label: string }[] = [
  { id: 'normal', label: 'Обычный вопрос' },
  { id: 'cat-in-bag', label: '🐱 Кот в мешке' },
  { id: 'auction', label: '🔨 Аукцион' },
  { id: 'tree', label: 'Ветвящийся вопрос (дерево)' },
]
import { ContentEditor, SmallButton } from './ContentEditor'
import type { PreviewStart } from './HallPreview'
import TreeEditor from './TreeEditor'

type Props = {
  categoryTitle: string
  question: Question
  // Изменить вопрос: получает текущий вопрос, возвращает новый
  onChange: (change: (q: Question) => Question) => void
  onMediaRemoved: (mediaId: string) => void // файл убрали из вопроса — его можно удалить из хранилища
  onDelete: () => void
  onClose: () => void
  onPreview: (start?: PreviewStart) => void // показать вопрос так, как его увидит зал (с этого слайда, сразу расставлять)
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

  // Вид вопроса: обычный, «Кот в мешке», аукцион или ветвящийся (дерево начинается с того, что уже есть
  // в вопросе — первый слайд и ответ). Настройки кота и аукциона при смене вида убираем.
  const shownKind: QuestionKind = question.tree ? 'tree' : question.kind
  function setKind(kind: QuestionKind) {
    if (kind === shownKind) return
    if (question.tree) {
      const tree = question.tree
      if (tree.nodes.length > 1 && !window.confirm(`Убрать дерево? Его шаги (${tree.nodes.length}) удалятся, останутся слайды и ответ вопроса. Это нельзя отменить.`)) return
      for (const c of treeContents(tree)) for (const m of contentMedia(c)) onMediaRemoved(m.id)
    }
    onChange((q) => {
      const next: Question = { ...q, kind: kind === 'tree' ? 'normal' : kind, tree: kind === 'tree' ? newTree(q) : undefined }
      if (kind !== 'cat-in-bag') delete next.cat
      if (kind !== 'auction') delete next.auction
      if (!next.tree) delete next.tree
      return next
    })
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
          <button type="button" onClick={() => onPreview()} className="h-11 rounded-lg border border-line px-4 text-sm hover:bg-bg">
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
        {/* В финале кота и аукциона нет — там свои ставки */}
        {KINDS.filter((k) => canHide || k.id === 'normal' || k.id === 'tree' || k.id === shownKind).map((k) => (
          <button
            key={k.id}
            type="button"
            onClick={() => setKind(k.id)}
            aria-pressed={k.id === shownKind}
            className={`h-11 rounded-lg px-4 text-sm ${k.id === shownKind ? 'bg-white font-semibold text-black' : 'border border-line hover:bg-bg'}`}
          >
            {k.label}
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

      {/* Особый вопрос: ×2, без минуса, для всех команд (у дерева и в финале баллы считаются по-своему) */}
      {canHide && !question.tree && question.kind === 'normal' && <SpecialEditor question={question} onChange={onChange} />}
      {/* «Кот в мешке» и аукцион: тема и цена кота, кто торгуется */}
      {canHide && !question.tree && question.kind !== 'normal' && <CatAuctionEditor key={question.kind} question={question} onChange={onChange} />}

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
                onArrange={() => onPreview({ slide: i, arrange: true })}
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
              onArrange={() => onPreview({ answer: true, arrange: true })}
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

// Особый вопрос: как считать баллы и кто отвечает. Всё выключено — обычный вопрос.
function SpecialEditor({ question, onChange }: { question: Question; onChange: (change: (q: Question) => Question) => void }) {
  const special = question.special ?? {}
  const set = (patch: Special) =>
    onChange((q) => {
      const next = { ...q }
      const clean = cleanSpecial({ ...q.special, ...patch })
      if (clean) next.special = clean
      else delete next.special
      return next
    })
  const chip = (on: boolean) => `h-11 rounded-lg px-4 text-sm ${on ? 'bg-white font-semibold text-black' : 'border border-line hover:bg-bg'}`
  const parts = specialParts(question)
  return (
    <fieldset className="flex flex-col gap-3 rounded-lg border border-line px-4 py-3">
      <legend className="px-1 font-semibold">⭐ Особый вопрос{parts.length ? ` · ${parts.join(' · ')}` : ''}</legend>
      <div role="group" aria-label="За верный ответ" className="flex flex-wrap items-center gap-2">
        <span className="w-44 text-sm text-muted">За верный ответ</span>
        {MULTIPLIERS.map((m) => (
          <button key={m} type="button" onClick={() => set({ correct: m })} aria-pressed={(special.correct ?? 1) === m} className={chip((special.correct ?? 1) === m)}>
            {m === 1 ? `+${question.value}` : `×${m} · +${question.value * m}`}
          </button>
        ))}
      </div>
      <div role="group" aria-label="За неверный ответ" className="flex flex-wrap items-center gap-2">
        <span className="w-44 text-sm text-muted">За неверный ответ</span>
        <button type="button" onClick={() => set({ wrong: 1 })} aria-pressed={special.wrong !== 0} className={chip(special.wrong !== 0)}>
          минус стоимость
        </button>
        <button type="button" onClick={() => set({ wrong: 0 })} aria-pressed={special.wrong === 0} className={chip(special.wrong === 0)}>
          без минуса
        </button>
      </div>
      <div role="group" aria-label="Кто отвечает" className="flex flex-wrap items-center gap-2">
        <span className="w-44 text-sm text-muted">Кто отвечает</span>
        <button type="button" onClick={() => set({ forAll: false })} aria-pressed={!special.forAll} className={chip(!special.forAll)}>
          команда, чей ход
        </button>
        <button type="button" onClick={() => set({ forAll: true })} aria-pressed={!!special.forAll} className={chip(!!special.forAll)}>
          все команды сразу
        </button>
      </div>
      <p className="text-sm text-muted">
        {special.forAll
          ? 'Каждая команда пишет ответ на бумажке; ведущий отмечает на пульте, кто прав, и подводит итог. '
          : 'Ошиблась — вопрос можно перехватить, как обычно. '}
        В зале над вопросом будет надпись{parts.length ? ` «${specialTitle(question)}»` : ''}, на табло — ничего (сюрприз).
      </p>
    </fieldset>
  )
}

// «Кот в мешке»: тема и цена; аукцион: кто торгуется. Правила — в catAuction.ts
function CatAuctionEditor({ question, onChange }: { question: Question; onChange: (change: (q: Question) => Question) => void }) {
  const [priceText, setPriceText] = useState(question.cat?.value ? String(question.cat.value) : '')
  const chip = (on: boolean) => `h-11 rounded-lg px-4 text-sm ${on ? 'bg-white font-semibold text-black' : 'border border-line hover:bg-bg'}`
  const setCat = (patch: { theme?: string; value?: number }) =>
    onChange((q) => {
      const next = { ...q }
      const clean = cleanCat({ ...q.cat, ...patch })
      if (clean) next.cat = clean
      else delete next.cat
      return next
    })

  if (question.kind === 'cat-in-bag') {
    const price = Number(priceText.trim())
    const priceBad = priceText.trim() !== '' && !(Number.isInteger(price) && price > 0)
    return (
      <fieldset className="flex flex-col gap-3 rounded-lg border border-line px-4 py-3">
        <legend className="px-1 font-semibold">🐱 Кот в мешке · цена {catValue(question)}</legend>
        <label className="flex flex-wrap items-center gap-2">
          <span className="w-44 text-sm text-muted">Тема кота</span>
          <input
            value={question.cat?.theme ?? ''}
            onChange={(e) => setCat({ theme: e.target.value })}
            placeholder="Например: Мультфильмы 90-х"
            className="h-11 min-w-0 flex-1 rounded-lg border border-line bg-bg px-3 text-white placeholder:text-muted/60 focus:border-white focus:outline-none"
          />
        </label>
        <label className="flex flex-wrap items-center gap-2">
          <span className="w-44 text-sm text-muted">Цена кота</span>
          <input
            inputMode="numeric"
            value={priceText}
            onChange={(e) => {
              setPriceText(e.target.value)
              const n = Number(e.target.value.trim())
              setCat({ value: Number.isInteger(n) && n > 0 ? n : undefined })
            }}
            placeholder={`как в ячейке — ${question.value}`}
            className="h-11 w-48 rounded-lg border border-line bg-bg px-3 text-white placeholder:text-muted/60 focus:border-white focus:outline-none"
          />
          {priceBad && <span className="text-sm">⚠ цена — целое число больше нуля; пока стоит {question.value}</span>}
        </label>
        <p className="text-sm text-muted">
          В зале сначала заставка «Кот в мешке», тема и цена. Команда, чей ход, отдаёт вопрос любой команде (можно и себе).
          Отвечает только получатель: верно — +цена, неверно — −цена, перехвата нет. На табло — обычная ячейка (сюрприз).
        </p>
      </fieldset>
    )
  }

  const mode = question.auction ?? 'all'
  const setMode = (auction: 'all' | 'turn') => onChange((q) => ({ ...q, auction }))
  return (
    <fieldset className="flex flex-col gap-3 rounded-lg border border-line px-4 py-3">
      <legend className="px-1 font-semibold">🔨 Аукцион</legend>
      <div role="group" aria-label="Кто торгуется" className="flex flex-wrap items-center gap-2">
        <span className="w-44 text-sm text-muted">Кто делает ставки</span>
        <button type="button" onClick={() => setMode('all')} aria-pressed={mode === 'all'} className={chip(mode === 'all')}>
          все команды
        </button>
        <button type="button" onClick={() => setMode('turn')} aria-pressed={mode === 'turn'} className={chip(mode === 'turn')}>
          только команда, чей ход
        </button>
      </div>
      <p className="text-sm text-muted">
        Ставки — шагом 100, от 100, не больше 25% от суммы плюсовых счетов (но не меньше цены ячейки); команда в плюсе —
        не больше своего счёта, в минусе — не больше своего минуса.{' '}
        {mode === 'all'
          ? 'Каждая команда ставит или пасует. Первой отвечает команда, чей ход: верно — +ставка, неверно — −ставка, и отвечает следующая по кругу со своей ставкой.'
          : 'Ставит и отвечает только команда, чей ход: верно — +ставка, неверно — −ставка, перехвата нет.'}{' '}
        На табло — обычная ячейка (сюрприз).
      </p>
    </fieldset>
  )
}
