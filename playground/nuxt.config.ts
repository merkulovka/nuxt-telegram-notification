export default defineNuxtConfig({
  modules: ['../src/module'],
  devtools: { enabled: true },
  telegramNotify: {
    autoCapture: {
      enabled: true,
    },
    botToken: process.env.BOT_TOKEN,
    chatId: process.env.CHAT_ID,
  },
})
