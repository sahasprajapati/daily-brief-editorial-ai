'use server'

import { cookies } from 'next/headers'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

export type LoginState = { error: string | null }

export async function login(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const email = formData.get('email')
  const password = formData.get('password')

  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    return { error: 'Enter your email and password.' }
  }

  const payload = await getPayload({ config: configPromise })

  try {
    const result = await payload.login({
      collection: 'users',
      data: { email, password },
    })

    if (!result.token || !result.exp) {
      return { error: 'Invalid email or password.' }
    }

    ;(await cookies()).set('payload-token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      expires: new Date(result.exp * 1000),
    })
  } catch {
    return { error: 'Invalid email or password.' }
  }

  return { error: null }
}
