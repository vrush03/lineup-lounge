import { jsonHandler } from '../src/server/http'
import { revealEstimate } from '../src/server/ballpark'

export const config = { runtime: 'edge' }

export default jsonHandler((body) => revealEstimate(body))
