import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { BUILD_VERSION, IS_DEV_SITE } from './site'

// Тестовый сайт (ветка dev) помечен везде, чтобы его не спутали с основным
if (IS_DEV_SITE) document.title = 'DEV · Своя игра'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    {IS_DEV_SITE && (
      <div
        aria-hidden
        className="pointer-events-none fixed bottom-2 left-2 z-[60] rounded-md bg-[#e5484d] px-2 py-0.5 font-sans text-xs font-bold tracking-widest text-white"
      >
        DEV · тестовая версия{BUILD_VERSION ? ` · ${BUILD_VERSION}` : ''}
      </div>
    )}
  </StrictMode>,
)
