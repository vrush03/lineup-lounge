/**
 * Wraps a pure function as an API handler: JSON in, JSON out. The function returns null for a
 * request it can't make sense of, which becomes a 400.
 */
export function jsonHandler(run: (body: unknown) => unknown): (request: Request) => Promise<Response> {
  return async (request) => {
    if (request.method !== 'POST') return reply({ error: 'POST only' }, 405)
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return reply({ error: 'Bad JSON' }, 400)
    }
    const result = run(body)
    return result === null ? reply({ error: 'Bad request' }, 400) : reply(result, 200)
  }
}

const reply = (data: unknown, status: number) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })

export const isObject = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x)
export const isStrings = (x: unknown): x is string[] => Array.isArray(x) && x.every((s) => typeof s === 'string')
