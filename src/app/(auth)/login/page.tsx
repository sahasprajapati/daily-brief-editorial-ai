'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { login, type LoginState } from './actions'

const initialState: LoginState = { error: null }

export default function LoginPage() {
  const router = useRouter()
  const [state, formAction, isPending] = useActionState(login, initialState)
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    if (!isPending && state.error === null && state !== initialState) {
      router.replace('/')
      router.refresh()
    }
  }, [state, isPending, router])

  return (
    <div className="center-page">
      <div className="card">
        <h1>Editorial Assistant</h1>
        <p className="subtitle">Sign in to review and claim pieces.</p>

        <form action={formAction}>
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required autoComplete="username" />

          <label htmlFor="password">Password</label>
          <div style={{ position: 'relative' }}>
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete="current-password"
              style={{ paddingRight: '2.75rem' }}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
              style={{
                position: 'absolute',
                top: '0.75rem',
                right: '0.5rem',
                width: 'auto',
                padding: '0.25rem',
                background: 'none',
                border: 'none',
                boxShadow: 'none',
                color: '#6b7280',
                cursor: 'pointer',
                lineHeight: 0,
              }}
            >
              {showPassword ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                  <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                  <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                  <line x1="2" x2="22" y1="2" y2="22" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>

          <button type="submit" disabled={isPending}>
            {isPending ? 'Signing in…' : 'Sign in'}
          </button>

          {state.error && <p className="error">{state.error}</p>}
        </form>
      </div>
    </div>
  )
}
