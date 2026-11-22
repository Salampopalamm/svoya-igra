// Модель данных игры. Описание — в плане проекта, раздел «Модель данных».

export type MediaType = 'image' | 'gif' | 'video' | 'audio'

// Ссылка на файл. Сам файл лежит в отдельной таблице хранилища (MediaFile), в игре — только ссылка.
export type MediaRef = { id: string; type: MediaType; name: string }

// Сам файл в хранилище браузера
export type MediaFile = { id: string; type: MediaType; name: string; blob: Blob }

// Текст и/или файл: слайд вопроса, ответ, узел дерева
export type Content = {
  text?: string
  media?: MediaRef // первый (или единственный) файл
  more?: MediaRef[] // ещё картинки рядом с первой (только если первая — картинка; всего до 8, функции — pictures.ts)
  layout?: PictureLayout // как расставить несколько картинок; пусто — по их числу
}

// Шаблон для нескольких картинок: по 1–4 в ряд или одна большая слева и остальные справа
export type PictureLayout = 'cols-1' | 'cols-2' | 'cols-3' | 'cols-4' | 'big-left'

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
  // Время таймера, закреплённое ведущим на пульте (📌): ставится на каждый вопрос,
  // даже если в редакторе у вопроса своё время. Пусто — у каждого вопроса своё.
  pinnedTimerSec?: number
  sizes?: HallSizes // свои размеры на экране зала; пусто — все по 100%
}

// Размеры на экране зала в процентах (100 — обычный). Ведущий подгоняет их под проектор.
export type HallSizes = {
  board: number // табло: ячейки и надписи
  teams: number // плашки команд: название, счёт, значок
  photos: number // фото игроков
  media: number // картинки и видео вопросов и ответов
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
  emoji?: string // значок команды из набора эмодзи
  logo?: MediaRef // своя картинка-значок; если есть, показывается вместо эмодзи
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
  hidden?: boolean // скрытый раунд: на пульте его нет, пока его не откроет правило или ведущий
}

// Правило «ЕСЛИ → ТО». Когда условие выполнилось, пульт предлагает ведущему выполнить действие.
//   when.value: score-reached — сколько баллов (число), round-finished — id раунда, question-played — id вопроса
//   then.target: open-round — id раунда, unlock-question — id вопроса, show-media — id файла (сам файл — then.media)
export type Rule = {
  id: string
  when: { kind: 'score-reached' | 'round-finished' | 'question-played'; value: string | number }
  then: { kind: 'open-round' | 'unlock-question' | 'add-points' | 'show-media'; target: string; media?: MediaRef }
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
