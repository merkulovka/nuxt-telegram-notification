export type NotifyType = 'info' | 'success' | 'warning' | 'error'

export interface NotifyPayload {
  title: string
  description?: string
  tags?: string[]
  url?: string
  /** На клиенте можно передать Error или строку; на сервер уедет строка */
  stack?: string
  /** Переопределение получателя */
  chatId?: string | number
  /** Переопределение темы (topics) в супер-группах */
  threadId?: number
}
