<template>
  <main>
    <button @click="sendAll">
      Send error
    </button>

    <button @click="createNativeError">
      Native error
    </button>

    <NuxtLink to="/components"> Components </NuxtLink>
  </main>
</template>

<script setup lang="ts">
import { useTelegramNotify } from '#imports'

const notifier = useTelegramNotify()

const sendAll = async () => {
  await notifier.info({
    tags: ['Инфра'],
    title: 'Деплой завершён',
    description: 'Новый релиз доступен в продакшене.',
  })

  await notifier.success({
    tags: ['Регистрация'],
    title: 'Пользователь успешно зарегистрирован',
    description: 'userId=12345',
  })

  await notifier.warning({
    tags: ['ЛимитыAPI'],
    title: 'Подходим к лимиту',
    description: 'Осталось 5% квоты на сегодня.',
  })

  try {
    throw new Error('Payment failed: insufficient funds')
  }
  catch (e: any) {
    await notifier.error({
      tags: ['ОшибкаОплаты'],
      title: 'Ошибка оплаты',
      description: 'Платёж не прошёл',
      stack: e, // можно передать Error — возьмётся первые 2–3 строки
    })
  }
}

function createNativeError() {
  console.log(qwe)
}
</script>
