import { Component, type ReactNode } from 'react'

// Страховка от белого экрана: если внутри что-то сломалось (ошибка в программе, повреждённая игра),
// вместо пустой страницы показываем fallback — понятный текст и кнопки.
//   fallback(error, retry) — что показать; retry() — попробовать показать содержимое снова
//   resetKey — сменился (например, пульт прислал новое состояние) — пробуем снова сами
type Props = {
  children: ReactNode
  fallback: (error: Error, retry: () => void) => ReactNode
  resetKey?: unknown
}

type State = { error: Error | null; key: unknown }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, key: this.props.resetKey }

  static getDerivedStateFromError(error: unknown): Partial<State> {
    return { error: error instanceof Error ? error : new Error(String(error)) }
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    // Новое состояние — новая попытка
    if (props.resetKey !== state.key) return { key: props.resetKey, error: null }
    return null
  }

  componentDidCatch(error: unknown) {
    console.error('Ошибка на экране:', error)
  }

  retry = () => this.setState({ error: null })

  render() {
    if (this.state.error) return this.props.fallback(this.state.error, this.retry)
    return this.props.children
  }
}

// Общий вид «что-то пошло не так» для пульта, редактора и других экранов ведущего
export function ErrorScreen({ error, children }: { error: Error; children?: ReactNode }) {
  return (
    <div role="alert" className="flex min-h-screen flex-col items-center justify-center gap-6 bg-bg p-8 text-center text-white">
      <h1 className="font-display text-2xl">ЧТО-ТО ПОШЛО НЕ ТАК</h1>
      <p className="max-w-xl text-muted">
        Игра и счёт сохранены. Попробуйте кнопки ниже. Если не помогло — сохраните игру файлом («Мои игры» → «Отправить
        файлом») и сообщите о проблеме.
      </p>
      <div className="flex flex-wrap justify-center gap-3">{children}</div>
      <details className="max-w-xl text-left text-sm text-muted">
        <summary className="cursor-pointer">Подробности для разработчика</summary>
        <pre className="mt-2 whitespace-pre-wrap break-words">{error.message}</pre>
      </details>
    </div>
  )
}
