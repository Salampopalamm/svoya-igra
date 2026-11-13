// Модель данных игры. Описание — в плане проекта, раздел «Модель данных».

export type MediaType = 'image' | 'gif' | 'video' | 'audio'

// Ссылка на файл. Сам файл лежит в отдельной таблице хранилища (MediaFile), в игре — только ссылка.
export type MediaRef = { id: string; type: MediaType; name: string }

// Сам файл в хранилище браузера
export type MediaFile = { id: string; type: MediaType; name: string; blob: Blob }

// Текст и/или файл: слайд вопроса, ответ, узел дерева
export type Content = { text?: string; media?: MediaRef }

export type Theme = {
  logo?: MediaRef
  background?: MediaRef
  accentColor?: string // пусто = строгий ч/б
  backgroundTone: 'graphite' | 'asphalt' | 'warm-gray' | 'mid-gray' | 'light'
  headingFont: string // один из 8 шрифтов, по умолчанию 'Rubik Mono One'
  teamView: 'photos' | 'compact'
  showPhotos: boolean // false = фото свёрнуты, только имена
  grayscaleMedia: boolean
  sounds: { correct?: MediaRef; wrong?: MediaRef; enabled: boolean }
}

export type Player = {
  id: string
  name: string
  photo?: MediaRef
  teamId?: string
  locked?: boolean // закреплён, случайное распределение его не трогает
}

export type Team = {
  id: string
  name: string
  score: number
  targetSize?: number // желаемый размер; пусто = примерно поровну
}

export type TreeNode = {
  id: string
  kind: 'question' | 'scene' | 'end'
  content: Content
  answer?: Content
  options: {
    label: string
    points: number
    nextNodeId?: string // следующий шаг ветки
    unlockQuestionId?: string // открыть скрытую ячейку на табло
  }[]
}

export type QuestionTree = {
  startNodeId: string
  branchBy: 'choice' | 'correctness' // по умолчанию 'choice'
  scoring: 'per-step' | 'at-end'
  nodes: TreeNode[]
}

export type Question = {
  id: string
  value: number
  kind: 'normal' | 'cat-in-bag' | 'auction'
  // Вопрос показывается слайдами по порядку, ведущий листает их стрелками.
  // Обычно первый — текст вопроса или описание задания, следующие — суть: картинка, музыка, видео.
  // Всегда хотя бы один слайд.
  slides: Content[]
  answer: Content
  timerSec?: number
  hostNote?: string
  hidden?: boolean // скрыт, пока дерево или правило его не откроет
  tree?: QuestionTree
  played: boolean
}

export type Category = { id: string; title: string; questions: Question[] }

export type Round = {
  id: string
  title: string
  kind: 'standard' | 'music' | 'final'
  categories: Category[]
}

export type Rule = {
  id: string
  when: { kind: 'score-reached' | 'round-finished' | 'question-played'; value: string | number }
  then: { kind: 'open-round' | 'unlock-question' | 'add-points' | 'show-media'; target: string }
}

export type Game = {
  id: string
  title: string
  client: string
  date?: string
  theme: Theme
  players: Player[]
  teams: Team[] // 1–10 команд, разного размера
  rounds: Round[]
  rules: Rule[]
  updatedAt?: number // когда игру последний раз меняли (для списка «Мои игры»)
}
