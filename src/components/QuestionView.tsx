import type { Content, Question, Team } from '../types'
import { MediaView, SlideView } from './MediaView'

type Props = {
  categoryTitle: string
  question: Question
  showAnswer: boolean // показан ли ответ в зале
  teams: Team[]
  answeringTeamId: string | null
  turnTeamId: string | null // чей ход — эта команда отвечала первой
  triedTeamIds: string[] // кто уже ошибся на этом вопросе
  nextTurnTeamName?: string // к кому перейдёт ход, когда вопрос закроется
  onSelectTeam: (teamId: string | null) => void
  onShowAnswer: () => void
  onCorrect: (teamId: string) => void
  onWrong: (teamId: string) => void
  onClose: () => void
  slideIndex: number // какой слайд сейчас в зале
  onPrevSlide: () => void
  onNextSlide: () => void
}

// Короткая подсказка ведущему, что покажет следующий слайд
function describeSlide(slide: Content) {
  const kinds = { image: 'картинка', gif: 'GIF', video: 'видео', audio: 'музыка' }
  const parts = [slide.media && `${kinds[slide.media.type]} «${slide.media.name}»`, slide.text && `«${slide.text}»`]
  return parts.filter(Boolean).join(' + ')
}

// Открытый вопрос на пульте: ведущий всегда видит ответ, в зал он уходит по кнопке.
export default function QuestionView({
  categoryTitle,
  question,
  showAnswer,
  teams,
  answeringTeamId,
  turnTeamId,
  triedTeamIds,
  nextTurnTeamName,
  onSelectTeam,
  onShowAnswer,
  onCorrect,
  onWrong,
  onClose,
  slideIndex,
  onPrevSlide,
  onNextSlide,
}: Props) {
  const count = question.slides.length
  const slide = question.slides[slideIndex] ?? question.slides[0] ?? {}
  const next = question.slides[slideIndex + 1]

  // Ход ответа: сначала отвечает команда, чей ход; ошиблась — вопрос может перехватить любая другая
  const stealing = triedTeamIds.length > 0
  const answeringTeam = teams.find((t) => t.id === answeringTeamId)
  const allTried = teams.length > 0 && teams.every((t) => triedTeamIds.includes(t.id))
  const triedNames = teams.filter((t) => triedTeamIds.includes(t.id)).map((t) => `«${t.name}»`)
  const status = allTried
    ? 'Все команды ошиблись — покажите ответ и закройте вопрос'
    : answeringTeam
      ? `${stealing ? 'Перехват' : 'Отвечает'}: «${answeringTeam.name}»`
      : stealing
        ? `${triedNames.join(', ')} ${triedNames.length > 1 ? 'ошиблись' : 'ошиблась'}. Кто перехватывает? Нажмите команду или её номер`
        : 'Кто отвечает? Нажмите команду или её номер'

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <span className="font-display text-2xl">
          {categoryTitle.toUpperCase()} · <span className="rounded-lg bg-white px-4 py-1 text-black">{question.value}</span>
        </span>
        <span className="text-sm text-muted">в зале сейчас этот вопрос</span>
      </div>

      <SlideView slide={slide} mode="host" textClass="text-4xl" mediaClass="max-h-[40vh] self-start" />

      {count > 1 && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onPrevSlide}
            disabled={slideIndex === 0}
            className="h-11 rounded-lg border border-line px-4 hover:bg-cell disabled:opacity-40"
          >
            ← Назад
          </button>
          <span className="text-muted">
            Слайд {slideIndex + 1} из {count}
          </span>
          <button
            type="button"
            onClick={onNextSlide}
            disabled={slideIndex === count - 1}
            className="h-11 rounded-lg border border-white px-4 font-semibold hover:bg-white hover:text-black disabled:opacity-40"
          >
            Дальше →
          </button>
          {next && <span className="text-sm text-muted">Дальше в зале: {describeSlide(next)}</span>}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4 rounded-xl border-2 border-dashed border-muted p-5">
        <div className="flex-1">
          <div className="text-sm font-semibold tracking-widest text-muted">ОТВЕТ · ВИДИТ ТОЛЬКО ВЕДУЩИЙ</div>
          <div className="mt-1 text-3xl font-semibold">{question.answer.text}</div>
          {question.answer.media && <MediaView media={question.answer.media} mode="host" className="mt-3 max-h-48" />}
        </div>
        {showAnswer ? (
          <span className="text-muted">Ответ показан в зале</span>
        ) : (
          <button
            type="button"
            onClick={onShowAnswer}
            className="h-11 rounded-lg border border-white px-5 hover:bg-white hover:text-black"
          >
            Показать ответ в зале · Пробел
          </button>
        )}
      </div>

      <div className="mt-auto flex flex-col gap-3">
        <div className="text-xl font-semibold" aria-live="polite">
          {status}
        </div>

        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(teams.length, 5)}, 1fr)` }}>
          {teams.map((team, i) => {
            const answering = team.id === answeringTeamId
            const tried = triedTeamIds.includes(team.id)
            const label = answering ? (stealing ? 'ПЕРЕХВАТ' : 'ОТВЕЧАЕТ') : team.id === turnTeamId ? 'ХОД' : null
            return (
              <div
                key={team.id}
                className={`flex flex-col gap-2 rounded-xl p-4 ${answering ? 'border-2 border-white bg-cell' : 'border border-line'} ${tried ? 'opacity-40' : ''}`}
              >
                {/* Нажатие на команду — она отвечает (если ведущий ошибся с выбором, можно поменять) */}
                <button
                  type="button"
                  onClick={() => onSelectTeam(answering ? null : team.id)}
                  disabled={tried}
                  aria-pressed={answering}
                  className="flex min-h-11 items-center gap-2 text-left font-semibold"
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm ${answering ? 'bg-white text-black' : 'border border-line'}`}
                  >
                    {i === 9 ? 0 : i + 1}
                  </span>
                  {team.name}
                  {label && (
                    <span
                      className={`ml-auto rounded px-2 py-0.5 text-xs ${answering ? 'bg-white text-black' : 'border border-line text-muted'}`}
                    >
                      {label}
                    </span>
                  )}
                </button>

                {tried ? (
                  <div className="flex h-11 items-center text-muted">Ошиблись −{question.value}</div>
                ) : answering ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => onCorrect(team.id)}
                      className="h-11 flex-1 rounded-lg bg-white font-semibold text-black hover:opacity-90"
                    >
                      Верно +{question.value}
                    </button>
                    <button
                      type="button"
                      onClick={() => onWrong(team.id)}
                      className="h-11 flex-1 rounded-lg border border-white hover:bg-cell"
                    >
                      Неверно −{question.value}
                    </button>
                  </div>
                ) : stealing && !answeringTeam ? (
                  <button
                    type="button"
                    onClick={() => onSelectTeam(team.id)}
                    className="h-11 rounded-lg border border-white font-semibold hover:bg-white hover:text-black"
                  >
                    Перехватить
                  </button>
                ) : null}
              </div>
            )
          })}
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-lg border border-line px-4 text-sm hover:bg-cell"
          >
            {allTried ? 'Закрыть вопрос · Esc' : 'Никто не ответил — закрыть · Esc'}
          </button>
          {nextTurnTeamName && <span className="text-sm text-muted">Потом ход у «{nextTurnTeamName}»</span>}
        </div>
      </div>
    </div>
  )
}
