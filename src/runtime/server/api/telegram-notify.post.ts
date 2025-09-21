import { BOT_TOKEN, CHAT_ID } from '#telegram-notify/server-options'
import {
  defineEventHandler,
  readBody,
  createError,
  getRequestIP,
  setHeader,
} from 'h3'
import type { NotifyPayload, NotifyType } from '~/src/runtime/types'

import { useRuntimeConfig } from "#imports";

const EMOJI: Record<NotifyType, string> = {
  info: 'ℹ️',
  success: '✅',
  warning: '⚠️',
  error: '❌',
}

// Telegram ограничивает длину сообщения 4096 символами
const MAX_LEN = 4096

function escapeHtml(s: string) {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function sanitizeHashtag(raw: string): string {
  const t = raw.trim().replace(/^#+/u, '') // убираем ведущие #
  const noSpaces = t.replace(/\s+/gu, '') // убираем пробелы/табуляции/переводы
  return `#${noSpaces}`
}

function firstLines(s: string, maxLines = 3) {
  return s.split(/\r?\n/u).filter(Boolean).slice(0, maxLines).join('\n')
}

function clip(s: string, limit = MAX_LEN - 16) {
  if (s.length <= limit) return s
  return s.slice(0, limit) + '…'
}

/** ------------ In-memory rate limiting (fixed window) ------------ */
interface Bucket {
  count: number
  resetAt: number
}

const ipBuckets = new Map<string, Bucket>()

function takeToken(ip: string, windowSec: number, maxPerIp: number) {
  const now = Date.now()
  // конец текущего окна
  const windowEnd
    = Math.floor(now / (windowSec * 1000)) * windowSec * 1000 + windowSec * 1000
  const b = ipBuckets.get(ip)
  if (!b || now > b.resetAt) {
    const next: Bucket = { count: 1, resetAt: windowEnd }
    ipBuckets.set(ip, next)
    return { allowed: true, remaining: maxPerIp - 1, resetAt: next.resetAt }
  }
  if (b.count >= maxPerIp) {
    return { allowed: false, remaining: 0, resetAt: b.resetAt }
  }
  b.count += 1
  return { allowed: true, remaining: maxPerIp - b.count, resetAt: b.resetAt }
}

/** ---------------------------------------------------------------- */

export default defineEventHandler(async (event) => {
  const cfg = useRuntimeConfig(event) as any

  const telegram = cfg.public.telegramNotify

  if (!BOT_TOKEN) {
    throw createError({
      statusCode: 500,
      statusMessage: '[telegram] Missing botToken in runtimeConfig',
    })
  }

  // Rate-limit per IP
  const windowSec: number = Number(telegram.rateLimitWindowSec)
  const maxPerIp: number = Number(telegram.rateLimitPerIp)
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  const decision = takeToken(ip, windowSec, maxPerIp)
  const retryAfter = Math.max(
    0,
    Math.ceil((decision.resetAt - Date.now()) / 1000),
  )
  setHeader(event, 'X-RateLimit-Limit', String(maxPerIp))
  setHeader(event, 'X-RateLimit-Remaining', String(decision.remaining))
  setHeader(
    event,
    'X-RateLimit-Reset',
    String(Math.floor(decision.resetAt / 1000)),
  )
  if (!decision.allowed) {
    setHeader(event, 'Retry-After', retryAfter)
    throw createError({
      statusCode: 429,
      statusMessage: `Too Many Requests (try again in ${retryAfter}s)`,
    })
  }

  const body = await readBody<NotifyPayload & { type?: NotifyType }>(event)
  const type = body?.type

  if (!type || !['info', 'success', 'warning', 'error'].includes(type)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid "type"' })
  }
  if (!body.title) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Field "title" is required',
    })
  }

  const emoji = EMOJI[type]
  const tags
    = Array.isArray(body.tags) && body.tags.length
      ? body.tags.map(sanitizeHashtag).join(' ')
      : ''

  // Обрезаем stack до 2–3 строк и отправляем как кодовый блок
  const stackPart = body.stack ? firstLines(String(body.stack), 3) : ''

  // Формат: Теги → title → description → stack (кодовый блок)
  const parts: string[] = []
  if (tags) parts.push(escapeHtml(tags))
  parts.push(`<b>${emoji} ${escapeHtml(body.title)}</b>`)
  if (body.description) parts.push(escapeHtml(body.description))
  if (body.url) parts.push(`<b>Url: ${escapeHtml(body.url)}</b>`)
  if (stackPart)
    parts.push(
      `<b>stack</b>\n<pre><code>${escapeHtml(stackPart)}</code></pre>`,
    )

  let text = parts.join('\n\n')
  text = clip(text, MAX_LEN)

  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`

  if (!CHAT_ID) {
    throw createError({
      statusCode: 400,
      statusMessage:
        'chatId is required (runtimeConfig.telegram.chatId or in request body)',
    })
  }

  // Поддержка forum topics (message_thread_id)
  const messageThreadId
    = typeof body.threadId !== 'undefined' ? body.threadId : telegram.threadId

  try {
    const res = await $fetch(url, {
      method: 'POST',
      body: {
        chat_id: CHAT_ID,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        ...(messageThreadId ? { message_thread_id: messageThreadId } : {}),
      },
    })
    return { ok: true, telegram: res }
  }
  catch (e: any) {
    console.log(e)
    throw createError({
      statusCode: 502,
      statusMessage: `Telegram API error: ${e?.data?.description || e?.message || 'unknown'}`,
    })
  }
})
