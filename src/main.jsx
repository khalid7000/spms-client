import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './auth/AuthContext'
import { LanguageProvider } from './LanguageContext'
import { TerminologyProvider } from './TerminologyContext'
import { queryClient } from './queryClient'
import App from './App'
import './i18n'
import './styles/index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* Vite's own `base` config wants a trailing slash; React Router's `basename` convention
        does not -- both are driven by the same VITE_BASE_PATH value, so normalize it here. */}
    <BrowserRouter basename={(import.meta.env.VITE_BASE_PATH || '/').replace(/\/$/, '') || '/'}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <LanguageProvider>
            <TerminologyProvider>
              <App />
            </TerminologyProvider>
          </LanguageProvider>
        </AuthProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>
)
