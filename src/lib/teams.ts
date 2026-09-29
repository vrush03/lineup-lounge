import type { Format } from './types'

export type TeamStyle = { code: string; bg: string; fg: string }

const T = (code: string, bg: string, fg = '#ffffff'): TeamStyle => ({ code, bg, fg })

const TEAMS: Record<string, TeamStyle> = {
  // IPL franchises (current names; defunct sides kept for old records)
  'Chennai Super Kings': T('CSK', '#f6c300', '#1b2a5c'),
  'Mumbai Indians': T('MI', '#004ba0'),
  'Royal Challengers Bengaluru': T('RCB', '#c8102e'),
  'Royal Challengers Bangalore': T('RCB', '#c8102e'),
  'Kolkata Knight Riders': T('KKR', '#3a225d', '#f2c14e'),
  'Sunrisers Hyderabad': T('SRH', '#f26522', '#111111'),
  'Rajasthan Royals': T('RR', '#e5197e'),
  'Delhi Capitals': T('DC', '#17479e'),
  'Delhi Daredevils': T('DD', '#17479e'),
  'Punjab Kings': T('PBKS', '#d71920'),
  'Kings XI Punjab': T('KXIP', '#d71920'),
  'Lucknow Super Giants': T('LSG', '#0f67b1'),
  'Gujarat Titans': T('GT', '#1b2133', '#d8b46a'),
  'Deccan Chargers': T('DEC', '#2d3e6e', '#d9d9d9'),
  'Rising Pune Supergiant': T('RPS', '#6f2c91'),
  'Pune Warriors': T('PWI', '#2f9bd6'),
  'Gujarat Lions': T('GL', '#e04f16'),
  'Kochi Tuskers Kerala': T('KTK', '#f26f21'),

  // International sides
  India: T('IND', '#1c5bb8'),
  Australia: T('AUS', '#ffcd00', '#0b3d2e'),
  England: T('ENG', '#0e2a5c'),
  Pakistan: T('PAK', '#0b5d2a'),
  'South Africa': T('SA', '#007749', '#ffb612'),
  'New Zealand': T('NZ', '#111111'),
  'Sri Lanka': T('SL', '#1a3e8c', '#f6c300'),
  'West Indies': T('WI', '#7b1e3a', '#f2c14e'),
  Bangladesh: T('BAN', '#006a4e', '#f42a41'),
  Afghanistan: T('AFG', '#1f5fbf'),
  Zimbabwe: T('ZIM', '#d40000', '#ffd200'),
  Ireland: T('IRE', '#169b62'),
  Netherlands: T('NED', '#ff6f00'),
  Scotland: T('SCO', '#1b3d8f'),
  Kenya: T('KEN', '#006600'),
  Canada: T('CAN', '#d52b1e'),
  'United Arab Emirates': T('UAE', '#00732f'),
  'United States': T('USA', '#1f2f5c'),
  'United States of America': T('USA', '#1f2f5c'),
  Nepal: T('NEP', '#c8102e'),
  Namibia: T('NAM', '#003580'),
  Bermuda: T('BER', '#c8102e'),
  Oman: T('OMA', '#c8102e'),
  'Hong Kong': T('HK', '#c8102e'),
  'Papua New Guinea': T('PNG', '#111111', '#f6c300'),
  Uganda: T('UGA', '#111111', '#fcdc04'),
  Japan: T('JPN', '#bc002d'),
  Malaysia: T('MAS', '#010066', '#ffcc00'),
  Austria: T('AUT', '#c8102e'),
  Malawi: T('MWI', '#111111', '#ce1126'),
  Germany: T('GER', '#111111', '#ffce00'),
  Rwanda: T('RWA', '#00a1de', '#fad201'),
  Italy: T('ITA', '#0b3d91'),
  Jersey: T('JER', '#c8102e'),
  Qatar: T('QAT', '#8a1538'),
  Kuwait: T('KUW', '#007a3d'),
  Singapore: T('SIN', '#c8102e'),
  Tanzania: T('TAN', '#1eb53a'),
  Nigeria: T('NGA', '#008751'),
  'Saudi Arabia': T('KSA', '#006c35'),
  Bahrain: T('BHR', '#ce1126'),
  Denmark: T('DEN', '#c8102e'),
  Guernsey: T('GUE', '#c8102e'),
  'Cayman Islands': T('CAY', '#1f2f5c'),
}

/** Whether a team has its own colours (anything else falls back to a neutral badge). */
export const hasTeamStyle = (team: string) => team in TEAMS

export function teamStyle(team?: string, fallbackLabel?: string): TeamStyle {
  if (team && TEAMS[team]) return TEAMS[team]
  const src = team ?? fallbackLabel ?? '?'
  const code = src
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 3)
    .toUpperCase()
  return T(code || '?', '#4b5a53')
}

export const FORMAT_STYLE: Record<Format, { bg: string; fg: string; label: string }> = {
  Test: { bg: '#f6efe2', fg: '#8a1c22', label: 'Test' },
  ODI: { bg: '#1d4ed8', fg: '#ffffff', label: 'ODI' },
  T20I: { bg: '#6d28d9', fg: '#ffffff', label: 'T20I' },
  IPL: { bg: '#ea580c', fg: '#ffffff', label: 'IPL' },
  'World Cup': { bg: '#b7862b', fg: '#ffffff', label: 'World Cup' },
  'T20 World Cup': { bg: '#0e7490', fg: '#ffffff', label: 'T20 World Cup' },
}
