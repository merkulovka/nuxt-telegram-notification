// Telegram MarkdownV2 требует экранировать спецсимволы
// https://core.telegram.org/bots/api#markdownv2-style
const specials = /([_*[\]()~`>#+\-=|{}.!\\])/g

export function escapeMarkdownV2(input: string) {
  return input.replace(specials, '\\$1')
}

export function prettyKV(obj: Record<string, any>) {
  // короткий human-readable формат key/value, всё экранируем
  return Object.entries(obj)
    .map(([k, v]) => `• *${escapeMarkdownV2(k)}*: ${escapeMarkdownV2(stringify(v))}`)
    .join('\n')
}

function stringify(v: any): string {
  try {
    if (typeof v === 'string') return v
    return JSON.stringify(v, null, 2)
  }
  catch {
    return String(v)
  }
}
