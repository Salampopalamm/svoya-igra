import type { Content } from '../types'
import { ContentMedia } from './MediaView'

// Подсказка в зале: всплывает поверх вопроса (вопрос виден за ней приглушённым), пока ведущий её не уберёт
export default function HintPopup({ hint, index }: { hint: Content; index: number }) {
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-bg/70 p-12">
      <div key={index} className="anim-appear flex max-h-full w-full max-w-6xl flex-col items-center gap-6 rounded-3xl border-[3px] border-accent bg-cell p-10 text-center shadow-2xl">
        <span className="font-display text-4xl">💡 ПОДСКАЗКА {index + 1}</span>
        {hint.text && <p className="text-5xl leading-tight font-semibold break-words whitespace-pre-line">{hint.text}</p>}
        <ContentMedia content={hint} mode="hall" className="max-h-[50vh]" gridHeight="50vh" />
      </div>
    </div>
  )
}
