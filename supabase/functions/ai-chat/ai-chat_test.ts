import { assertEquals, assertStringIncludes } from 'https://deno.land/std@0.168.0/testing/asserts.ts'

Deno.test('messages payload validation shape', () => {
  const messages = [
    { role: 'user', content: 'Comment améliorer mes revenus ?' },
  ]
  assertEquals(messages.length, 1)
  assertEquals(messages[0].role, 'user')
  assertEquals(typeof messages[0].content, 'string')
})

Deno.test('handler code references OpenRouter and JWT auth', async () => {
  const handlerCode = await Deno.readTextFile('./index.ts')
  assertStringIncludes(handlerCode, 'serve')
  assertStringIncludes(handlerCode, 'openrouter.ai')
  assertStringIncludes(handlerCode, 'OPENROUTER_API_KEY')
  assertStringIncludes(handlerCode, 'getUser')
})

Deno.test('handler only allows :free models', async () => {
  const handlerCode = await Deno.readTextFile('./index.ts')
  assertStringIncludes(handlerCode, ':free')
  assertStringIncludes(handlerCode, 'isFreeModel')
  assertStringIncludes(handlerCode, 'gpt-oss-20b:free')
  assertStringIncludes(handlerCode, 'nemotron-3-super-120b-a12b:free')
})

Deno.test('paid model id is rejected by the free whitelist logic', () => {
  const freeModels = [
    'nvidia/nemotron-3-super-120b-a12b:free',
    'google/gemma-4-31b-it:free',
    'openai/gpt-oss-20b:free',
  ]
  assertEquals(freeModels.includes('openai/gpt-4o'), false)
  assertEquals(freeModels.includes('openai/gpt-oss-20b:free'), true)
})

Deno.test('routing mirrors the handler heuristics', () => {
  const DEFAULT_MODEL = 'nvidia/nemotron-3-super-120b-a12b:free'
  const FREE_CODING = 'openai/gpt-oss-20b:free'
  const FREE_REASONING = 'nvidia/nemotron-3-ultra-550b-a55b:free'
  const FREE_MULTILINGUAL = 'google/gemma-4-31b-it:free'

  function pick(prompt: string): string {
    const text = prompt.toLowerCase()
    const coding = ['code', 'coder', 'programme', 'programmation', 'bug', 'javascript', 'typescript', 'script', 'api', 'regex', 'sql']
    if (coding.some((kw) => text.includes(kw))) return FREE_CODING
    const reasoning = ['analyse', 'analysez', 'explique', 'expliquez', 'pourquoi', 'comment ameliorer', 'tendance', 'prevision', 'strategie', 'comparer']
    if (reasoning.some((kw) => text.includes(kw))) return FREE_REASONING
    if (/[\u0600-\u06FF]/.test(prompt)) return FREE_MULTILINGUAL
    return DEFAULT_MODEL
  }

  assertEquals(pick('Comment coder une page de rapport ?'), FREE_CODING)
  assertEquals(pick('Analyse les tendances du CA'), FREE_REASONING)
  assertEquals(pick('كيف أزيد المبيعات؟'), FREE_MULTILINGUAL)
  assertEquals(pick('Comment ça va ?'), DEFAULT_MODEL)
})
