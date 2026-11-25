import { describe, expect, it } from 'vitest'
import { picture } from './testing'
import { emptyRow, gameFromDraft, newDraft, parseTable, rowProblems, type Row } from './wizard'

const cells = (rows: Row[]) => rows.map((r) => [r.category, r.value, r.question, r.answer])

describe('вставка из Excel (parseTable)', () => {
  it('4 столбца с заголовком; пустая категория — как выше; «1 000» → 1000', () => {
    const text = 'Категория\tСтоимость\tВопрос\tОтвет\r\nГеография\t100\tСтолица Франции?\tПариж\r\n\t1 000\tСамый большой океан?\tТихий\r\n'
    expect(cells(parseTable(text))).toEqual([
      ['География', '100', 'Столица Франции?', 'Париж'],
      ['География', '1000', 'Самый большой океан?', 'Тихий'],
    ])
  })
  it('слова «вопрос» и «ответ» внутри вопроса — не заголовок, строка не теряется', () => {
    expect(cells(parseTable('Какой вопрос задал Сфинкс?\tПро ноги\nВопрос\tОтвет'))).toEqual([
      ['', '100', 'Какой вопрос задал Сфинкс?', 'Про ноги'],
      ['', '200', 'Вопрос', 'Ответ'],
    ])
    expect(parseTable('Вопрос:\tОтвет:\nВ1\tО1')).toHaveLength(1) // а «Вопрос: / Ответ:» — заголовок
  })
  it('2 столбца (вопрос, ответ) — стоимость по порядку: 100, 200…', () => {
    expect(cells(parseTable('Вопрос 1\tОтвет 1\nВопрос 2\tОтвет 2'))).toEqual([
      ['', '100', 'Вопрос 1', 'Ответ 1'],
      ['', '200', 'Вопрос 2', 'Ответ 2'],
    ])
  })
  it('3 столбца без чисел — категория, вопрос, ответ; стоимость по порядку в каждой категории', () => {
    expect(cells(parseTable('Кино\tВ1\tО1\nКино\tВ2\tО2\nСпорт\tВ3\tО3'))).toEqual([
      ['Кино', '100', 'В1', 'О1'],
      ['Кино', '200', 'В2', 'О2'],
      ['Спорт', '100', 'В3', 'О3'],
    ])
  })
  it('3 столбца с числами во втором — категория, стоимость, вопрос', () => {
    expect(cells(parseTable('Кино\t300\tВ1\nКино\t500\tВ2'))).toEqual([
      ['Кино', '300', 'В1', ''],
      ['Кино', '500', 'В2', ''],
    ])
  })
  it('кавычки вокруг ячейки и пустые строки убираются; пустой текст — пустая таблица', () => {
    expect(cells(parseTable('\n"Кино"\t100\t"Вопрос"\t"Ответ"\n\n'))).toEqual([['Кино', '100', 'Вопрос', 'Ответ']])
    expect(parseTable('  \n ')).toEqual([])
  })
})

describe('недочёты таблицы (rowProblems)', () => {
  const row = (extra: Partial<Row>): Row => ({ ...emptyRow('Кино', '100'), question: 'В', answer: 'О', ...extra })

  it('нет ответа, нет вопроса, плохая стоимость', () => {
    const rows = [row({ answer: '' }), row({ question: '' }), row({ value: '-5' }), row({ value: '1.5' }), row({})]
    expect(rows.map((r) => rowProblems(rows).get(r.id) ?? null)).toEqual(['no-answer', 'no-question', 'bad-value', 'bad-value', null])
  })
  it('файл вместо текста вопроса — тоже вопрос', () => {
    const r = row({ question: '', media: picture() })
    expect(rowProblems([r]).size).toBe(0)
  })
  it('одиннадцатый вопрос в категории — лишний; пустые строки не считаются', () => {
    const rows = [...Array.from({ length: 11 }, () => row({})), emptyRow('Кино', '')]
    const problems = rowProblems(rows)
    expect(problems.size).toBe(1)
    expect(problems.get(rows[10].id)).toBe('too-many')
  })
})

describe('игра из черновика (gameFromDraft)', () => {
  it('категории по порядку, не больше 10 вопросов, пустые строки пропускаются', () => {
    const draft = newDraft()
    draft.rows = [
      { ...emptyRow('Кино', '200'), question: 'В1', answer: 'О1' },
      { ...emptyRow('Спорт', 'abc'), question: 'В2', answer: 'О2' },
      emptyRow('Кино', '300'),
      ...Array.from({ length: 11 }, (_, i) => ({ ...emptyRow('Музыка', String((i + 1) * 100)), question: `М${i}`, answer: 'О' })),
    ]
    const g = gameFromDraft(draft)
    const categories = g.rounds[0].categories
    expect(categories.map((c) => c.title)).toEqual(['Кино', 'Спорт', 'Музыка'])
    expect(categories.map((c) => c.questions.length)).toEqual([1, 1, 10])
    expect(categories[1].questions[0].value).toBe(100) // «abc» — стоимость по порядку
  })
  it('текст вопроса — первый слайд, файл — второй', () => {
    const draft = newDraft()
    const [a, b] = [picture('а.jpg'), picture('б.jpg')]
    draft.rows = [{ ...emptyRow('Кино', '100'), question: 'Кто на фото?', answer: 'Актёр', media: a, more: [b] }]
    const question = gameFromDraft(draft).rounds[0].categories[0].questions[0]
    expect(question.slides).toEqual([{ text: 'Кто на фото?' }, { media: a, more: [b] }])
    expect(question.answer).toEqual({ text: 'Актёр' })
  })
  it('без названия и команд — «Новая игра» и одна команда', () => {
    const draft = { ...newDraft(), title: '  ', teamNames: ['', ' '] }
    const g = gameFromDraft(draft)
    expect(g.title).toBe('Новая игра')
    expect(g.teams.map((t) => t.name)).toEqual(['Команда 1'])
  })
})
