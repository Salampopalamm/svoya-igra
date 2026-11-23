import { useEffect, useState } from 'react'
import { addMediaFile, deleteMediaIfUnused, saveGame } from '../db'
import { MAX_QUESTIONS, MAX_TEAMS } from '../game'
import { canAddPicture, contentMedia, MAX_PICTURES } from '../pictures'
import { plural } from '../plural'
import ThemeEditor from '../components/ThemeEditor'
import {
  clearDraft,
  draftTheme,
  draftThemeMedia,
  emptyRow,
  gameFromDraft,
  isRowEmpty,
  loadDraft,
  newDraft,
  parseTable,
  problemText,
  rowProblems,
  saveDraft,
  templateCsv,
  type Draft,
  type Row,
} from '../wizard'

const STEPS = ['Название и оформление', 'Вопросы', 'Команды'] as const

const field =
  'h-11 min-w-0 rounded-lg border border-line bg-bg px-3 text-sm text-white placeholder:text-muted/60 focus:border-white focus:outline-none'
const ghostButton = 'h-11 rounded-lg border border-line px-4 text-sm hover:bg-cell disabled:opacity-40'
const bigButton = 'h-12 rounded-lg px-5'

// Мастер «Быстрая игра» (#/new): название → вопросы таблицей (макет «Wizard») → команды.
// Черновик сохраняется в браузере, пока игра не создана.
export default function WizardApp() {
  const [draft, setDraft] = useState<Draft>(() => loadDraft() ?? newDraft())
  const [step, setStep] = useState(0)
  const [creating, setCreating] = useState(false)

  useEffect(() => saveDraft(draft), [draft])

  const update = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }))
  const filledRows = draft.rows.filter((r) => !isRowEmpty(r))

  // Создать игру из черновика и перейти на пульт или к участникам
  async function create(next: 'play' | 'teams') {
    setCreating(true)
    const game = gameFromDraft(draft)
    await saveGame(game)
    clearDraft()
    window.location.hash = `#/${next}/${encodeURIComponent(game.id)}`
  }

  function startOver() {
    if (!window.confirm('Начать с чистого листа? Всё, что вы ввели в мастере, пропадёт.')) return
    for (const r of draft.rows) for (const m of contentMedia(r)) void deleteMediaIfUnused(m.id)
    for (const m of draftThemeMedia(draft)) void deleteMediaIfUnused(m.id)
    setDraft(newDraft())
    setStep(0)
  }

  return (
    <div className="flex min-h-screen flex-col gap-6 bg-bg px-12 py-8 text-white">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-baseline gap-4">
          <a href="#/" className="text-sm text-muted hover:text-white">
            ← Мои игры
          </a>
          <h1 className="font-display text-2xl">БЫСТРАЯ ИГРА</h1>
        </div>
        <ol className="flex flex-wrap gap-2 text-sm">
          {STEPS.map((title, i) => (
            <li key={title}>
              <button
                type="button"
                onClick={() => setStep(i)}
                disabled={i > step}
                aria-current={i === step ? 'step' : undefined}
                className={`flex h-11 items-center gap-2 rounded-full px-4 ${i === step ? 'bg-white font-semibold text-black' : 'border border-line text-muted enabled:hover:text-white'}`}
              >
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${i === step ? 'bg-black text-white' : 'bg-cell'}`}
                >
                  {i < step ? '✓' : i + 1}
                </span>
                {title}
              </button>
            </li>
          ))}
        </ol>
      </header>

      {step === 0 && <TitleStep draft={draft} update={update} />}
      {step === 1 && <QuestionsStep draft={draft} setDraft={setDraft} />}
      {step === 2 && <TeamsStep draft={draft} update={update} />}

      <footer className="mt-auto flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {step > 0 && (
            <button type="button" onClick={() => setStep(step - 1)} className={`${bigButton} border border-line hover:bg-cell`}>
              ← Назад
            </button>
          )}
          <button type="button" onClick={startOver} className={`${bigButton} text-sm text-muted hover:text-white`}>
            Начать с чистого листа
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {step === 0 && (
            <>
              {!draft.title.trim() && <span className="text-sm text-muted">Впишите название, чтобы продолжить</span>}
              <button
                type="button"
                onClick={() => setStep(1)}
                disabled={!draft.title.trim()}
                className={`${bigButton} bg-white font-bold text-black hover:opacity-90 disabled:opacity-40`}
              >
                Далее: вопросы →
              </button>
            </>
          )}
          {step === 1 && (
            <>
              {filledRows.length === 0 && <span className="text-sm text-muted">Добавьте хотя бы один вопрос</span>}
              <button
                type="button"
                onClick={() => create('play')}
                disabled={filledRows.length === 0 || creating}
                className={`${bigButton} border border-white hover:bg-white hover:text-black disabled:opacity-40`}
              >
                Пропустить команды и играть
              </button>
              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={filledRows.length === 0}
                className={`${bigButton} bg-white font-bold text-black hover:opacity-90 disabled:opacity-40`}
              >
                Далее: команды →
              </button>
            </>
          )}
          {step === 2 && (
            <>
              <button
                type="button"
                onClick={() => create('teams')}
                disabled={creating}
                className={`${bigButton} border border-white hover:bg-white hover:text-black disabled:opacity-40`}
              >
                Создать и добавить участников
              </button>
              <button
                type="button"
                onClick={() => create('play')}
                disabled={creating}
                className={`${bigButton} bg-white font-bold text-black hover:opacity-90 disabled:opacity-40`}
              >
                Создать и играть
              </button>
            </>
          )}
        </div>
      </footer>
    </div>
  )
}

// ---- Шаг 1: название и оформление ----

function TitleStep({ draft, update }: { draft: Draft; update: (patch: Partial<Draft>) => void }) {
  const theme = draftTheme(draft)
  return (
    <div className="flex flex-col gap-6">
      <section className="flex max-w-2xl flex-col gap-5">
        <label className="flex flex-col gap-2 text-sm text-muted">
          Название игры
          <input
            autoFocus
            value={draft.title}
            onChange={(e) => update({ title: e.target.value })}
            placeholder="Например: Новогодний корпоратив"
            className="h-14 rounded-lg border border-line bg-bg px-4 text-xl font-semibold text-white placeholder:text-muted/60 focus:border-white focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm text-muted">
          Для кого (необязательно)
          <input
            value={draft.client}
            onChange={(e) => update({ client: e.target.value })}
            placeholder="Компания или повод"
            className={`${field} text-base`}
          />
        </label>
      </section>
      <p className="text-sm text-muted">
        Оформление меняет только экран зала. Можно ничего не выбирать — будет строгий тёмный стиль; поменять всё это
        можно и потом, в редакторе игры.
      </p>
      <ThemeEditor
        theme={theme}
        onChange={(patch) => update({ theme: { ...theme, ...patch } })}
        onMediaRemoved={(id) => void deleteMediaIfUnused(id)}
      />
    </div>
  )
}

// ---- Шаг 2: вопросы таблицей (макет «Wizard») ----

const mediaKinds = { image: 'фото', gif: 'GIF', video: 'видео', audio: 'аудио' }

function QuestionsStep({ draft, setDraft }: { draft: Draft; setDraft: (f: (d: Draft) => Draft) => void }) {
  const [error, setError] = useState<string | null>(null)
  const rows = draft.rows
  const problems = rowProblems(rows)
  const filled = rows.filter((r) => !isRowEmpty(r))
  const categories = new Set(filled.map((r) => r.category.trim() || 'Без категории'))

  const setRows = (f: (rows: Row[]) => Row[]) => setDraft((d) => ({ ...d, rows: f(d.rows) }))
  const changeRow = (id: string, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))

  // Ctrl+V в любом месте страницы: если скопированы ячейки таблицы — заполняем таблицу.
  // Обычный текст в одно поле вставляется как обычно.
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const text = e.clipboardData?.getData('text/plain') ?? ''
      if (!text.includes('\t') && !text.trim().includes('\n')) return
      const pasted = parseTable(text)
      if (pasted.length === 0) return
      e.preventDefault()
      // Таблица ещё пустая — заменяем её целиком, иначе дописываем в конец
      setRows((rs) => (rs.every(isRowEmpty) ? pasted : [...rs.filter((r) => !isRowEmpty(r)), ...pasted]))
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  })

  function downloadTemplate() {
    const url = URL.createObjectURL(templateCsv())
    const link = document.createElement('a')
    link.href = url
    link.download = 'вопросы-шаблон.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  function addCategory() {
    const title = `Категория ${categories.size + 1}`
    setRows((rs) => [
      ...rs,
      ...Array.from({ length: MAX_QUESTIONS }, (_, i) => emptyRow(title, String((i + 1) * 100))),
    ])
  }

  function addQuestion() {
    setRows((rs) => {
      const category = rs.at(-1)?.category ?? 'Категория 1'
      const values = rs.filter((r) => r.category === category).map((r) => Number(r.value) || 0)
      return [...rs, emptyRow(category, String(Math.max(0, ...values) + 100))]
    })
  }

  // Файлы строки. Пустая строка: первый файл — любой (картинка, музыка, видео), остальные — картинки рядом с ним.
  // У строки уже есть картинка: новые картинки встают рядом (до 8 на слайде, как в редакторе).
  async function attach(row: Row, files: File[]) {
    if (files.length === 0) return
    setError(null)
    try {
      let media = row.media
      let rest = files
      if (media) {
        if (!canAddPicture(row)) return
      } else {
        media = await addMediaFile(files[0])
        rest = files.slice(1)
      }
      const room = MAX_PICTURES - 1 - (row.more?.length ?? 0)
      const pictures = media.type === 'image' || media.type === 'gif' ? rest.filter((f) => f.type.startsWith('image/')) : []
      if (pictures.length < rest.length) setError('Рядом с картинкой можно ставить только картинки — остальные файлы пропущены.')
      if (pictures.length > room) setError(`На одном слайде помещается до ${MAX_PICTURES} картинок — лишние пропущены.`)
      const more = [...(row.more ?? [])]
      for (const f of pictures.slice(0, Math.max(0, room))) more.push(await addMediaFile(f))
      changeRow(row.id, { media, more: more.length > 0 ? more : undefined })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не получилось сохранить файл.')
    }
  }

  // Убрать все файлы строки
  function detach(row: Row) {
    const files = contentMedia(row)
    if (files.length === 0) return
    changeRow(row.id, { media: undefined, more: undefined })
    for (const m of files) void deleteMediaIfUnused(m.id)
  }

  function removeRow(row: Row) {
    setRows((rs) => rs.filter((r) => r.id !== row.id))
    for (const m of contentMedia(row)) void deleteMediaIfUnused(m.id)
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-dashed border-white px-5 py-4">
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
          <rect x="4" y="5" width="20" height="18" rx="2" stroke="currentColor" strokeWidth="2" />
          <path d="M4 11h20M11 5v18" stroke="currentColor" strokeWidth="2" />
        </svg>
        <div className="min-w-72 flex-1">
          <div className="font-semibold">Вопросы уже в Excel или Google Таблице?</div>
          <div className="text-sm text-muted">
            Скопируйте колонки «Категория, Стоимость, Вопрос, Ответ» и нажмите Ctrl+V в любом месте страницы — таблица
            заполнится сама.
          </div>
        </div>
        <button type="button" onClick={downloadTemplate} className={ghostButton}>
          Скачать пустой шаблон
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-muted">
          {categories.size} {plural(categories.size, 'категория', 'категории', 'категорий')} · {filled.length}{' '}
          {plural(filled.length, 'вопрос', 'вопроса', 'вопросов')}
          {problems.size > 0 && (
            <>
              {' · '}
              <span className="font-semibold text-white">
                {problems.size} {plural(problems.size, 'недочёт', 'недочёта', 'недочётов')}
              </span>
            </>
          )}
        </span>
        <div className="flex gap-2">
          <button type="button" onClick={addCategory} className={ghostButton}>
            + Категория
          </button>
          <button type="button" onClick={addQuestion} className={ghostButton}>
            + Вопрос
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-white px-3 py-2 text-sm">
          {error}
        </p>
      )}

      <div className="flex flex-col overflow-hidden rounded-xl border border-line">
        <div
          className="grid bg-cell text-xs font-semibold tracking-wider text-muted"
          style={{ gridTemplateColumns: columns }}
        >
          <span className="px-3 py-3">КАТЕГОРИЯ</span>
          <span className="px-3 py-3">СТОИМОСТЬ</span>
          <span className="px-3 py-3">ВОПРОС</span>
          <span className="px-3 py-3">ОТВЕТ</span>
          <span className="px-3 py-3">МЕДИА</span>
          <span />
        </div>

        {rows.map((row, i) => {
          const problem = problems.get(row.id)
          const sameCategory = i > 0 && rows[i - 1].category === row.category
          const newCategory = i > 0 && !sameCategory
          return (
            <div
              key={row.id}
              className={`${newCategory ? 'border-t-2' : 'border-t'} border-line ${problem ? 'outline-2 -outline-offset-2 outline-white' : ''}`}
            >
              <div className="grid items-center gap-2 px-1.5 py-1.5" style={{ gridTemplateColumns: columns }}>
                <input
                  value={row.category}
                  onChange={(e) => changeRow(row.id, { category: e.target.value })}
                  aria-label={`Категория, строка ${i + 1}`}
                  className={`${field} ${sameCategory ? 'text-muted' : 'font-semibold'}`}
                />
                <input
                  value={row.value}
                  inputMode="numeric"
                  onChange={(e) => changeRow(row.id, { value: e.target.value })}
                  aria-label={`Стоимость, строка ${i + 1}`}
                  className={field}
                />
                <input
                  value={row.question}
                  onChange={(e) => changeRow(row.id, { question: e.target.value })}
                  aria-label={`Вопрос, строка ${i + 1}`}
                  placeholder={problem === 'no-question' ? '⚠ впишите вопрос' : 'Текст вопроса'}
                  className={field}
                />
                <input
                  value={row.answer}
                  onChange={(e) => changeRow(row.id, { answer: e.target.value })}
                  aria-label={`Ответ, строка ${i + 1}`}
                  placeholder={problem === 'no-answer' ? '⚠ впишите ответ' : 'Ответ'}
                  className={`${field} ${problem === 'no-answer' ? 'placeholder:font-semibold placeholder:text-white' : ''}`}
                />
                {row.media ? (
                  <span className="flex items-center gap-1">
                    <span
                      title={contentMedia(row).map((m) => m.name).join(', ')}
                      className="flex h-9 min-w-12 items-center justify-center rounded-md bg-cell px-2 text-xs whitespace-nowrap text-muted"
                    >
                      {row.more?.length ? `${row.more.length + 1} фото` : mediaKinds[row.media.type]}
                    </span>
                    {canAddPicture(row) && (
                      <label
                        title="Добавить ещё картинки на тот же слайд"
                        className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-md border border-dashed border-muted text-muted hover:border-white hover:text-white focus-within:border-white"
                      >
                        +
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          aria-label={`Добавить ещё картинки, строка ${i + 1}`}
                          className="sr-only"
                          onChange={(e) => {
                            void attach(row, [...(e.target.files ?? [])])
                            e.target.value = ''
                          }}
                        />
                      </label>
                    )}
                    <button
                      type="button"
                      onClick={() => detach(row)}
                      aria-label={`Убрать ${row.more?.length ? 'все файлы' : `файл «${row.media.name}»`}, строка ${i + 1}`}
                      className="h-11 w-11 shrink-0 rounded-lg text-muted hover:text-white"
                    >
                      ×
                    </button>
                  </span>
                ) : (
                  <label
                    title="Картинка, музыка или видео: покажется вторым слайдом после текста вопроса. Можно выбрать сразу несколько картинок"
                    className="flex h-11 w-14 cursor-pointer items-center justify-center rounded-md border border-dashed border-muted text-muted hover:border-white hover:text-white focus-within:border-white"
                  >
                    +
                    <input
                      type="file"
                      accept="image/*,audio/*,video/*"
                      multiple
                      aria-label={`Добавить медиа, строка ${i + 1}`}
                      className="sr-only"
                      onChange={(e) => {
                        void attach(row, [...(e.target.files ?? [])])
                        e.target.value = ''
                      }}
                    />
                  </label>
                )}
                <button
                  type="button"
                  onClick={() => removeRow(row)}
                  aria-label={`Удалить строку ${i + 1}`}
                  className="h-11 w-11 rounded-lg text-lg text-muted hover:bg-cell hover:text-white"
                >
                  ×
                </button>
              </div>
              {problem && problem !== 'no-answer' && problem !== 'no-question' && (
                <p className="px-3 pb-2 text-xs font-semibold">⚠ {problemText[problem]}</p>
              )}
            </div>
          )
        })}

        {rows.length === 0 && (
          <p className="border-t border-line px-4 py-6 text-center text-muted">
            Таблица пуста. Вставьте вопросы через Ctrl+V или нажмите «+ Категория».
          </p>
        )}
      </div>

      <p className="text-sm text-muted">
        Пустые строки не попадут в игру. Файл в строке покажется вторым слайдом после текста вопроса. Остальное — несколько
        слайдов, файл в ответе — можно доделать потом в редакторе.
      </p>
    </section>
  )
}

const columns = '180px 100px minmax(0, 1fr) 240px 156px 44px'

// ---- Шаг 3: команды ----

function TeamsStep({ draft, update }: { draft: Draft; update: (patch: Partial<Draft>) => void }) {
  const names = draft.teamNames

  function setCount(count: number) {
    const next = Array.from({ length: count }, (_, i) => names[i] ?? `Команда ${i + 1}`)
    update({ teamNames: next })
  }

  return (
    <section className="flex max-w-3xl flex-col gap-5">
      <div role="group" aria-label="Сколько команд" className="flex flex-wrap items-center gap-2">
        <span className="mr-2 text-sm text-muted">Сколько команд:</span>
        {Array.from({ length: MAX_TEAMS }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setCount(n)}
            aria-pressed={names.length === n}
            className={`h-11 w-11 rounded-lg font-display ${names.length === n ? 'bg-white text-black' : 'border border-line hover:bg-cell'}`}
          >
            {n}
          </button>
        ))}
      </div>

      <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
        {names.map((name, i) => (
          <label key={i} className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-white font-display">
              {i === 9 ? 0 : i + 1}
            </span>
            <input
              value={name}
              onChange={(e) => update({ teamNames: names.map((n, j) => (j === i ? e.target.value : n)) })}
              aria-label={`Название команды ${i + 1}`}
              className={`${field} flex-1 font-semibold`}
            />
          </label>
        ))}
      </div>

      <p className="text-sm text-muted">
        Участников с фото, капитанов и случайное распределение можно добавить после создания — на экране «Команды и
        игроки». Его можно открыть и во время игры.
      </p>
    </section>
  )
}
