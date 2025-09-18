<script setup lang="ts">
const error = useError() // Nuxt composable: текущая ошибка
const { error: sendError } = useTelegramNotify()

// Отправляем нотификацию только на клиенте (чтобы SSR не спамил)
if (import.meta.client && error.value) {
  sendError('Nuxt Error Page', {
    name: error.value.name,
    message: error.value.message,
    stack: error.value.stack,
    url: window.location.href,
  })
}

function handleBack() {
  clearError({ redirect: '/' }) // встроенный способ Nuxt очистить ошибку
}
</script>

<template>
  <div class="min-h-screen flex flex-col items-center justify-center p-6 text-center">
    <h1 class="text-3xl font-bold mb-4">
      Упс! Что-то пошло не так 😢
    </h1>
    <p class="mb-6">
      {{ error?.statusCode }} — {{ error?.message }}
    </p>
    <button
      class="rounded-xl bg-blue-600 text-white px-6 py-2 hover:bg-blue-700 transition"
      @click="handleBack"
    >
      На главную
    </button>
  </div>
</template>
