<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { ArrowLeft, CheckCircle, Loader2, ShieldCheck, XCircle } from 'lucide-vue-next'
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
import { Input } from '@/components/ui/input'
import { authApi } from '@/api/auth'
import { logger } from '@/utils/logger'

const router = useRouter()

const loading = ref(false)
const userValid = ref(false)
const nickValid = ref(false)
const passValid = ref(false)
const confirmValid = ref(false)

const userPattern = /^[a-zA-Z0-9][a-zA-Z0-9_]{3,15}$/
const nickPattern = /^[a-zA-Z0-9\u4e00-\u9fa5]{0,10}$/
const passPattern = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,20}$/

const userRules = computed(() => ({
  start: /^[a-zA-Z0-9]/.test(registerForm.username),
  format: /^[a-zA-Z0-9_]{4,16}$/.test(registerForm.username),
}))

const nickRules = computed(() => ({
  valid: nickPattern.test(registerForm.nickname),
}))

const passRules = computed(() => ({
  hasLetter: /[A-Za-z]/.test(registerForm.password),
  hasNumber: /\d/.test(registerForm.password),
  length: /^[A-Za-z\d]{8,20}$/.test(registerForm.password),
}))

const confirmRules = computed(() => ({
  match:
    registerForm.confirmPassword === registerForm.password && registerForm.confirmPassword !== '',
}))

const getRuleClass = (isValid: boolean) => (isValid ? 'text-green-500' : 'text-red-400')
const getRuleIcon = (isValid: boolean) => (isValid ? CheckCircle : XCircle)

const registerForm = reactive({
  username: '',
  nickname: '',
  password: '',
  confirmPassword: '',
  code: '',
})

const handleRegister = async () => {
  if (!userValid.value || !nickValid.value || !passValid.value || !confirmValid.value) {
    toast.error('请按照提示完善注册信息')
    return
  }

  loading.value = true
  try {
    await authApi.register(registerForm).then(() => {
      loading.value = false
      toast.success('注册成功')
      router.push('/auth/login')
    })
  } catch (error) {
    loading.value = false
    logger.error('Register failed', error)
  }
}

const getCode = () => {
  toast.info('验证码功能暂未开放')
}
</script>

<template>
  <div class="flex flex-col h-full">
    <CardHeader class="text-center pt-10">
      <div class="flex items-center gap-2 mb-2 no-drag">
        <router-link to="/auth/login">
          <Button variant="ghost" size="icon" class="h-8 w-8 no-drag"
            ><ArrowLeft class="h-4 w-4"
          /></Button>
        </router-link>
        <span class="text-sm">返回登录</span>
      </div>
      <CardTitle class="text-2xl font-bold">新用户注册</CardTitle>
      <CardDescription class="mb-4">加入 Coo，开启即时通讯新体验</CardDescription>
    </CardHeader>

    <CardContent class="grid gap-4 flex-1 mb-4">
      <div class="space-y-1">
        <ValidatedInput
          tooltip-id="register-username-tooltip"
          v-model="registerForm.username"
          type="text"
          placeholder="设置用户名"
          :pattern="userPattern"
          @validate="userValid = $event"
          class="h-10"
        >
          <template #message>
            <div class="flex flex-col gap-1">
              <span
                :class="[
                  'flex items-center text-xs transition-colors',
                  getRuleClass(userRules.start),
                ]"
              >
                <component :is="getRuleIcon(userRules.start)" class="h-3.5 w-3.5 mr-2" />
                第一个字符必须是字母或数字
              </span>
              <span
                :class="[
                  'flex items-center text-xs transition-colors',
                  getRuleClass(userRules.format),
                ]"
              >
                <component :is="getRuleIcon(userRules.format)" class="h-3.5 w-3.5 mr-2" />
                4-16位字母、数字或下划线
              </span>
            </div>
          </template>
        </ValidatedInput>
      </div>
      <div class="space-y-1">
        <ValidatedInput
          tooltip-id="register-nickname-tooltip"
          v-model="registerForm.nickname"
          type="text"
          placeholder="设置昵称"
          :pattern="nickPattern"
          @validate="nickValid = $event"
          class="h-10"
        >
          <template #message>
            <span
              :class="[
                'flex items-center text-xs transition-colors',
                getRuleClass(nickRules.valid),
              ]"
            >
              <component :is="getRuleIcon(nickRules.valid)" class="h-3.5 w-3.5 mr-2" />
              0-10位字符，支持中英文、数字
            </span>
          </template>
        </ValidatedInput>
      </div>
      <div class="space-y-1">
        <ValidatedInput
          tooltip-id="register-password-tooltip"
          v-model="registerForm.password"
          type="password"
          placeholder="设置密码"
          :pattern="passPattern"
          @validate="passValid = $event"
          class="h-10"
        >
          <template #message>
            <div class="flex flex-col gap-1">
              <span
                :class="[
                  'flex items-center text-xs transition-colors',
                  getRuleClass(passRules.hasLetter),
                ]"
              >
                <component :is="getRuleIcon(passRules.hasLetter)" class="h-3.5 w-3.5 mr-2" />
                包含至少一个字母
              </span>
              <span
                :class="[
                  'flex items-center text-xs transition-colors',
                  getRuleClass(passRules.hasNumber),
                ]"
              >
                <component :is="getRuleIcon(passRules.hasNumber)" class="h-3.5 w-3.5 mr-2" />
                包含至少一个数字
              </span>
              <span
                :class="[
                  'flex items-center text-xs transition-colors',
                  getRuleClass(passRules.length),
                ]"
              >
                <component :is="getRuleIcon(passRules.length)" class="h-3.5 w-3.5 mr-2" />
                8-20位字母和数字结合
              </span>
            </div>
          </template>
        </ValidatedInput>
      </div>
      <div class="space-y-1">
        <ValidatedInput
          tooltip-id="register-confirm-password-tooltip"
          v-model="registerForm.confirmPassword"
          type="password"
          placeholder="确认密码"
          :pattern="new RegExp('^' + registerForm.password + '$')"
          @validate="confirmValid = $event"
          class="h-10"
        >
          <template #message>
            <span
              :class="[
                'flex items-center text-xs transition-colors',
                getRuleClass(confirmRules.match),
              ]"
            >
              <component :is="getRuleIcon(confirmRules.match)" class="h-3.5 w-3.5 mr-2" />
              两次输入的密码必须一致
            </span>
          </template>
        </ValidatedInput>
      </div>
      <!-- 验证码组合 -->
      <div class="flex gap-2">
        <div class="relative flex-1">
          <ShieldCheck class="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input v-model="registerForm.code" type="text" placeholder="验证码" class="pl-9 h-10" />
        </div>
        <Button variant="outline" class="h-10 whitespace-nowrap" @click="getCode">
          获取验证码
        </Button>
      </div>
    </CardContent>

    <CardFooter class="pb-8 flex flex-col gap-4">
      <Button
        class="w-full h-11 text-base font-bold shadow-lg shadow-primary/20"
        :disabled="loading"
        @click="handleRegister"
      >
        <Loader2 v-if="loading" class="mr-2 h-4 w-4 animate-spin" />
        注 册
      </Button>
      <p class="text-[10px] text-center text-muted-foreground px-4">
        点击注册即代表您已阅读并同意
        <a href="#" class="text-primary underline">用户协议</a> 与
        <a href="#" class="text-primary underline">隐私政策</a>
      </p>
    </CardFooter>
  </div>
</template>
