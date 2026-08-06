import { describe, expect, mock, test } from 'bun:test'
import type { User } from '@/payload-types'

const listChannels = mock(async () => [
  { id: 'ch-1', name: 'TRT World', languageCode: 'en', language: 'English' },
  { id: 'ch-2', name: 'TRT Arabi', languageCode: 'ar', language: 'Arabic' },
])

mock.module('./cms-client/instance', () => ({
  getCmsClient: () => ({ listChannels }),
}))

const { getLeadDesks, getSwitcherDesks } = await import('./desks')

const admin = { id: 'admin-1', role: 'admin' } as User
const lead = { id: 'lead-1', role: 'editor', leadOfDesks: ['ch-1'] } as User
const plainEditor = { id: 'editor-1', role: 'editor' } as User

describe('getLeadDesks', () => {
  test('admin sees every channel', async () => {
    const desks = await getLeadDesks(admin)
    expect(desks.map((d) => d.id)).toEqual(['ch-1', 'ch-2'])
  })

  test('a lead sees only the channels they lead', async () => {
    const desks = await getLeadDesks(lead)
    expect(desks.map((d) => d.id)).toEqual(['ch-1'])
  })

  test('a plain editor with no leadOfDesks sees nothing', async () => {
    const desks = await getLeadDesks(plainEditor)
    expect(desks).toEqual([])
  })
})

describe('getSwitcherDesks', () => {
  test('admin sees every channel', async () => {
    const desks = await getSwitcherDesks(admin)
    expect(desks.map((d) => d.id)).toEqual(['ch-1', 'ch-2'])
  })

  test('a lead sees only the channels they lead', async () => {
    const desks = await getSwitcherDesks(lead)
    expect(desks.map((d) => d.id)).toEqual(['ch-1'])
  })

  test('a plain editor with no leadOfDesks sees every channel', async () => {
    const desks = await getSwitcherDesks(plainEditor)
    expect(desks.map((d) => d.id)).toEqual(['ch-1', 'ch-2'])
  })
})
