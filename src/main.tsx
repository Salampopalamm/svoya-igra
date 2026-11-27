import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import DevBadge from './components/DevBadge.tsx'
import { IS_DEV_SITE } from './site'

// Тестовый сайт (ветка dev) помечен везде, чтобы его не спутали с основным
if (IS_DEV_SITE) document.title = 'DEV · Своя игра'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    {IS_DEV_SITE && <DevBadge />}
  </StrictMode>,
)
