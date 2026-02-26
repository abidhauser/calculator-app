import { useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'

type LoginGateProps = {
  children: ReactNode
}

const AUTH_KEY = 'calculator_app_authenticated'

const LoginGate = ({ children }: LoginGateProps) => {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const configuredPassword = import.meta.env.VITE_APP_PASSWORD

  useEffect(() => {
    const savedAuth = sessionStorage.getItem(AUTH_KEY)
    if (savedAuth === 'true') {
      setIsAuthenticated(true)
    }
  }, [])

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!configuredPassword) {
      setError('Password is not configured. Set VITE_APP_PASSWORD in your .env file.')
      return
    }

    if (password === configuredPassword) {
      sessionStorage.setItem(AUTH_KEY, 'true')
      setIsAuthenticated(true)
      setError('')
      setPassword('')
      return
    }

    setError('Incorrect password.')
  }

  const handleLogout = () => {
    sessionStorage.removeItem(AUTH_KEY)
    setIsAuthenticated(false)
    setPassword('')
    setError('')
  }

  if (isAuthenticated) {
    return (
      <>
        <button
          type="button"
          onClick={handleLogout}
          style={{
            position: 'fixed',
            top: '1rem',
            right: '1rem',
            height: '2.25rem',
            padding: '0 0.85rem',
            border: '1px solid #d1d5db',
            borderRadius: '0.4rem',
            backgroundColor: '#fff',
            cursor: 'pointer',
            zIndex: 1000,
          }}
        >
          Logout
        </button>
        {children}
      </>
    )
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: '1rem',
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: '100%',
          maxWidth: '360px',
          display: 'grid',
          gap: '0.75rem',
          padding: '1.25rem',
          border: '1px solid #d9d9d9',
          borderRadius: '0.5rem',
          backgroundColor: '#fff',
        }}
      >
        <h1 style={{ margin: 0, fontSize: '1.2rem' }}>Login</h1>
        <label htmlFor="password" style={{ fontSize: '0.9rem' }}>
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          style={{
            height: '2.5rem',
            padding: '0 0.75rem',
            border: '1px solid #cfcfcf',
            borderRadius: '0.4rem',
          }}
        />
        {error && (
          <p style={{ margin: 0, color: '#c81e1e', fontSize: '0.85rem' }}>{error}</p>
        )}
        <button
          type="submit"
          style={{
            height: '2.5rem',
            border: 0,
            borderRadius: '0.4rem',
            backgroundColor: '#111827',
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          Sign in
        </button>
      </form>
    </main>
  )
}

export default LoginGate
