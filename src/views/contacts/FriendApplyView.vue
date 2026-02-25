<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Send, X } from 'lucide-vue-next'
import { toast } from 'vue-sonner'

import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { socialApi } from '@/api/social'
import { usePlatform } from '@/composables/usePlatform'
import { useUserStore } from '@/stores/userStore'
import type { UserSimple } from '@/api/types'

const props = defineProps<{ user: UserSimple | null }>()
const emit = defineEmits<{ close: [] }>()

const { p, isElectron } = usePlatform()
const route = useRoute()
const userStore = useUserStore()

// 数据状态
const targetUser = ref({ id: '', nickname: '', avatar: '' })
const applyMsg = ref('我是 ')
const loading = ref(false)

// 关闭逻辑
const handleClose = () => p.app.close()

onMounted(() => {
  const id = props.user?.id || (route.query.id as string)
  const nickname = props.user?.nickname || (route.query.nickname as string)
  const avatar = props.user?.avatar || (route.query.avatar as string)
  if (id) {
    targetUser.value = { id, nickname, avatar }
    applyMsg.value = `我是 ${userStore.userInfo?.nickname || '新用户'}`
  }
})

watch(
  () => userStore.userInfo?.nickname,
  (newNickname) => {
    if (newNickname && (applyMsg.value === '我是 新用户' || applyMsg.value === '我是 ')) {
      applyMsg.value = `我是 ${newNickname}`
    }
  },
  { immediate: true },
)

const submitApply = async () => {
  loading.value = true
  try {
    await socialApi.applyFriend({ targetId: targetUser.value.id, msg: applyMsg.value })
    toast.success('申请已发送')

    if (isElectron) {
      setTimeout(() => p.app.close(), 1000)
    } else {
      setTimeout(() => emit('close'), 1000)
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex flex-col h-full bg-background select-none overflow-hidden border">
    <!-- 标题栏 (针对 Electron) -->
    <div
      v-if="isElectron"
      class="h-10 flex items-center justify-between px-4 border-b shrink-0"
      style="-webkit-app-region: drag"
    >
      <span class="text-xs font-bold text-muted-foreground">发送好友申请</span>
      <Button variant="ghost" size="icon" class="h-6 w-6 no-drag" @click="handleClose"
        ><X class="h-4 w-4"
      /></Button>
    </div>

    <div class="p-6 flex-1 flex flex-col gap-6">
      <!-- 目标用户信息 -->
      <div class="flex items-center gap-4 bg-muted/30 p-4 rounded-2xl">
        <Avatar class="h-14 w-14 border-2 border-background">
          <AvatarImage :src="targetUser.avatar" />
          <AvatarFallback>{{ targetUser.nickname[0] }}</AvatarFallback>
        </Avatar>
        <div>
          <div class="font-bold text-base">{{ targetUser.nickname }}</div>
          <div class="text-[10px] text-muted-foreground">ID: {{ targetUser.id }}</div>
        </div>
      </div>

      <!-- 申请理由 -->
      <div class="space-y-2 flex-1 flex flex-col">
        <label class="text-xs font-medium text-muted-foreground ml-1">填写验证信息</label>
        <Textarea
          v-model="applyMsg"
          placeholder="给对方打个招呼吧..."
          class="flex-1 resize-none bg-muted/20 border-none no-drag"
        />
      </div>

      <div class="flex gap-2">
        <Button variant="outline" class="flex-1 no-drag" @click="handleClose" v-if="isElectron"
          >取消</Button
        >
        <Button class="flex-1 no-drag gap-2" :disabled="loading" @click="submitApply">
          <Send class="h-4 w-4" /> 发送申请
        </Button>
      </div>
    </div>
  </div>
</template>
