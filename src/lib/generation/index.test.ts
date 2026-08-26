import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import type { CollectedItem, BriefItem, EditorialBrief, ChannelConfig, User } from '@/payload-types'
import * as openai from './openai'
import { generatePiece, generatePieceForTopic } from './index'

const user = { id: 'lead-1', role: 'editor' } as User

const collectedItem = {
  id: 'collected-1',
  headline: 'Test headline',
  body: 'Test body',
  sources: [{ provider: { id: 'p1', name: 'Test Wire' }, providerItemId: 'x' }],
} as unknown as CollectedItem

const briefItem = {
  id: 'item-1',
  topic: 'Test topic',
  angle: 'Test angle',
  sentiment: 'neutral',
  portrayalNotes: '',
  requiredContext: '',
  bannedTerms: ['flood'],
} as unknown as BriefItem

const brief = { id: 'brief-1', channel: 'ch-1', channelName: 'Test Channel' } as EditorialBrief
const channelConfig = { id: 'cc-1', channel: 'ch-1', language: 'English', guidelineSlug: null } as unknown as ChannelConfig

function fakePayload() {
  const created: any[] = []
  return {
    created,
    payload: {
      create: async ({ data }: any) => {
        const doc = { id: 'piece-1', ...data }
        created.push(doc)
        return doc
      },
    },
  }
}

afterEach(() => {
  ;(openai.runGeneration as any).mockRestore?.()
})

describe('generatePiece', () => {
  test('mints blocks with ids and builds the attribution string from sources', async () => {
    const runSpy = spyOn(openai, 'runGeneration').mockResolvedValue({
      blocks: [
        { type: 'heading', text: 'Generated headline' },
        { type: 'paragraph', text: 'Generated paragraph.' },
      ],
    })

    const { payload, created } = fakePayload()
    const piece = await generatePiece(payload as any, user, collectedItem, briefItem, brief, channelConfig)

    expect(runSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: 'Test topic',
        sources: [{ headline: 'Test headline', body: 'Test body', agency: 'Test Wire' }],
      }),
    )
    expect(piece.generatedSnapshot).toHaveLength(2)
    expect((piece.generatedSnapshot as any[])[0]).toMatchObject({ type: 'heading', text: 'Generated headline' })
    expect((piece.generatedSnapshot as any[])[0].blockId).toBeTruthy()
    expect(piece.currentBody).toEqual(piece.generatedSnapshot)
    expect(piece.attributionString).toBe('Sources: Test Wire (1 wire item(s))')
    expect(piece.channel).toBe('ch-1')
    expect(created[0].collectedItem).toBe('collected-1')
  })

  test('generatePieceForTopic synthesizes from multiple sources', async () => {
    const second = {
      id: 'collected-2',
      headline: 'Second headline',
      body: 'Second body',
      sources: [{ provider: { id: 'p2', name: 'Other Wire' }, providerItemId: 'y' }],
    } as unknown as CollectedItem

    const runSpy = spyOn(openai, 'runGeneration').mockResolvedValue({
      blocks: [{ type: 'heading', text: 'Combined' }, { type: 'paragraph', text: 'Body.' }],
    })

    const { payload, created } = fakePayload()
    const piece = await generatePieceForTopic(
      payload as any,
      user,
      briefItem,
      [collectedItem, second],
      brief,
      channelConfig,
    )

    expect(runSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        sources: [
          { headline: 'Test headline', body: 'Test body', agency: 'Test Wire' },
          { headline: 'Second headline', body: 'Second body', agency: 'Other Wire' },
        ],
      }),
    )
    expect(piece.attributionString).toBe('Sources: Test Wire, Other Wire (2 wire item(s))')
    expect(created[0].collectedItem).toBe('collected-1')
  })
})
