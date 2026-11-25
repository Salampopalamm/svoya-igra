// Заготовки для автопроверок (*.test.ts): маленькие игры, собранные в одну строку.
// В сайт этот файл не попадает — его используют только проверки.
import type { Category, Content, Game, MediaRef, Question, QuestionTree, Round, Team, TreeNode } from './types'

let counter = 0
const id = (prefix: string) => `${prefix}${++counter}`

// Заполненный вопрос: текст и ответ
export function q(value: number, extra: Partial<Question> = {}): Question {
  return {
    id: id('q'),
    value,
    kind: 'normal',
    slides: [{ text: `Вопрос за ${value}` }],
    answer: { text: `Ответ ${value}` },
    played: false,
    ...extra,
  }
}

// Пустая ячейка
export function emptyQ(value: number, extra: Partial<Question> = {}): Question {
  return q(value, { slides: [{}], answer: {}, ...extra })
}

export function cat(title: string, questions: Question[]): Category {
  return { id: id('c'), title, questions }
}

export function round(categories: Category[], extra: Partial<Round> = {}): Round {
  return { id: id('r'), title: 'Раунд', kind: 'standard', categories, ...extra }
}

export function team(name: string, score = 0, extra: Partial<Team> = {}): Team {
  return { id: id('t'), name, score, ...extra }
}

export function game(rounds: Round[], teams: Team[] = [team('А'), team('Б'), team('В')], extra: Partial<Game> = {}): Game {
  return {
    id: id('g'),
    title: 'Проверочная игра',
    client: '',
    theme: {
      backgroundTone: 'graphite',
      headingFont: 'Rubik Mono One',
      teamView: 'photos',
      showPhotos: true,
      grayscaleMedia: false,
      sounds: { enabled: true },
    },
    players: [],
    teams,
    rounds,
    rules: [],
    ...extra,
  }
}

export function picture(name = 'фото.jpg'): MediaRef {
  return { id: id('m'), type: 'image', name }
}

export function step(text: string, options: TreeNode['options'] = [], extra: Partial<TreeNode> = {}): TreeNode {
  const content: Content = text ? { text } : {}
  return { id: id('n'), kind: options.length ? 'question' : 'end', content, options, ...extra }
}

export function tree(nodes: TreeNode[], extra: Partial<QuestionTree> = {}): QuestionTree {
  return { startNodeId: nodes[0].id, branchBy: 'choice', scoring: 'per-step', nodes, ...extra }
}
