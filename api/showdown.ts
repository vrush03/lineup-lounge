import { jsonHandler } from '../src/server/http'
import { showdownView } from '../src/server/showdown'

export const config = { runtime: 'edge' }

/** Mixed into every deal, so the hands can't be worked out from the seed alone. Set it in Vercel. */
const secret = process.env.SHOWDOWN_SECRET ?? ''

export default jsonHandler((body) => showdownView(body, secret))
