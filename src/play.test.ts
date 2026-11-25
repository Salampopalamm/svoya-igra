import { describe, expect, it } from 'vitest'
import type { LiveState } from './live'
import {
  answerCorrect,
  answerWrong,
  chooseBranch,
  finalMark,
  finalRemoveTheme,
  finalReveal,
  finalSetBet,
  finalShowQuestion,
  freshState,
  goToSlide,
  openCell,
  runRule,
  selectAnswering,
  setTurn,
  showAnswer,
  skipRule,
  switchRound,
  toggleTimer,
  unlockRound,
  viewPlayedCell,
  withClosed,
} from './play'
import { cat, game, q, round, step, team, tree } from './testing'
import type { Question, Rule } from './types'

// Партия: один раунд «География» (100, 200, 300), три команды по нулям
function setup(questions: Question[] = [q(100), q(200), q(300)], teams = [team('Совы'), team('Лисы'), team('Ежи')]) {
  const category = cat('География', questions)
  const s = freshState(game([round([category])], teams))
  const cell = (i: number) => ({ categoryId: category.id, questionId: category.questions[i].id })
  const [a, b, c] = s.game.teams.map((t) => t.id)
  return { s, cell, a, b, c }
}
const scores = (s: LiveState) => s.game.teams.map((t) => t.score)
const played = (s: LiveState) => s.game.rounds[0].categories[0].questions.map((x) => x.played)

describe('открыть вопрос', () => {
  it('отвечает команда, чей ход; первый слайд, ответ скрыт', () => {
    const { s, cell, a } = setup()
    const open = openCell(s, cell(1))
    expect(open).toMatchObject({ current: cell(1), answeringTeamId: a, slideIndex: 0, showAnswer: false, viewOnly: false })
  })
  it('таймер: закреплённое время важнее времени вопроса', () => {
    const { s, cell } = setup([q(100, { timerSec: 20 })])
    expect(openCell(s, cell(0)).timer?.totalSec).toBe(20)
    const pinned = { ...s, game: { ...s.game, theme: { ...s.game.theme, pinnedTimerSec: 45 } } }
    expect(openCell(pinned, cell(0)).timer?.totalSec).toBe(45)
  })
})

describe('«Верно» и «Неверно»', () => {
  it('верно: плюс стоимость, ячейка сыграна, ход — следующей команде', () => {
    const { s, cell, a, b } = setup()
    const after = answerCorrect(openCell(s, cell(1)), a)
    expect(scores(after)).toEqual([200, 0, 0])
    expect(played(after)).toEqual([false, true, false])
    expect(after).toMatchObject({ current: null, answeringTeamId: null, turnTeamId: b })
  })
  it('неверно: минус стоимость, вопрос открыт, ошибившийся больше не отвечает', () => {
    const { s, cell, a } = setup()
    const after = answerWrong(openCell(s, cell(2)), a)
    expect(scores(after)).toEqual([-300, 0, 0])
    expect(after).toMatchObject({ current: cell(2), answeringTeamId: null, triedTeamIds: [a] })
    expect(answerWrong(after, a)).toBe(after) // второй раз — ничего
    expect(answerCorrect(after, a)).toBe(after)
    expect(selectAnswering(after, a)).toBe(after)
  })
  it('перехват: другая команда отвечает верно — она получает баллы, ход всё равно идёт по кругу от того, чей был ход', () => {
    const { s, cell, a, b, c } = setup()
    let st = answerWrong(openCell(s, cell(0)), a) // Совы ошиблись
    st = selectAnswering(st, c) // перехватывают Ежи
    st = answerCorrect(st, c)
    expect(scores(st)).toEqual([-100, 0, 100])
    expect(st.turnTeamId).toBe(b)
  })
  it('неверный перехват — тоже минус', () => {
    const { s, cell, a, b } = setup()
    const st = answerWrong(answerWrong(openCell(s, cell(0)), a), b)
    expect(scores(st)).toEqual([-100, -100, 0])
    expect(st.triedTeamIds).toEqual([a, b])
  })
  it('никто не ответил — закрыть: счёт тот же, ячейка сыграна, ход дальше', () => {
    const { s, cell, b } = setup()
    const st = withClosed(openCell(s, cell(0)))
    expect(scores(st)).toEqual([0, 0, 0])
    expect(played(st)).toEqual([true, false, false])
    expect(st.turnTeamId).toBe(b)
  })
  it('после последней команды ход возвращается к первой', () => {
    const { s, cell, a, c } = setup()
    const st = withClosed(openCell(setTurn(s, c), cell(0)))
    expect(st.turnTeamId).toBe(a)
  })
  it('без открытого вопроса «Верно» ничего не делает', () => {
    const { s, a } = setup()
    expect(answerCorrect(s, a)).toBe(s)
  })
})

describe('сыгранная ячейка — только посмотреть', () => {
  it('без «Верно / Неверно», при закрытии счёт и ход не меняются', () => {
    const { s, cell, a } = setup()
    const view = viewPlayedCell(answerCorrect(openCell(s, cell(0)), a), cell(0))
    expect(view).toMatchObject({ viewOnly: true, answeringTeamId: null })
    expect(answerCorrect(view, a)).toBe(view)
    expect(selectAnswering(view, a)).toBe(view)
    const closed = withClosed(view)
    expect(closed.turnTeamId).toBe(view.turnTeamId)
    expect(scores(closed)).toEqual([100, 0, 0])
  })
})

describe('ветвящийся вопрос', () => {
  // Шаг 1: А (+100 → шаг 2) / Б (0, конец). Шаг 2: Верно (+50) / Неверно (−50)
  function branchSetup(scoring: 'per-step' | 'at-end', unlockQuestionId?: string) {
    const end = step('Конец')
    const second = step('Второй', [{ label: 'В', points: 50, nextNodeId: end.id }, { label: 'Н', points: -50 }])
    const first = step('Первый', [{ label: 'А', points: 100, nextNodeId: second.id, unlockQuestionId }, { label: 'Б', points: 0 }])
    return tree([first, second, end], { scoring })
  }

  it('баллы за каждый шаг сразу', () => {
    const { s, cell } = setup([q(300, { tree: branchSetup('per-step') })])
    let st = chooseBranch(openCell(s, cell(0)), 0)
    expect(scores(st)).toEqual([100, 0, 0])
    st = chooseBranch(st, 0)
    expect(scores(st)).toEqual([150, 0, 0])
    expect(st.branch?.done).toBe(true)
    expect(chooseBranch(st, 0)).toBe(st) // ветка закончилась
  })
  it('баллы одной суммой в конце ветки', () => {
    const { s, cell } = setup([q(300, { tree: branchSetup('at-end') })])
    let st = chooseBranch(openCell(s, cell(0)), 0)
    expect(scores(st)).toEqual([0, 0, 0])
    st = chooseBranch(st, 1)
    expect(scores(st)).toEqual([50, 0, 0]) // 100 − 50
  })
  it('вариант открывает скрытый вопрос', () => {
    const hidden = q(500, { hidden: true })
    const { s, cell } = setup([q(300, { tree: branchSetup('per-step', hidden.id) }), hidden])
    expect(chooseBranch(openCell(s, cell(0)), 0).unlockedIds).toEqual([hidden.id])
  })
  it('у ветвящегося вопроса нет обычных «Верно / Неверно»; без отвечающей команды вариант не выбрать', () => {
    const { s, cell, a } = setup([q(300, { tree: branchSetup('per-step') })])
    const open = openCell(s, cell(0))
    expect(answerCorrect(open, a)).toBe(open)
    const nobody = selectAnswering(open, null)
    expect(chooseBranch(nobody, 0)).toBe(nobody)
  })
})

describe('слайды, ответ, таймер', () => {
  it('слайды листаются в пределах вопроса', () => {
    const { s, cell } = setup([q(100, { slides: [{ text: '1' }, { text: '2' }] })])
    const open = openCell(s, cell(0))
    expect(goToSlide(open, -1)).toBe(open)
    expect(goToSlide(open, 1).slideIndex).toBe(1)
    expect(goToSlide(goToSlide(open, 1), 5).slideIndex).toBe(1)
  })
  it('показали ответ — таймер встаёт на паузу', () => {
    const { s, cell } = setup([q(100, { timerSec: 30 })])
    const running = toggleTimer(openCell(s, cell(0)), 0)
    expect(running.timer?.endsAt).toBe(30_000)
    const answered = showAnswer(running)
    expect(answered.showAnswer).toBe(true)
    expect(answered.timer?.endsAt).toBeNull()
  })
  it('у вопроса без таймера T запускает стандартные 30 секунд; на табло — ничего', () => {
    const { s, cell } = setup()
    expect(toggleTimer(openCell(s, cell(0)), 0).timer?.totalSec).toBe(30)
    expect(toggleTimer(s, 0)).toBe(s)
  })
})

describe('раунды и правила', () => {
  const rule = (then: Rule['then']): Rule => ({ id: 'r1', when: { kind: 'score-reached', value: 100 }, then })

  it('в скрытый раунд не переключиться, пока его не открыли; посреди вопроса — тоже нельзя', () => {
    const first = round([cat('А', [q(100)])])
    const bonus = round([cat('Б', [q(100)])], { hidden: true })
    const s = freshState(game([first, bonus]))
    expect(switchRound(s, bonus.id)).toBe(s)
    const opened = unlockRound(s, bonus.id)
    expect(switchRound(opened, bonus.id).roundId).toBe(bonus.id)
    const inQuestion = openCell(opened, { categoryId: first.categories[0].id, questionId: first.categories[0].questions[0].id })
    expect(switchRound(inQuestion, bonus.id)).toBe(inQuestion)
  })
  it('правило: выполнить открывает цель, пропустить — нет; оба больше не предлагаются', () => {
    const { s } = setup()
    const done = runRule(s, rule({ kind: 'open-round', target: 'бонус' }))
    expect(done.unlockedRoundIds).toEqual(['бонус'])
    expect(done.rulesDone).toEqual(['r1'])
    const skipped = skipRule(s, rule({ kind: 'open-round', target: 'бонус' }))
    expect(skipped.unlockedRoundIds ?? []).toEqual([])
    expect(skipped.rulesDone).toEqual(['r1'])
  })
})

describe('финал целиком', () => {
  it('темы → ставки → вопрос → итоги', () => {
    const finalRound = round([cat('Кино', [q(100)]), cat('Спорт', [q(100)])], { kind: 'final' })
    const teams = [team('Совы', 500), team('Лисы', 200), team('Ежи', -100)]
    let s = freshState(game([finalRound], teams))
    const [a, b, c] = s.game.teams.map((t) => t.id)

    s = finalRemoveTheme(s, finalRound.categories[0].id) // убрали «Кино» — осталась одна тема
    expect(s.final?.phase).toBe('bets')

    s = finalSetBet(s, a, 300)
    expect(finalShowQuestion(s)).toBe(s) // Лисы ещё не поставили
    s = finalSetBet(finalSetBet(s, b, 200), c, 50) // Ежи с минусом не играют — их ставку уберём
    s = finalShowQuestion(s)
    expect(s.final?.phase).toBe('question')
    expect(s.current?.categoryId).toBe(finalRound.categories[1].id)
    expect(s.final?.bets).toEqual({ [a]: 300, [b]: 200 })
    expect(s.timer?.totalSec).toBe(60)

    s = finalReveal(finalMark(finalMark(s, a, true), b, false))
    expect(s.final?.phase).toBe('results')
    expect(scores(s)).toEqual([800, 0, -100])
    expect(s.current).toBeNull()
  })
})
