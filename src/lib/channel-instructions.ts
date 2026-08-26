/** A channel's "extra QA/writing instructions" are two things combined into one prompt
 *  addition: an optional major reference document (uploaded whole, extracted client-side —
 *  see MajorFileSlot) plus a list of short itemized instructions (see InstructionBoxList).
 *  The major doc, if any, comes first since it's the authoritative reference; itemized notes
 *  follow as supplementary call-outs. Shared by the two prompt-injection call sites so they
 *  can't drift: src/lib/generation/index.ts and src/app/(dashboard)/pieces/[id]/actions.ts. */
export function joinChannelInstructions(
  majorFileText: string | null | undefined,
  items: string[] | null | undefined,
): string {
  return [majorFileText?.trim(), ...(items ?? [])].filter(Boolean).join('\n\n')
}
