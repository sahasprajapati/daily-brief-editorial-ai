import { describe, expect, test } from 'bun:test'
import type { PayloadRequest } from 'payload'
import type { User } from '@/payload-types'
import {
  isLeadOfDesk,
  leadOfDeskBriefCreate,
  leadOfDeskBriefItemCreate,
  leadOfDeskBriefItemUpdate,
  leadOfDeskBriefUpdate,
  leadOfDeskChannelConfigCreate,
  leadOfDeskChannelConfigUpdate,
  leadOfDeskCollectedItemCreate,
  leadOfDeskFileCreate,
  leadOfDeskPieceCreate,
  ownAssignedPieceUpdate,
  ownAssignedVerdictCreate,
  ownAssignmentUpdate,
  selfClaimOnly,
} from './admin'

const admin = { id: 'admin-1', role: 'admin' } as User
const editor = { id: 'editor-1', role: 'editor' } as User
const otherEditor = { id: 'editor-2', role: 'editor' } as User

function fakeFind(matches: boolean) {
  return async () => ({ docs: matches ? [{ id: 'assignment-1' }] : [] }) as any
}

function fakeFindByID(assignedTo: string | null) {
  return async () => (assignedTo ? ({ id: 'assignment-1', assignedTo } as any) : null)
}

describe('selfClaimOnly', () => {
  test('admin can create an assignment for anyone', () => {
    const req = { user: admin } as PayloadRequest
    expect(selfClaimOnly({ req, data: { assignedTo: otherEditor.id } } as any)).toBe(true)
  })

  test('editor can create an assignment for themselves', () => {
    const req = { user: editor } as PayloadRequest
    expect(selfClaimOnly({ req, data: { assignedTo: editor.id } } as any)).toBe(true)
  })

  test('editor cannot create an assignment for someone else', () => {
    const req = { user: editor } as PayloadRequest
    expect(selfClaimOnly({ req, data: { assignedTo: otherEditor.id } } as any)).toBe(false)
  })

  test('logged-out request is denied', () => {
    const req = { user: null } as PayloadRequest
    expect(selfClaimOnly({ req, data: { assignedTo: editor.id } } as any)).toBe(false)
  })
})

describe('ownAssignmentUpdate', () => {
  test('admin can update any assignment', async () => {
    const req = { user: admin, payload: { findByID: fakeFindByID(otherEditor.id) } } as unknown as PayloadRequest
    expect(await ownAssignmentUpdate({ req, id: 'assignment-1' } as any)).toBe(true)
  })

  test('the assignee can update their own assignment', async () => {
    const req = { user: editor, payload: { findByID: fakeFindByID(editor.id) } } as unknown as PayloadRequest
    expect(await ownAssignmentUpdate({ req, id: 'assignment-1' } as any)).toBe(true)
  })

  test("another editor cannot update someone else's assignment", async () => {
    const req = { user: otherEditor, payload: { findByID: fakeFindByID(editor.id) } } as unknown as PayloadRequest
    expect(await ownAssignmentUpdate({ req, id: 'assignment-1' } as any)).toBe(false)
  })

  test('missing id is denied', async () => {
    const req = { user: editor, payload: { findByID: fakeFindByID(editor.id) } } as unknown as PayloadRequest
    expect(await ownAssignmentUpdate({ req } as any)).toBe(false)
  })
})

describe('ownAssignedPieceUpdate', () => {
  test('admin can always update', async () => {
    const req = { user: admin, payload: { find: fakeFind(false) } } as unknown as PayloadRequest
    expect(await ownAssignedPieceUpdate({ req, id: 'piece-1' } as any)).toBe(true)
  })

  test('the assignee can update their claimed piece', async () => {
    const req = { user: editor, payload: { find: fakeFind(true) } } as unknown as PayloadRequest
    expect(await ownAssignedPieceUpdate({ req, id: 'piece-1' } as any)).toBe(true)
  })

  test('a non-assignee cannot update the piece', async () => {
    const req = { user: otherEditor, payload: { find: fakeFind(false) } } as unknown as PayloadRequest
    expect(await ownAssignedPieceUpdate({ req, id: 'piece-1' } as any)).toBe(false)
  })
})

describe('ownAssignedVerdictCreate', () => {
  test('the assignee can submit a verdict for their piece', async () => {
    const req = { user: editor, payload: { find: fakeFind(true) } } as unknown as PayloadRequest
    expect(await ownAssignedVerdictCreate({ req, data: { piece: 'piece-1' } } as any)).toBe(true)
  })

  test('a non-assignee cannot submit a verdict', async () => {
    const req = { user: otherEditor, payload: { find: fakeFind(false) } } as unknown as PayloadRequest
    expect(await ownAssignedVerdictCreate({ req, data: { piece: 'piece-1' } } as any)).toBe(false)
  })
})

describe('isLeadOfDesk', () => {
  test('true when the channel id is in leadOfDesks', () => {
    const user = { id: 'u1', role: 'editor', leadOfDesks: ['ch-1', 'ch-2'] } as User
    expect(isLeadOfDesk(user, 'ch-1')).toBe(true)
  })

  test('false when the channel id is not in leadOfDesks', () => {
    const user = { id: 'u1', role: 'editor', leadOfDesks: ['ch-2'] } as User
    expect(isLeadOfDesk(user, 'ch-1')).toBe(false)
  })

  test('false when leadOfDesks is empty or missing', () => {
    expect(isLeadOfDesk({ id: 'u1', role: 'editor' } as User, 'ch-1')).toBe(false)
    expect(isLeadOfDesk(null, 'ch-1')).toBe(false)
  })

  test('false when channelId is not a string', () => {
    const user = { id: 'u1', role: 'editor', leadOfDesks: ['ch-1'] } as User
    expect(isLeadOfDesk(user, undefined)).toBe(false)
  })
})

describe('leadOfDeskBriefCreate', () => {
  test('admin can create for any channel', () => {
    const req = { user: admin } as PayloadRequest
    expect(leadOfDeskBriefCreate({ req, data: { channel: 'ch-99' } } as any)).toBe(true)
  })

  test('lead of the target desk can create', () => {
    const lead = { id: 'lead-1', role: 'editor', leadOfDesks: ['ch-1'] } as User
    const req = { user: lead } as PayloadRequest
    expect(leadOfDeskBriefCreate({ req, data: { channel: 'ch-1' } } as any)).toBe(true)
  })

  test('non-lead of the target desk cannot create', () => {
    const editor2 = { id: 'editor-2', role: 'editor', leadOfDesks: ['ch-2'] } as User
    const req = { user: editor2 } as PayloadRequest
    expect(leadOfDeskBriefCreate({ req, data: { channel: 'ch-1' } } as any)).toBe(false)
  })
})

function fakeFindByIDChannel(channel: string) {
  return async () => ({ id: 'brief-1', channel } as any)
}

describe('leadOfDeskBriefUpdate', () => {
  test('admin can update any brief', async () => {
    const req = { user: admin, payload: { findByID: fakeFindByIDChannel('ch-1') } } as unknown as PayloadRequest
    expect(await leadOfDeskBriefUpdate({ req, id: 'brief-1' } as any)).toBe(true)
  })

  test('lead of the brief channel can update', async () => {
    const lead = { id: 'lead-1', role: 'editor', leadOfDesks: ['ch-1'] } as User
    const req = { user: lead, payload: { findByID: fakeFindByIDChannel('ch-1') } } as unknown as PayloadRequest
    expect(await leadOfDeskBriefUpdate({ req, id: 'brief-1' } as any)).toBe(true)
  })

  test('non-lead cannot update', async () => {
    const editor2 = { id: 'editor-2', role: 'editor', leadOfDesks: ['ch-2'] } as User
    const req = { user: editor2, payload: { findByID: fakeFindByIDChannel('ch-1') } } as unknown as PayloadRequest
    expect(await leadOfDeskBriefUpdate({ req, id: 'brief-1' } as any)).toBe(false)
  })
})

describe('leadOfDeskBriefItemCreate', () => {
  test('admin can create for any brief', async () => {
    const req = { user: admin, payload: { findByID: fakeFindByIDChannel('ch-1') } } as unknown as PayloadRequest
    expect(await leadOfDeskBriefItemCreate({ req, data: { brief: 'brief-1' } } as any)).toBe(true)
  })

  test('lead of the parent brief channel can create', async () => {
    const lead = { id: 'lead-1', role: 'editor', leadOfDesks: ['ch-1'] } as User
    const req = { user: lead, payload: { findByID: fakeFindByIDChannel('ch-1') } } as unknown as PayloadRequest
    expect(await leadOfDeskBriefItemCreate({ req, data: { brief: 'brief-1' } } as any)).toBe(true)
  })

  test('non-lead cannot create', async () => {
    const editor2 = { id: 'editor-2', role: 'editor', leadOfDesks: ['ch-2'] } as User
    const req = { user: editor2, payload: { findByID: fakeFindByIDChannel('ch-1') } } as unknown as PayloadRequest
    expect(await leadOfDeskBriefItemCreate({ req, data: { brief: 'brief-1' } } as any)).toBe(false)
  })

  test('missing data.brief is denied for a non-admin', async () => {
    const lead = { id: 'lead-1', role: 'editor', leadOfDesks: ['ch-1'] } as User
    const req = { user: lead, payload: { findByID: fakeFindByIDChannel('ch-1') } } as unknown as PayloadRequest
    expect(await leadOfDeskBriefItemCreate({ req, data: {} } as any)).toBe(false)
  })
})

function fakeFindByIDBriefChannel(channel: string) {
  return async () => ({ id: 'item-1', brief: { channel } } as any)
}

describe('leadOfDeskBriefItemUpdate', () => {
  test('lead of the parent brief channel can update the item', async () => {
    const lead = { id: 'lead-1', role: 'editor', leadOfDesks: ['ch-1'] } as User
    const req = { user: lead, payload: { findByID: fakeFindByIDBriefChannel('ch-1') } } as unknown as PayloadRequest
    expect(await leadOfDeskBriefItemUpdate({ req, id: 'item-1' } as any)).toBe(true)
  })

  test('non-lead cannot update the item', async () => {
    const editor2 = { id: 'editor-2', role: 'editor', leadOfDesks: ['ch-2'] } as User
    const req = { user: editor2, payload: { findByID: fakeFindByIDBriefChannel('ch-1') } } as unknown as PayloadRequest
    expect(await leadOfDeskBriefItemUpdate({ req, id: 'item-1' } as any)).toBe(false)
  })
})

describe('leadOfDeskFileCreate', () => {
  test('lead of the target desk can upload a file for it', () => {
    const lead = { id: 'lead-1', role: 'editor', leadOfDesks: ['ch-1'] } as User
    const req = { user: lead } as PayloadRequest
    expect(leadOfDeskFileCreate({ req, data: { channel: 'ch-1' } } as any)).toBe(true)
  })

  test('non-lead cannot upload a file for a desk they do not lead', () => {
    const editor2 = { id: 'editor-2', role: 'editor', leadOfDesks: ['ch-2'] } as User
    const req = { user: editor2 } as PayloadRequest
    expect(leadOfDeskFileCreate({ req, data: { channel: 'ch-1' } } as any)).toBe(false)
  })
})

function fakeFindByIDBriefWithBriefChannel(channel: string) {
  return async () => ({ id: 'item-1', brief: { channel } } as any)
}

function fakeFindByIDChannelOnly(channel: string) {
  return async () => ({ id: 'brief-1', channel } as any)
}

describe('leadOfDeskCollectedItemCreate', () => {
  test('admin can create for any briefItem', async () => {
    const req = { user: admin, payload: { findByID: fakeFindByIDBriefWithBriefChannel('ch-1') } } as unknown as PayloadRequest
    expect(await leadOfDeskCollectedItemCreate({ req, data: { briefItem: 'item-1' } } as any)).toBe(true)
  })

  test('lead of the briefItem parent brief channel can create', async () => {
    const lead = { id: 'lead-1', role: 'editor', leadOfDesks: ['ch-1'] } as User
    const req = { user: lead, payload: { findByID: fakeFindByIDBriefWithBriefChannel('ch-1') } } as unknown as PayloadRequest
    expect(await leadOfDeskCollectedItemCreate({ req, data: { briefItem: 'item-1' } } as any)).toBe(true)
  })

  test('non-lead cannot create', async () => {
    const editor2 = { id: 'editor-2', role: 'editor', leadOfDesks: ['ch-2'] } as User
    const req = { user: editor2, payload: { findByID: fakeFindByIDBriefWithBriefChannel('ch-1') } } as unknown as PayloadRequest
    expect(await leadOfDeskCollectedItemCreate({ req, data: { briefItem: 'item-1' } } as any)).toBe(false)
  })

  test('missing data.briefItem is denied for a non-admin', async () => {
    const lead = { id: 'lead-1', role: 'editor', leadOfDesks: ['ch-1'] } as User
    const req = { user: lead, payload: { findByID: fakeFindByIDBriefWithBriefChannel('ch-1') } } as unknown as PayloadRequest
    expect(await leadOfDeskCollectedItemCreate({ req, data: {} } as any)).toBe(false)
  })
})

function fakeFindByIDConfigChannel(channel: string) {
  return async () => ({ id: 'config-1', channel } as any)
}

describe('leadOfDeskChannelConfigCreate', () => {
  test('admin can create for any channel', () => {
    const req = { user: admin } as PayloadRequest
    expect(leadOfDeskChannelConfigCreate({ req, data: { channel: 'ch-99' } } as any)).toBe(true)
  })

  test('lead of the target channel can create', () => {
    const lead = { id: 'lead-1', role: 'editor', leadOfDesks: ['ch-1'] } as User
    const req = { user: lead } as PayloadRequest
    expect(leadOfDeskChannelConfigCreate({ req, data: { channel: 'ch-1' } } as any)).toBe(true)
  })

  test('non-lead of the target channel cannot create', () => {
    const editor2 = { id: 'editor-2', role: 'editor', leadOfDesks: ['ch-2'] } as User
    const req = { user: editor2 } as PayloadRequest
    expect(leadOfDeskChannelConfigCreate({ req, data: { channel: 'ch-1' } } as any)).toBe(false)
  })
})

describe('leadOfDeskChannelConfigUpdate', () => {
  test('admin can update any channel config', async () => {
    const req = {
      user: admin,
      payload: { findByID: fakeFindByIDConfigChannel('ch-1') },
    } as unknown as PayloadRequest
    expect(await leadOfDeskChannelConfigUpdate({ req, id: 'config-1' } as any)).toBe(true)
  })

  test('lead of the config channel can update', async () => {
    const lead = { id: 'lead-1', role: 'editor', leadOfDesks: ['ch-1'] } as User
    const req = {
      user: lead,
      payload: { findByID: fakeFindByIDConfigChannel('ch-1') },
    } as unknown as PayloadRequest
    expect(await leadOfDeskChannelConfigUpdate({ req, id: 'config-1' } as any)).toBe(true)
  })

  test('non-lead cannot update', async () => {
    const editor2 = { id: 'editor-2', role: 'editor', leadOfDesks: ['ch-2'] } as User
    const req = {
      user: editor2,
      payload: { findByID: fakeFindByIDConfigChannel('ch-1') },
    } as unknown as PayloadRequest
    expect(await leadOfDeskChannelConfigUpdate({ req, id: 'config-1' } as any)).toBe(false)
  })

  test('missing id is denied for a non-admin', async () => {
    const lead = { id: 'lead-1', role: 'editor', leadOfDesks: ['ch-1'] } as User
    const req = {
      user: lead,
      payload: { findByID: fakeFindByIDConfigChannel('ch-1') },
    } as unknown as PayloadRequest
    expect(await leadOfDeskChannelConfigUpdate({ req } as any)).toBe(false)
  })
})

describe('leadOfDeskPieceCreate', () => {
  test('admin can create for any brief', async () => {
    const req = { user: admin, payload: { findByID: fakeFindByIDChannelOnly('ch-1') } } as unknown as PayloadRequest
    expect(await leadOfDeskPieceCreate({ req, data: { brief: 'brief-1' } } as any)).toBe(true)
  })

  test('lead of the brief channel can create', async () => {
    const lead = { id: 'lead-1', role: 'editor', leadOfDesks: ['ch-1'] } as User
    const req = { user: lead, payload: { findByID: fakeFindByIDChannelOnly('ch-1') } } as unknown as PayloadRequest
    expect(await leadOfDeskPieceCreate({ req, data: { brief: 'brief-1' } } as any)).toBe(true)
  })

  test('non-lead cannot create', async () => {
    const editor2 = { id: 'editor-2', role: 'editor', leadOfDesks: ['ch-2'] } as User
    const req = { user: editor2, payload: { findByID: fakeFindByIDChannelOnly('ch-1') } } as unknown as PayloadRequest
    expect(await leadOfDeskPieceCreate({ req, data: { brief: 'brief-1' } } as any)).toBe(false)
  })
})
