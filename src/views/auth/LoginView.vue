<script setup lang="ts">
import { ref, reactive } from 'vue'
import { MessageCircle, Loader2 } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { useRouter } from 'vue-router'

import {
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ValidatedInput } from '@/components/ui/validated-input'
import { usePlatform } from '@/composables/usePlatform'
import { authApi } from '@/api/auth'
import { useRequestManager } from '@/composables/useRequestManager'
import { logger } from '@/utils/logger'

const { p, isElectron } = usePlatform()
const router = useRouter()
useRequestManager()

const loading = ref(false)
const userValid = ref(false)
const passValid = ref(false)

const userPattern = /^[a-zA-Z0-9][a-zA-Z0-9_]{3,15}$/
const passPattern = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,20}$/

const loginForm = reactive({
  username: '',
  password: '',
})

const handleLogin = async () => {
  if (!userValid.value || !passValid.value) {
    toast.error('请输入正确的账号和密码')
    return
  }

  loading.value = true

  try {
    await authApi.login(loginForm).then(() => {
      loading.value = false
      toast.success('登录成功')
      if (isElectron) {
        p.send('login-success')
        return
      }
      router.push('/')
    })
  } catch (error) {
    loading.value = false
    logger.error('Login failed', error)
  }
}
</script>

<template>
  <div class="flex flex-col h-full">
    <CardHeader class="text-center pt-10 mb-8">
      <div class="flex justify-center mb-4" style="-webkit-app-region: no-drag">
        <div class="rounded-2xl bg-primary p-3 shadow-lg shadow-primary/20">
          <MessageCircle class="h-8 w-8 text-primary-foreground" />
        </div>
      </div>
      <CardTitle class="text-2xl font-bold">Coo Chat</CardTitle>
      <CardDescription>每一条消息，都有它的温度</CardDescription>
    </CardHeader>

    <CardContent class="grid gap-4 flex-1 mb-4">
      <div class="space-y-2">
        <ValidatedInput
          v-model="loginForm.username"
          type="text"
          placeholder="用户名"
          :tooltip="false"
          :pattern="userPattern"
          @validate="userValid = $event"
          class="h-11"
        />
      </div>
      <div class="space-y-2">
        <ValidatedInput
          v-model="loginForm.password"
          type="password"
          placeholder="密码"
          :pattern="passPattern"
          :tooltip="false"
          @validate="passValid = $event"
          class="h-11"
        />
      </div>
      <div class="flex items-center justify-between text-xs text-muted-foreground">
        <label class="flex items-center gap-1 cursor-pointer">
          <input type="checkbox" class="rounded border-gray-300" /> 记住密码
        </label>
        <a href="#" class="hover:text-primary">忘记密码？</a>
      </div>
    </CardContent>

    <CardFooter class="pb-8 flex flex-col gap-4">
      <Button
        class="w-full h-11 text-base font-bold shadow-lg shadow-primary/20"
        :disabled="loading"
        @click="handleLogin"
      >
        <Loader2 v-if="loading" class="mr-2 h-4 w-4 animate-spin" />
        登 录
      </Button>
      <p class="text-sm text-center text-muted-foreground">
        还没有账号?
        <RouterLink to="/auth/register" class="text-primary font-semibold hover:underline"
          >立即注册</RouterLink
        >
      </p>
    </CardFooter>
  </div>
</template>

<style>
html,
body {
  background: transparent !important;
  margin: 0;
  padding: 0;
  overflow: hidden;
}

.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.3s ease;
}

.fade-slide-enter-from {
  opacity: 0;
  transform: translateX(20px);
}

.fade-slide-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}
</style>
