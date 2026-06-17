const TEAM_ISO: Record<string, string> = {
  Algeria: 'DZ',
  Argentina: 'AR',
  Australia: 'AU',
  Austria: 'AT',
  Belgium: 'BE',
  Bolivia: 'BO',
  'Bosnia-Herzegovina': 'BA',
  Brazil: 'BR',
  Cameroon: 'CM',
  Canada: 'CA',
  Chile: 'CL',
  China: 'CN',
  Colombia: 'CO',
  'Costa Rica': 'CR',
  Croatia: 'HR',
  'Côte d\'Ivoire': 'CI',
  'Cote d\'Ivoire': 'CI',
  Curacao: 'CW',
  Czechia: 'CZ',
  'Czech Republic': 'CZ',
  Denmark: 'DK',
  Ecuador: 'EC',
  Egypt: 'EG',
  England: 'GB',
  France: 'FR',
  Germany: 'DE',
  Ghana: 'GH',
  Greece: 'GR',
  Haiti: 'HT',
  Honduras: 'HN',
  Iran: 'IR',
  Iraq: 'IQ',
  Italy: 'IT',
  Jamaica: 'JM',
  Japan: 'JP',
  Jordan: 'JO',
  'Korea Republic': 'KR',
  'South Korea': 'KR',
  Morocco: 'MA',
  Mexico: 'MX',
  Netherlands: 'NL',
  'New Zealand': 'NZ',
  Nigeria: 'NG',
  Norway: 'NO',
  Panama: 'PA',
  Paraguay: 'PY',
  Peru: 'PE',
  Poland: 'PL',
  Portugal: 'PT',
  Qatar: 'QA',
  Romania: 'RO',
  'Saudi Arabia': 'SA',
  Scotland: 'GB',
  Senegal: 'SN',
  Serbia: 'RS',
  Slovakia: 'SK',
  Slovenia: 'SI',
  Spain: 'ES',
  Sweden: 'SE',
  Switzerland: 'CH',
  Tunisia: 'TN',
  Turkey: 'TR',
  Ukraine: 'UA',
  'United Arab Emirates': 'AE',
  'United States': 'US',
  USA: 'US',
  Uruguay: 'UY',
  Uzbekistan: 'UZ',
  Venezuela: 'VE',
  Wales: 'GB',
}

const NORMALIZED_TEAM_ISO = Object.fromEntries(
  Object.entries(TEAM_ISO).map(([name, iso]) => [name.toLowerCase(), iso])
)

export function isoToFlag(iso: string): string {
  const code = iso.toUpperCase()
  if (code.length !== 2) return '⚽'
  return [...code]
    .map((char) => String.fromCodePoint(0x1f1e6 - 65 + char.charCodeAt(0)))
    .join('')
}

export function teamToFlag(teamName: string): string {
  const trimmed = teamName.trim()
  if (!trimmed || trimmed === 'TBD') return '⚽'

  const direct = TEAM_ISO[trimmed]
  if (direct) return isoToFlag(direct)

  const normalized = NORMALIZED_TEAM_ISO[trimmed.toLowerCase()]
  if (normalized) return isoToFlag(normalized)

  return '⚽'
}

export function fixtureFlags(homeTeam: string, awayTeam: string): string {
  return `${teamToFlag(homeTeam)}${teamToFlag(awayTeam)}`
}
