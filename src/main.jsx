import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { ConfigProvider } from 'antd'
import { AuthProvider } from './auth/AuthContext'
import { TerminologyProvider } from './TerminologyContext'
import { queryClient } from './queryClient'
import App from './App'
import './styles/index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <ConfigProvider
          theme={{
            token: {
              colorPrimary: '#13223a',
              fontFamily: "'Inter', system-ui, sans-serif",
              borderRadius: 6,
            },
          }}
        >
          <AuthProvider>
            <TerminologyProvider>
              <App />
            </TerminologyProvider>
          </AuthProvider>
        </ConfigProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>
)
