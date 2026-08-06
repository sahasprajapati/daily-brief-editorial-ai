import { z } from 'zod'

export const generatedPieceSchema = z.object({
  blocks: z.array(
    z.object({
      type: z.enum(['heading', 'paragraph']),
      text: z.string(),
    }),
  ),
})

export type GeneratedPieceBlocks = z.infer<typeof generatedPieceSchema>
