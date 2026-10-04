import { jsonHandler } from '../src/server/http'
import { markLineup } from '../src/server/lineup'

export const config = { runtime: 'edge' }

export default jsonHandler((body) => markLineup(body))
