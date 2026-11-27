import { useEffect, useState } from 'react'
import { BUILD_VERSION, issueUrl } from '../site'

const REPORT_LINK =
  'pointer-events-auto flex min-h-11 items-center rounded-md border border-line bg-bg px-3 font-sans text-xs text-muted shadow-lg hover:bg-cell hover:text-white'

// Метка «DEV» с версией и кнопки для тестировщика: «Сообщить о проблеме» и «Идея» открывают анкету
// на GitHub с уже вписанной версией. На экране зала (проектор) кнопок нет — только метка.
// Сама метка клики пропускает насквозь (pointer-events-none), ловят их только кнопки.
// Показывается только на тестовом сайте (main.tsx).
export default function DevBadge() {
  const [hash, setHash] = useState(window.location.hash)
  useEffect(() => {
    const onChange = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  const isHall = hash === '#/screen'

  return (
    <div className="pointer-events-none fixed bottom-2 left-2 z-[60] flex items-center gap-2">
      <div
        aria-hidden
        className="rounded-md bg-[#e5484d] px-2 py-0.5 font-sans text-xs font-bold tracking-widest text-white"
      >
        DEV · тестовая версия{BUILD_VERSION ? ` · ${BUILD_VERSION}` : ''}
      </div>
      {!isHall && (
        <>
          <a href={issueUrl('bug.yml', BUILD_VERSION)} target="_blank" rel="noopener noreferrer" className={REPORT_LINK}>
            🐞 Сообщить о проблеме
          </a>
          <a href={issueUrl('idea.yml', BUILD_VERSION)} target="_blank" rel="noopener noreferrer" className={REPORT_LINK}>
            💡 Идея
          </a>
        </>
      )}
    </div>
  )
}
