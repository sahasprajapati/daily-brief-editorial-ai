/** True when there's no real OpenAI key configured — local/dev without OPENAI_API_KEY, or
 *  an explicit OPENAI_STUB=1 override. Mirrors cms-client's isCmsStub() and provider-client's
 *  isNewsHqStub() — same idea, same degrade-to-stub-instead-of-crash approach. */
export function isOpenAiStub(): boolean {
  const key = process.env.OPENAI_API_KEY
  return !key || key.includes('your') || key.includes('example') || process.env.OPENAI_STUB === '1'
}
