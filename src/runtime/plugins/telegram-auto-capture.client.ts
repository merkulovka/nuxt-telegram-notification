import { defineNuxtPlugin } from '#app'
import { useRuntimeConfig, useTelegramNotify } from '#imports'

export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig()

  const options = { ...config.public.telegramNotify.autoCapture }
  const apiUrl = config.public.telegramNotify.apiUrl

  if (!options?.enabled) return

  const notifier = useTelegramNotify()

  const dedupe = new Map<string, number>()
  const now = () => Date.now()
  const dedupeWindow = Number(options.dedupeWindowMs ?? 5000)

  const matchesIgnore = (msg: string) => {
    const patterns: (string | RegExp)[] = Array.isArray(options.ignorePatterns)
      ? options.ignorePatterns.map((p: any) => {
          if (p instanceof RegExp) return p
          try {
            return new RegExp(String(p), 'i')
          }
          catch {
            return new RegExp('^$')
          }
        })
      : []
    return patterns.some(re => re.test(msg)) || msg.includes(apiUrl)
  }

  const toStack = (e: unknown): string => {
    if (!e) return ''
    if (typeof e === 'string') return e
    if (e instanceof Error) return e.stack || e.message
    try {
      return JSON.stringify(e)
    }
    catch {
      return String(e)
    }
  }

  const firstLine = (s: string) => (s.split('')[0] || '').trim()

  const send = (title: string, err: unknown, info?: string) => {
    const stack = toStack(err)
    const head = firstLine(stack) || (err as any)?.message || String(err)
    const msgKey = `${title}:${head}`.slice(0, 200)
    if (matchesIgnore(msgKey)) return

    const last = dedupe.get(msgKey) || 0
    if (now() - last < dedupeWindow) return
    dedupe.set(msgKey, now())

    const sample = Math.max(0, Math.min(1, Number(options.sampleRate ?? 1)))
    if (Math.random() > sample) return

    notifier.error({
      tags: ['AutoCapture'],
      title: `${title}: ${head}`,
      description: info,
      url: window.location.href,
      stack, // сервер возьмёт первые 2–3 строки
    })
  }

  if (options.includeVueErrors) {
    nuxtApp.hook('vue:error', (err, _instance, info) => send('Vue error', err, String(info || '')))
    nuxtApp.hook('app:error', err => send('App error', err))
  }

  if (options.includeWindowError && import.meta.client) {
    window.addEventListener('error', (e) => {
      const ee = e as ErrorEvent
      if (ee?.filename && ee.filename.includes(apiUrl)) return
      send('Window error', ee.error || ee.message)
    })
  }

  if (options.includeUnhandledRejection && import.meta.client) {
    window.addEventListener('unhandledrejection', (e) => {
      send('Unhandled rejection', e.reason)
    })
  }

  if (options.captureConsoleError) {
    const orig = console.error
    console.error = (...args: any[]) => {
      try {
        const err = args.find(a => a instanceof Error) || new Error(args.map((a) => {
          try {
            if (typeof a === 'string') return a
            return JSON.stringify(a)
          }
          catch { return String(a) }
        }).join(' '))
        send('console.error', err)
      }
      catch (e: any) {
        console.log(e)
      }
      orig(...args)
    }
  }
})
