<script setup lang="ts">
import { ref, onMounted } from 'vue'
import axios from 'axios'

const platform = ref('Web')
const message = ref('正在连接后端...')

onMounted(async () => {
  try {
    // 通过网关访问 auth 服务的 hello 接口
    const res = await axios.get('/api/auth/api/hello')
    message.value = res.data.data // res.data 是后端传来的 Result，里面的 data 才是字符串
  } catch {
    message.value = '连接失败'
  }
})

onMounted(() => {
  // 如果是在 Electron 环境下运行
  if (window.electronAPI) {
    platform.value = window.electronAPI.platform
    window.electronAPI.sayHello()
  }
})
</script>

<template>
  <h1>Coo!</h1>
  <p>后端传来的话：{{ message }}</p>
  <p>当前平台：{{ platform }}</p>
</template>

<style scoped></style>
