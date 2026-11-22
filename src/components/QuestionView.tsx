import { useEffect, useRef, useState, type ReactNode } from 'react'
import { formatTime, type TimerState } from '../live'
import type { Content, Question, Team } from '../types'
import { useTimeLeft } from '../useTimeLeft'
import { MediaView, SlideView } from './MediaView'
import TeamIcon from './TeamIcon'

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
  timer: TimerState | null // null — у вопроса нет таймера
  onToggleTimer: () => void
  onResetTimer: () => void
  onSetTimerLength: (sec: number | null) => void // ведущий выбрал время (null — без таймера)
  pinnedTimerSec?: number // закреплённое время: ставится на каждый вопрос
  onPinTimer: (sec: number | null) => void // закрепить время (null — открепить)
  viewOnly?: boolean // сыгранный вопрос открыт только посмотреть: кнопок «Верно / Неверно» нет
  onTimeUp: () => void // время вышло — сигнал
  final?: ReactNode // вопрос финала: цены нет, ответ — вместе с итогами, внизу вместо команд — отметки по ставкам
  branch?: { body: ReactNode; bottom: ReactNode } // ветвящийся вопрос: вместо слайдов — текущий шаг, внизу — варианты
}

// Короткая подсказка ведущему, что покажет следующий слайд
function describeSlide(slide: Content) {
  const kinds = { image: 'картинка', gif: 'GIF', video: 'видео', audio: 'музыка' }
  const parts = [slide.media && `${kinds[slide.media.type]} «${slide.media.name}»`, slide.text && `«${slide.text}»`]
  return parts.filter(Boolean).join(' + ')
}

const TIMER_PRESETS = [15, 30, 60]
const MAX_TIMER_SEC = 600

// Таймер на пульте: выбор времени, «Запустить / Пауза» (T) и «Сначала». Зал видит то же время.
// Нет таймера — зал его не видит, ведущий может выбрать время прямо сейчас.
function HostTimer({ timer, onToggle, onReset, onSetLength, pinnedSec, onPin, onTimeUp }: {
  timer: TimerState | null
  onToggle: () => void
  onReset: () => void
  onSetLength: (sec: number | null) => void
  pinnedSec?: number
  onPin: (sec: number | null) => void
  onTimeUp: () => void
}) {
  const left = useTimeLeft(timer)
  const [custom, setCustom] = useState('') // своё время, сек
  const running = !!timer && timer.endsAt !== null && left > 0
  const over = !!timer && left === 0
  const full = !!timer && !running && left === timer.totalSec * 1000

  // Сигнал — в тот момент, когда время вышло (а не при открытии уже истёкшего таймера)
  const wasOver = useRef(over)
  useEffect(() => {
    if (over && !wasOver.current) onTimeUp()
    wasOver.current = over
  }, [over, onTimeUp])

  function applyCustom() {
    const sec = Number(custom.trim())
    if (!Number.isInteger(sec) || sec <= 0 || sec > MAX_TIMER_SEC) return
    onSetLength(sec)
    setCustom('')
  }

  return (
    <div
      className={`flex flex-wrap items-center gap-3 rounded-xl p-4 ${over ? 'border-2 border-white bg-cell' : 'border border-line'}`}
    >
      <div className="text-sm font-semibold tracking-widest text-muted">ТАЙМЕР</div>
      {timer ? (
        <>
          <div className="min-w-24 font-display text-3xl tabular-nums" aria-live={over ? 'assertive' : 'off'}>
            {over ? 'ВРЕМЯ!' : formatTime(left)}
          </div>
          <button
            type="button"
            onClick={onToggle}
            className={`h-11 rounded-lg px-4 font-semibold ${running ? 'border border-white hover:bg-bg' : 'bg-white text-black hover:opacity-90'}`}
          >
            {running ? 'Пауза · T' : over ? 'Ещё раз · T' : full ? 'Запустить · T' : 'Продолжить · T'}
          </button>
          {!full && !over && (
            <button type="button" onClick={onReset} className="h-11 rounded-lg border border-line px-4 text-sm hover:bg-cell">
              Сначала
            </button>
          )}
        </>
      ) : (
        <span className="text-muted">нет · выберите время</span>
      )}

      <div role="group" aria-label="Время таймера" className="flex flex-wrap items-center gap-1.5">
        {TIMER_PRESETS.map((sec) => {
          const chosen = timer?.totalSec === sec
          return (
            <button
              key={sec}
              type="button"
              onClick={() => onSetLength(sec)}
              aria-pressed={chosen}
              className={`h-11 min-w-11 rounded-lg px-2 text-sm ${chosen ? 'bg-white font-semibold text-black' : 'border border-line hover:bg-cell'}`}
            >
              {sec} с
            </button>
          )
        })}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            applyCustom()
          }}
          className="flex items-center gap-1.5"
        >
          <input
            inputMode="numeric"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            aria-label="Своё время таймера, секунд"
            placeholder={timer && !TIMER_PRESETS.includes(timer.totalSec) ? String(timer.totalSec) : 'сек'}
            className="h-11 w-16 rounded-lg border border-line bg-bg px-2 text-white placeholder:text-muted/60 focus:border-white focus:outline-none"
          />
          <button type="submit" className="h-11 rounded-lg border border-line px-3 text-sm hover:bg-cell">
            Поставить
          </button>
        </form>
        {timer && (
          <button
            type="button"
            onClick={() => onSetLength(null)}
            className="h-11 rounded-lg border border-line px-3 text-sm hover:bg-cell"
          >
            Убрать
          </button>
        )}
      </div>

      {/* Закрепить: это время будет ставиться на каждый следующий вопрос, пока не открепите */}
      {pinnedSec && (!timer || timer.totalSec === pinnedSec) ? (
        <button
          type="button"
          onClick={() => onPin(null)}
          aria-pressed
          title="Сейчас это время ставится на каждый вопрос. Нажмите, чтобы открепить"
          className="h-11 rounded-lg bg-white px-3 text-sm font-semibold text-black hover:opacity-90"
        >
          📌 {pinnedSec} с на все вопросы · открепить
        </button>
      ) : timer ? (
        <button
          type="button"
          onClick={() => onPin(timer.totalSec)}
          title="Это время будет ставиться на каждый вопрос, даже если в редакторе задано другое"
          className="h-11 rounded-lg border border-line px-3 text-sm hover:bg-cell"
        >
          📌 Закрепить {timer.totalSec} с{pinnedSec ? ` (сейчас ${pinnedSec} с)` : ''}
        </button>
      ) : null}
    </div>
  )
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
  timer,
  onToggleTimer,
  onResetTimer,
  onSetTimerLength,
  pinnedTimerSec,
  onPinTimer,
  viewOnly,
  onTimeUp,
  final,
  branch,
}: Props) {
  const count = question.slides.length
  const slide = question.slides[slideIndex] ?? question.slides[0] ?? {}
  const next = question.slides[slideIndex + 1]

  // Ход ответа: сначала отвечает команда, чей ход; ошиблась — вопрос может перехватить любая другая
  const stealing = triedTeamIds.length > 0
  const answeringTeam = teams.find((t) => t.id === answeringTeamId)
  const allTried = teams.length > 0 && teams.every((t) => triedTeamIds.includes(t.id))
  const triedNames = teams.filter((t) => triedTeamIds.includes(t.id)).map((t) => `«${t.name}»`)
  const waitingSteal = stealing && !answeringTeam && !allTried // ошиблись, ждём, возьмётся ли кто-то перехватить
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
          {categoryTitle.toUpperCase()}
          {!final && (
            <>
              {' · '}
              <span className="rounded-lg bg-white px-4 py-1 text-black">{question.value}</span>
            </>
          )}
        </span>
        <span className="text-sm text-muted">
          {viewOnly ? 'уже сыгран · в зале — только для показа' : 'в зале сейчас этот вопрос'}
        </span>
      </div>

      {branch ? (
        branch.body
      ) : (
        <>
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
        {final ? (
          <span className="text-muted">Зал увидит ответ вместе с итогами</span>
        ) : showAnswer ? (
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
        </>
      )}

      <div className="flex flex-wrap items-stretch gap-4">
        <HostTimer
          timer={timer}
          onToggle={onToggleTimer}
          onReset={onResetTimer}
          onSetLength={onSetTimerLength}
          pinnedSec={pinnedTimerSec}
          onPin={onPinTimer}
          onTimeUp={onTimeUp}
        />
        {question.hostNote && (
          <div className="min-w-64 flex-1 rounded-xl border border-line p-4">
            <div className="text-sm font-semibold tracking-widest text-muted">ЗАМЕТКА · ТОЛЬКО ДЛЯ ВЕДУЩЕГО</div>
            <p className="mt-1 text-lg whitespace-pre-line">{question.hostNote}</p>
          </div>
        )}
      </div>

      {viewOnly ? (
        <div className="mt-auto flex flex-wrap items-center gap-4 rounded-xl border-2 border-played p-4">
          <span className="min-w-0 flex-1 text-lg">
            Этот вопрос уже сыгран. Он открыт только посмотреть — счёт и ход не меняются.
          </span>
          <button type="button" onClick={onClose} className="h-11 rounded-lg bg-white px-5 font-semibold text-black hover:opacity-90">
            Вернуться к табло · Esc
          </button>
        </div>
      ) : branch?.bottom ?? final ?? (
      <div className="mt-auto flex flex-col gap-3">
        <div className="text-xl font-semibold" aria-live="polite">
          {status}
        </div>

        {/* Перехват: кто-то из команд берётся отвечать — или никто не хочет, и вопрос закрывается */}
        {waitingSteal && (
          <button
            type="button"
            onClick={onClose}
            className="h-12 self-start rounded-lg bg-white px-6 font-semibold text-black hover:opacity-90"
          >
            Никто не перехватывает — закрыть вопрос · Esc
          </button>
        )}

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
                  <TeamIcon team={team} size={28} />
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
          {!waitingSteal && (
            <button
              type="button"
              onClick={onClose}
              className="h-11 rounded-lg border border-line px-4 text-sm hover:bg-cell"
            >
              {allTried ? 'Закрыть вопрос · Esc' : 'Никто не ответил — закрыть · Esc'}
            </button>
          )}
          {nextTurnTeamName && <span className="text-sm text-muted">Потом ход у «{nextTurnTeamName}»</span>}
        </div>
      </div>
      )}
    </div>
  )
}
