// Модель данных игры. Описание — в плане проекта, раздел «Модель данных».

export type MediaType = 'image' | 'gif' | 'video' | 'audio'

// Ссылка на файл. Сам файл лежит в отдельной таблице хранилища (MediaFile), в игре — только ссылка.
export type MediaRef = { id: string; type: MediaType; name: string; clip?: Clip }

// Фрагмент музыки или видео, секунды: играть «с 0:45 до 1:05». Пусто — весь файл (функции — clip.ts)
export type Clip = { start?: number; end?: number }

// Сам файл в хранилище браузера
export type MediaFile = { id: string; type: MediaType; name: string; blob: Blob }

// Текст и/или файл: слайд вопроса, ответ, узел дерева
export type Content = {
  text?: string
  media?: MediaRef // первый (или единственный) файл
  more?: MediaRef[] // ещё картинки рядом с первой (только если первая — картинка; всего до 8, функции — pictures.ts)
  layout?: PictureLayout // как расставить несколько картинок; пусто — по их числу
  place?: Placement // своя расстановка (ведущий расставил сам); пусто — слайд раскладывается сам
}

// Рамка объекта на слайде — в процентах от области вопроса в зале (0–100)
export type Box = { x: number; y: number; w: number; h: number }

// Своя расстановка слайда: где текст и где каждая картинка (media[i] — i-й файл из contentMedia)
export type Placement = { text?: Box; media?: Box[] }

// Что расставляем: слайд вопроса, ответ или шаг ветвящегося вопроса (его текст или ответ)
export type PlaceTarget =
  | { kind: 'slide'; index: number }
  | { kind: 'answer' }
  | { kind: 'node'; nodeId: string; answer: boolean }

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
  // Размеры отдельных объектов зала, % (растянули мышью): ячейка cell:<id вопроса>, категория cat:<id>,
  // команда team:<id>, шапка head:title / head:round / head:turn. Нет ключа — 100%
  itemSizes?: Record<string, number>
}

// Размеры на экране зала в процентах (100 — обычный). Ведущий подгоняет их под проектор.
export type HallSizes = {
  board: number // табло: ячейки и надписи
  teams: number // плашки команд: название, счёт, значок
  photos: number // фото игроков
  media: number // картинки и видео вопросов и ответов
  text: number // текст вопроса и ответа
  timer: number // таймер вопроса
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
  special?: Special // особый вопрос: ×2, без минуса, для всех команд (функции — special.ts); пусто — обычный
  cat?: CatSettings // «Кот в мешке» (kind 'cat-in-bag'): своя тема и цена (функции — catAuction.ts); kind не 'normal' — особые настройки не действуют
  hints?: Content[] // подсказки для зала (до трёх, текст и/или картинки; ведущий показывает по кнопке; функции — hints.ts)
  hintCost?: number // сколько баллов меньше за верный ответ после каждой показанной подсказки; пусто — бесплатно
  auction?: 'all' | 'turn' // аукцион (kind 'auction'): торгуются все команды или ставит только та, чей ход; пусто — все
  played: boolean
}

// Особый вопрос: как считать баллы и кто отвечает (пусто — как обычно)
export type Special = {
  correct?: number // множитель за верный ответ: 2 или 3 (пусто — 1)
  wrong?: number // множитель за неверный: 0 — без минуса (пусто — минус стоимость)
  forAll?: boolean // отвечают все команды сразу (на бумажках), ведущий отмечает каждую
}

// «Кот в мешке»: тема, которую объявляют в зале, и цена (пусто — как в ячейке)
export type CatSettings = { theme?: string; value?: number }

export type Category = { id: string; title: string; questions: Question[] }

export type Round = {
  id: string
  title: string
  kind: 'standard' | 'music' | 'final'
  categories: Category[]
  hidden?: boolean // скрытый раунд: на пульте его нет, пока его не откроет правило или ведущий
}

// Правило «ЕСЛИ → ТО». Когда условие выполнилось, пульт предлагает ведущему выполнить действие.
//   when.value: score-reached — сколько баллов, wrong-streak — сколько ошибок подряд, behind — на сколько отстаёт (числа);
//               round-finished — id раунда, category-played — id категории, question-played — id вопроса
//   then.target: open-round — id раунда, unlock-question — id вопроса, show-media — id файла (сам файл — then.media);
//               add-points и give-turn — кому: 'trigger' (команда из условия), 'leader' (лидер), 'last' (отстающая)
//   then.points — сколько баллов дать (add-points; минус — отнять), then.text — надпись в зале (show-text)
export type Rule = {
  id: string
  when: {
    kind: 'score-reached' | 'round-finished' | 'question-played' | 'category-played' | 'wrong-streak' | 'behind'
    value: string | number
  }
  then: {
    kind: 'open-round' | 'unlock-question' | 'add-points' | 'show-media' | 'give-turn' | 'show-text'
    target: string
    media?: MediaRef
    points?: number
    text?: string
  }
}

// Правила партии для баланса (функции — balance.ts):
//   roundStart — кто начинает новый раунд: 'last' — отстающая команда (по умолчанию), 'continue' — ход идёт дальше по кругу;
//   steal — перехват: 'full' — за полную стоимость (по умолчанию), 'half' — за половину (и плюс, и минус)
export type PlayRules = { roundStart?: 'last' | 'continue'; steal?: 'full' | 'half' }

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
  playRules?: PlayRules // правила партии, которые выбрал автор (баланс); пусто — как по умолчанию
  updatedAt?: number // когда игру последний раз меняли (для списка «Мои игры»)
}
