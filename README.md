# nuxt-telegram-notification

Модуль для Nuxt 3/4 для отправки уведомлений в Telegram с поддержкой авто-сбора ошибок, rate-limit и скрытием `botToken`/`chatId` на сервере.

---

## ✨ Возможности

- Композабл `useTelegramNotify()` для отправки сообщений: `info`, `success`, `warning`, `error`.
- Автоматический сбор ошибок (Vue, window, unhandledRejection, console.error).
- Rate-limit per-IP (защита от DDoS).
- Дедупликация сообщений (на клиенте и сервере).
- Поддержка тегов, `threadId`, override `chatId`.
- Сообщения форматируются: эмодзи, title, description, stack как кодовый блок.

---

## 🚀 Установка

Добавьте модуль в проект Nuxt:

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: [
    '~/modules/nuxt-telegram-notification',
  ],
  telegramNotify:
    {
      enabled: true,
      botToken: process.env.TELEGRAM_BOT_TOKEN!,
      chatId: process.env.TELEGRAM_CHAT_ID!,
      apiUrl: '/api/telegram-notify',
      rateLimitPerIp: 30,
      rateLimitWindowSec: 10,
      dedupeWindowSec: 10,
      autoCapture: {
        enabled: true,
        includeVueErrors: true,
        includeWindowError: true,
        includeUnhandledRejection: true,
        captureConsoleError: false,
        sampleRate: 1,
        dedupeWindowMs: 5000,
        ignorePatterns: ['ResizeObserver loop limit exceeded']
      }
    }
})
```

Добавьте в `.env`:

```env
TELEGRAM_BOT_TOKEN=123:ABC...
TELEGRAM_CHAT_ID=-1001234567890
```

---

## 📦 Использование

В любом компоненте:

```vue
<script setup lang="ts">
const notifier = useTelegramNotify()

await notifier.info({
  tags: ['Инфра'],
  title: 'Деплой завершён',
  description: 'Новый релиз доступен'
})

try {
  throw new Error('Payment failed: insufficient funds\nat pay() ...')
} catch (e) {
  await notifier.error({
    tags: ['ОшибкаОплаты'],
    title: 'Ошибка оплаты',
    description: 'Платёж не прошёл',
    stack: e,
    threadId: 12345
  })
}
</script>
```

### API композабла

```ts
useTelegramNotify().info(payload)
useTelegramNotify().success(payload)
useTelegramNotify().warning(payload)
useTelegramNotify().error(payload)
```

**payload:**

```ts
{
  title: string
  description?: string
  tags?: string[]
  stack?: string | Error
  chatId?: string | number
  threadId?: number
}
```

---

## ⚙️ Автосбор ошибок

Если `autoCapture.enabled: true`, модуль автоматически:

- ловит ошибки Vue/Nuxt (`vue:error`, `app:error`),
- слушает `window.onerror`,
- слушает `unhandledrejection`,
- (опционально) патчит `console.error`.

Параметры:

- `sampleRate` — 0..1 (семплинг),
- `dedupeWindowMs` — окно дедупликации на клиенте,
- `ignorePatterns` — список строк/регэкспов для фильтрации шумных ошибок.

---

## 🔒 Rate-limit / DDoS защита

- `rateLimitPerIp` — число запросов,
- `rateLimitWindowSec` — окно (секунды).

При превышении: `429 Too Many Requests`, заголовки `X-RateLimit-*` и `Retry-After`.

⚠️ In-memory реализация. Для продакшена с несколькими инстансами используйте Redis/Upstash.

---

## 📑 Формат сообщений

- Теги → Title (эмодзи + жирный) → description → stack.
- Stack → `<pre><code>...</code></pre>` (первые 2–3 строки).
- Эмодзи: info ℹ️, success ✅, warning ⚠️, error ❌.

