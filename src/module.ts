import {
  defineNuxtModule,
  addImportsDir,
  createResolver,
  addServerHandler,
  addTemplate,
  addPlugin,
} from '@nuxt/kit'
import defu from 'defu'

export type * from './runtime/types'
/**
 * Опции конфигурации для модуля `nuxt-telegram-notify`.
 */
export interface ModuleOptions {
  /**
   * Включен ли модуль.
   *
   * Если `false`, модуль не регистрирует эндпоинт, композаблы и плагины.
   *
   * @defaultValue `true`
   */
  enabled: boolean

  /**
   * Токен телеграм-бота для отправки сообщений.
   *
   * ⚠️ Секретное значение, будет храниться только в серверных переменных окружения.
   */
  botToken: string

  /**
   * ID чата (или канала/группы), куда будут отправляться уведомления.
   *
   * Может быть отрицательным числом (для супергрупп), либо строкой вида `@username`.
   *
   * ⚠️ Секретное значение, будет храниться только в серверных переменных окружения.
   */
  chatId: string

  /**
   * URL серверного хука, куда будет уходить запрос
   * на отправку оповещения в телеграм
   *
   * @defaultValue /api/telegram-notify
   */
  apiUrl?: string

  /**
   * Количество запросов, допустимое с одного IP в пределах окна rate-limit.
   *
   * Используется для защиты серверного эндпоинта от DDoS.
   *
   * @defaultValue `30`
   */
  rateLimitPerIp?: number

  /**
   * Размер окна rate-limit (в секундах).
   *
   * Например, при `rateLimitPerIp = 30` и `rateLimitWindowSec = 10`
   * с одного IP можно отправить максимум 30 запросов за 10 секунд.
   *
   * @defaultValue `10`
   */
  rateLimitWindowSec?: number

  /**
   * Окно дедупликации (в секундах).
   *
   * На сервере одинаковые сообщения в пределах этого окна
   * будут игнорироваться, чтобы не засорять чат.
   *
   * @defaultValue `10`
   */
  dedupeWindowSec?: number

  /**
   * Настройки автоматического сбора ошибок на клиенте.
   */
  autoCapture: {
    /**
     * Включить ли автоматический сбор ошибок.
     *
     * При `true` регистрируется клиентский плагин,
     * который слушает ошибки Vue, window и промисов.
     *
     * @defaultValue `false`
     */
    enabled: boolean

    /**
     * Ловить ли ошибки Vue/Nuxt через хуки `vue:error` и `app:error`.
     *
     * @defaultValue `true`
     */
    includeVueErrors?: boolean

    /**
     * Ловить ли глобальные ошибки браузера через `window.onerror`.
     *
     * @defaultValue `true`
     */
    includeWindowError?: boolean

    /**
     * Ловить ли необработанные отклонения промисов через `unhandledrejection`.
     *
     * @defaultValue `true`
     */
    includeUnhandledRejection?: boolean

    /**
     * Перехватывать ли `console.error` и отправлять сообщения
     * в Telegram при каждом вызове.
     *
     * Может сильно зашумить чат.
     *
     * @defaultValue `false`
     */
    captureConsoleError?: boolean

    /**
     * Доля событий, которые реально будут отправляться.
     *
     * Используется для семплинга — чтобы не отправлять каждую ошибку.
     * Значение от `0` до `1`. Например: `0.5` → только 50% событий.
     *
     * @defaultValue `1`
     */
    sampleRate?: number

    /**
     * Окно дедупликации одинаковых ошибок на клиенте (в миллисекундах).
     *
     * Если за это время возникает одинаковая ошибка,
     * она будет проигнорирована.
     *
     * @defaultValue `5000`
     */
    dedupeWindowMs?: number

    /**
     * Список строковых паттернов или регулярных выражений (как строки),
     * которые будут использоваться для фильтрации «шумных» ошибок.
     *
     * Например: `['ResizeObserver loop limit exceeded']`.
     */
    ignorePatterns?: string[]
  }
}

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: 'nuxt-telegram-notification',
    configKey: 'telegramNotify',
    compatibility: { nuxt: '^3.0.0 || ^4.0.0' },
  },
  defaults: {
    enabled: false,
    apiUrl: '/api/telegram-notify',
    rateLimitPerIp: 10,
    rateLimitWindowSec: 60,
    dedupeWindowSec: 30,
    autoCapture: {
      enabled: false,
      includeVueErrors: true,
      includeWindowError: true,
      includeUnhandledRejection: true,
      captureConsoleError: false,
      sampleRate: 1,
      dedupeWindowMs: 5000,
      ignorePatterns: ['ResizeObserver loop limit exceeded'],
    },
  },
  setup(options, nuxt) {
    const { resolve } = createResolver(import.meta.url)

    const { botToken, chatId } = options

    nuxt.options.runtimeConfig.public.telegramNotify = defu(
      nuxt.options.runtimeConfig.public.telegramNotify,
      {
        apiUrl: options.apiUrl,
        rateLimitPerIp: options.rateLimitPerIp,
        rateLimitWindowSec: options.rateLimitWindowSec,
        dedupeWindowSec: options.dedupeWindowSec,
        autoCapture: options.autoCapture,
      },
    )

    nuxt.hooks.hook('nitro:config', (nitroConfig) => {
      nitroConfig.virtual ||= {}
      nitroConfig.virtual['#telegram-notify/server-options'] = `
        export const BOT_TOKEN = ${JSON.stringify(botToken)};
        export const CHAT_ID   = ${JSON.stringify(chatId)};
      `.trim()
    })
    addImportsDir(resolve('./runtime/composables'))

    addPlugin({
      src: resolve('./runtime/plugins/telegram-auto-capture.client'),
      mode: 'client',
    })

    addServerHandler({
      route: options.apiUrl,
      handler: resolve('./runtime/server/api/telegram-notify.post'),
    })

    // types (как было)
    addTemplate({
      filename: 'telegram-notify.d.ts',
      getContents: () =>
        `declare module '#telegram-notify' { export type * from '${resolve('./runtime/types')}' }`,
    })
  },
})
