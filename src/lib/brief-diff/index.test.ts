import { describe, expect, test } from 'bun:test'
import { diffBriefItems } from './index'

describe('diffBriefItems', () => {
  test('marks a topic unchanged when no compared field differs', () => {
    const item = { topic: 'Gaza ceasefire', angle: 'Focus on mediation', priorityOrder: 1 }
    const result = diffBriefItems([item], [{ ...item }])
    expect(result).toEqual([{ topic: 'Gaza ceasefire', status: 'unchanged', fieldChanges: {} }])
  })

  test('marks a topic changed and reports the field diff', () => {
    const original = [{ topic: 'Gaza ceasefire', angle: 'Original angle', priorityOrder: 1 }]
    const current = [{ topic: 'Gaza ceasefire', angle: 'Edited angle', priorityOrder: 2 }]
    const result = diffBriefItems(original, current)
    expect(result).toEqual([
      {
        topic: 'Gaza ceasefire',
        status: 'changed',
        fieldChanges: {
          angle: { before: 'Original angle', after: 'Edited angle' },
          priorityOrder: { before: 1, after: 2 },
        },
      },
    ])
  })

  test('marks a new topic as added', () => {
    const result = diffBriefItems([], [{ topic: 'New topic', angle: 'An angle', priorityOrder: 1 }])
    expect(result).toEqual([{ topic: 'New topic', status: 'added', fieldChanges: {} }])
  })

  test('marks a removed topic as removed', () => {
    const result = diffBriefItems([{ topic: 'Old topic', angle: 'An angle', priorityOrder: 1 }], [])
    expect(result).toEqual([{ topic: 'Old topic', status: 'removed', fieldChanges: {} }])
  })

  test('compares array fields by value, not reference', () => {
    const original = [{ topic: 'T', angle: 'A', priorityOrder: 1, exclusions: ['x', 'y'] }]
    const current = [{ topic: 'T', angle: 'A', priorityOrder: 1, exclusions: ['x', 'y'] }]
    const result = diffBriefItems(original, current)
    expect(result[0].status).toBe('unchanged')
  })
})
