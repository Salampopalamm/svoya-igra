import { describe, expect, it } from 'vitest'
import { logToCsv, teamStats, wrongStreak, type LogEntry } from './log'
import { adjustScore, answerCorrect, answerWrong, chooseBranch, closeQuestion, finalMark, finalReveal, finalSetBet, finalShowQuestion, freshState, openCell, selectAnswering, setScore, viewPlayedCell } from './play'
import { cat, game, q, round, step, team, tree } from './testing'

function setup() {
  const category = cat('География', [q(100), q(200), q(300)])
  const s = freshState(game([round([category])], [team('Совы'), team('Лисы')]))
  const cell = (i: number) => ({ categoryId: category.id, questionId: category.questions[i].id })
  const [a, b] = s.game.teams.map((t) => t.id)
  return { s, cell, a, b }
}
const brief = (log: LogEntry[] = []) => log.map(({ kind, teamId, points, where }) => ({ kind, teamId, points, where }))

describe('журнал партии', () => {
  it('верно, неверно, перехват — каждая запись с командой, вопросом и баллами', () => {
    const { s, cell, a, b } = setup()
    let st = answerWrong(openCell(s, cell(1)), a)
    st = answerCorrect(selectAnswering(st, b), b)
    expect(brief(st.log)).toEqual([
      { kind: 'wrong', teamId: a, points: -200, where: 'География · 200' },
      { kind: 'correct', teamId: b, points: 200, where: 'География · 200' },
    ])
  })
  it('закрыли вопрос без верного ответа — «никто не ответил»; «только посмотреть» в журнал не пишется', () => {
    const { s, cell, a } = setup()
    const st = closeQuestion(openCell(s, cell(0)))
    expect(brief(st.log)).toEqual([{ kind: 'nobody', teamId: undefined, points: 0, where: 'География · 100' }])
    const viewed = closeQuestion(viewPlayedCell(answerCorrect(openCell(s, cell(1)), a), cell(1)))
    expect(viewed.log?.map((e) => e.kind)).toEqual(['correct'])
  })
  it('поправки ведущего: ± и «вписан счёт»; без изменения — ничего', () => {
    const { s, a } = setup()
    const st = setScore(adjustScore(s, a, 50), a, 500)
    expect(st.log?.map((e) => [e.kind, e.points, e.note])).toEqual([
      ['manual', 50, undefined],
      ['manual', 450, 'вписан счёт 500'],
    ])
    expect(adjustScore(s, a, 0)).toBe(s)
    expect(setScore(st, a, 500)).toBe(st)
  })
  it('ветка: вариант и баллы', () => {
    const first = step('Первый', [{ label: 'А', points: 100 }, { label: 'Б', points: 0 }])
    const category = cat('Ветки', [q(300, { tree: tree([first]) })])
    const s = freshState(game([round([category])], [team('Совы')]))
    const st = chooseBranch(openCell(s, { categoryId: category.id, questionId: category.questions[0].id }), 0)
    expect(st.log?.map((e) => [e.kind, e.points, e.note])).toEqual([['branch', 100, 'А']])
    expect(closeQuestion(st).log).toHaveLength(1) // ветвящийся вопрос «никто не ответил» не пишет
  })
  it('финал: по записи на каждую ставку', () => {
    const finalRound = round([cat('Кино', [q(100)])], { kind: 'final' })
    let s = freshState(game([finalRound], [team('Совы', 500), team('Лисы', 200)]))
    const [a, b] = s.game.teams.map((t) => t.id)
    s = finalShowQuestion(finalSetBet(finalSetBet(s, a, 300), b, 100))
    s = finalReveal(finalMark(finalMark(s, a, true), b, false))
    expect(s.log?.map((e) => [e.teamId, e.points, e.where])).toEqual([
      [a, 300, 'Финал · Кино'],
      [b, -100, 'Финал · Кино'],
    ])
  })
  it('итоги команд: верно, неверно, лучшая серия, поправки', () => {
    const { s, cell, a, b } = setup()
    let st = answerCorrect(openCell(s, cell(0)), a)
    st = answerCorrect(openCell(st, cell(1)), b)
    st = answerCorrect(selectAnswering(openCell(st, cell(2)), a), a)
    st = adjustScore(st, b, -50)
    const [sa, sb] = teamStats(st.game, st.log)
    expect(sa).toMatchObject({ correct: 2, wrong: 0, bestStreak: 2, fromQuestions: 400, manual: 0 })
    expect(sb).toMatchObject({ correct: 1, wrong: 0, fromQuestions: 200, manual: -50 })
  })
  it('ошибки подряд: верный ответ обнуляет', () => {
    const e = (kind: LogEntry['kind'], teamId: string): LogEntry => ({ at: 0, kind, teamId, points: 0 })
    const log = [e('wrong', 'a'), e('correct', 'a'), e('wrong', 'a'), e('correct', 'b'), e('wrong', 'a')]
    expect(wrongStreak(log, 'a')).toBe(2)
    expect(wrongStreak(log, 'b')).toBe(0)
  })
  it('для Excel: точка с запятой, кавычки там, где нужно, итоги внизу', () => {
    const { s, cell, a } = setup()
    const named = { ...s, game: { ...s.game, teams: s.game.teams.map((t) => (t.id === a ? { ...t, name: 'Совы; и Ко' } : t)) } }
    const csv = logToCsv(answerCorrect(openCell(named, cell(0)), a).game, answerCorrect(openCell(named, cell(0)), a).log)
    expect(csv.startsWith('﻿Время;Команда;Что;Вопрос;Баллы;Подробности')).toBe(true)
    expect(csv).toContain('"Совы; и Ко";Верно;География · 100;100;')
    expect(csv).toContain('Итог;Команда;Верно;Неверно;Счёт;Поправки ведущего')
  })
})
