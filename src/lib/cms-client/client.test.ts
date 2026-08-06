import { describe, expect, mock, test } from 'bun:test'
import { createCmsClient } from './client'
import type { AxiosInstance } from 'axios'

function makeHttpMock(overrides: Partial<AxiosInstance> = {}): AxiosInstance {
  return {
    get: mock(),
    post: mock(),
    ...overrides,
  } as unknown as AxiosInstance
}

const config = { baseUrl: 'https://cms.test', apiKey: 'test-key' }

describe('createCmsClient.listChannels', () => {
  test('maps channel docs to the CmsChannel shape', async () => {
    const http = makeHttpMock({
      get: mock().mockResolvedValue({
        data: { docs: [{ id: 'ch-1', name: 'TRT World', languageCode: 'en', language: 'English' }] },
      }) as any,
    })
    const client = createCmsClient(config, http)

    const channels = await client.listChannels()

    expect(channels).toEqual([{ id: 'ch-1', name: 'TRT World', languageCode: 'en', language: 'English' }])
    expect(http.get).toHaveBeenCalledWith('/api/channels', { params: { limit: 100 } })
  })

  test('returns the local channel seed when CMS is stubbed (placeholder base URL)', async () => {
    const http = makeHttpMock({ get: mock() as any })
    const client = createCmsClient({ baseUrl: 'https://cms.trt-global.example', apiKey: '' }, http)

    const channels = await client.listChannels()

    expect(http.get).not.toHaveBeenCalled()
    expect(channels.length).toBeGreaterThan(40)
    expect(channels[0]).toMatchObject({
      id: '6687d8652afdd9db96127591',
      name: 'Turkish',
      languageCode: 'tr',
    })
    expect(channels.find((c) => c.name === 'World')?.id).toBe('6687d8472afdd9db961274e1')
  })
})

describe('createCmsClient.searchContent', () => {
  test('builds a Payload where[title][like] query', async () => {
    const http = makeHttpMock({ get: mock().mockResolvedValue({ data: { docs: [] } }) as any })
    const client = createCmsClient(config, http)

    await client.searchContent('earthquake', { channelId: 'ch-1', limit: 3 })

    expect(http.get).toHaveBeenCalledWith('/api/contents', {
      params: {
        limit: 3,
        'where[title][like]': 'earthquake',
        'where[channel][equals]': 'ch-1',
      },
    })
  })

  test('omits the channel filter when no channelId is given', async () => {
    const http = makeHttpMock({ get: mock().mockResolvedValue({ data: { docs: [] } }) as any })
    const client = createCmsClient(config, http)

    await client.searchContent('earthquake')

    expect(http.get).toHaveBeenCalledWith('/api/contents', {
      params: { limit: 5, 'where[title][like]': 'earthquake' },
    })
  })
})

describe('createCmsClient.createArticle', () => {
  test('converts paragraphs to Lexical JSON and posts to packages/create', async () => {
    const http = makeHttpMock({
      post: mock().mockResolvedValue({ data: { id: 'pkg-1', contents: ['content-1'] } }) as any,
    })
    const client = createCmsClient(config, http)

    const result = await client.createArticle({
      title: 'Gaza ceasefire talks resume',
      description: 'Coverage of renewed mediation',
      paragraphs: ['Paragraph one.', 'Paragraph two.'],
    })

    expect(result).toEqual({ packageId: 'pkg-1', contentId: 'content-1' })
    const [path, body] = (http.post as any).mock.calls[0]
    expect(path).toBe('/api/packages/create')
    expect(body.title).toBe('Gaza ceasefire talks resume')
    expect(body.content.root.children).toHaveLength(2)
  })
})
