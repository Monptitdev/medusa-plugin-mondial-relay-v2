const SECRET_PATTERNS: Array<[RegExp, string]> = [
  [/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, "Bearer [redacted]"],
  [/Basic\s+[A-Za-z0-9+/]+=*/gi, "Basic [redacted]"],
  [/(<Password>)[\s\S]*?(<\/Password>)/gi, "$1[redacted]$2"],
  [/(<Login>)[\s\S]*?(<\/Login>)/gi, "$1[redacted]$2"],
  [/(<Security>)[\s\S]*?(<\/Security>)/gi, "$1[redacted]$2"],
  [/([?&](?:crc|signature|hash|token|access_token|key)=)[^&\s'"]+/gi, "$1[redacted]"],
]

/**
 * Masque jetons, empreintes, clés et XML signé avant un log.
 * Ne jamais journaliser la valeur d'origine.
 */
export function redactSensitive(value: string): string {
  return SECRET_PATTERNS.reduce(
    (text, [pattern, replacement]) => text.replace(pattern, replacement),
    value
  )
}
