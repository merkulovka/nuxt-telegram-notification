import { useRuntimeConfig } from '#imports'
import type { NotifyPayload, NotifyType } from '../types'

type SendPayload = Omit<NotifyPayload, 'stack'> & { stack?: string | Error }

/** Нормализуем stack — поддержка Error и строк */
const normalizeStack = (stack?: string | Error): string | undefined => {
  if (!stack) return undefined
  if (typeof stack === 'string') return stack
  return stack.stack || stack.message || String(stack)
}

export function useTelegramNotify() {
  const config = useRuntimeConfig()

  const options = { ...config.public.telegramNotify }
  const send = async (type: NotifyType, payload: SendPayload) => {
    const body: NotifyPayload & { type: NotifyType } = {
      type,
      title: payload.title,
      description: payload.description,
      tags: payload.tags,
      url: payload.url,
      stack: normalizeStack(payload.stack),
      chatId: payload.chatId,
      threadId: payload.threadId,
    }

    return await $fetch(options.apiUrl, { method: 'POST', body })
  }

  return {
    info: (p: SendPayload) => send('info', p),
    success: (p: SendPayload) => send('success', p),
    warning: (p: SendPayload) => send('warning', p),
    error: (p: SendPayload) => send('error', p),
  }
}
