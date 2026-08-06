import { describe, expect, test } from 'bun:test'
import {
  canLeadActOnPiece,
  statusAfterVerdict,
  stepFromStatus,
} from './assignment-status'

describe('statusAfterVerdict', () => {
  test('goodToGo → awaitingApproval', () => {
    expect(statusAfterVerdict('goodToGo')).toBe('awaitingApproval')
  })
  test('needsAttention / rejected → inProgress', () => {
    expect(statusAfterVerdict('needsAttention')).toBe('inProgress')
    expect(statusAfterVerdict('rejected')).toBe('inProgress')
  })
})

describe('stepFromStatus', () => {
  test('maps statuses to stepper steps', () => {
    expect(stepFromStatus('claimed')).toBe('edit')
    expect(stepFromStatus('inProgress')).toBe('edit')
    expect(stepFromStatus('inQA')).toBe('qa')
    expect(stepFromStatus('verdictReached')).toBe('qa')
    expect(stepFromStatus('awaitingApproval')).toBe('approve')
    expect(stepFromStatus('approved')).toBe('publish')
    expect(stepFromStatus('published')).toBe('publish')
  })
})

describe('canLeadActOnPiece', () => {
  test('admin always', () => {
    expect(canLeadActOnPiece({ role: 'admin', leadOfDesks: [] }, 'ch-1')).toBe(true)
  })
  test('lead of channel', () => {
    expect(canLeadActOnPiece({ role: 'editor', leadOfDesks: ['ch-1'] }, 'ch-1')).toBe(true)
  })
  test('non-lead editor denied', () => {
    expect(canLeadActOnPiece({ role: 'editor', leadOfDesks: ['ch-2'] }, 'ch-1')).toBe(false)
  })
})
