import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom'
import './styles.css'
import { ToastProvider } from './components/ui'
import Landing from './pages/Landing'
import Home from './pages/Home'
import Hisaab from './pages/Hisaab'
import Helpers from './pages/Helpers'
import HelperPhone from './pages/HelperPhone'
import Stage from './pages/Stage'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <ToastProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/app" element={<Home />} />
          <Route path="/app/hisaab" element={<Hisaab />} />
          <Route path="/app/helpers" element={<Helpers />} />
          <Route path="/h/:id" element={<HelperPhone />} />
          <Route path="/stage" element={<Stage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
)
