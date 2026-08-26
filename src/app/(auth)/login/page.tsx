'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { login, type LoginState } from './actions'

const initialState: LoginState = { error: null }

export default function LoginPage() {
  const router = useRouter()
  const [state, formAction, isPending] = useActionState(login, initialState)

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
          <input id="password" name="password" type="password" required autoComplete="current-password" />

          <button type="submit" disabled={isPending}>
            {isPending ? 'Signing in…' : 'Sign in'}
          </button>

          {state.error && <p className="error">{state.error}</p>}
        </form>
      </div>
    </div>
  )
}
