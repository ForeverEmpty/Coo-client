<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Send, X } from 'lucide-vue-next'
import { toast } from 'vue-sonner'

import { socialApi } from '@/api/social'
import type { FriendApplySource, FriendGroup, UserSimple } from '@/api/types'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { usePlatform } from '@/composables/usePlatform'
import { useUserStore } from '@/stores/userStore'

const props = defineProps<{ user: UserSimple | null; source?: FriendApplySource }>()
const emit = defineEmits<{ close: [] }>()

const { p, isElectron } = usePlatform()
const route = useRoute()
const userStore = useUserStore()

const targetUser = ref({ id: '', nickname: '', avatar: '' })
const applyMsg = ref('我是 ')
const loading = ref(false)
const applySource = ref<FriendApplySource>('SEARCH')
const groups = ref<FriendGroup[]>([])
const selectedGroupId = ref<string>('0')

const resolveSource = (raw?: string | null): FriendApplySource => {
  const normalized = raw?.trim().toUpperCase()
  if (normalized === 'QR' || normalized === 'GROUP' || normalized === 'SEARCH') {
    return normalized
  }
  return 'SEARCH'
}

const handleClose = () => {
  if (isElectron) p.app.close()
  else emit('close')
}

const fetchGroups = async () => {
  try {
    const res = await socialApi.getFriendList()
    groups.value = res.data || []
  } catch {}
}

onMounted(() => {
  void fetchGroups()
  const id = props.user?.id || (route.query.id as string)
  const nickname = props.user?.nickname || (route.query.nickname as string)
  const avatar = props.user?.avatar || (route.query.avatar as string)

  if (id) {
    targetUser.value = { id, nickname, avatar }
    applyMsg.value = `我是 ${userStore.userInfo?.nickname || '新用户'}`
  }

  applySource.value = resolveSource(props.source || (route.query.source as string))
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
  const parsedGroupId =
    selectedGroupId.value !== '0' && !Number.isNaN(Number(selectedGroupId.value))
      ? Number(selectedGroupId.value)
      : undefined

  loading.value = true
  try {
    await socialApi.applyFriend({
      targetId: targetUser.value.id,
      msg: applyMsg.value,
      source: applySource.value,
      groupId: parsedGroupId,
    })

    toast.success('申请已发送')
    setTimeout(() => handleClose(), 500)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden border bg-background select-none">
    <div
      v-if="isElectron"
      class="flex h-10 shrink-0 items-center justify-between border-b px-4"
      style="-webkit-app-region: drag"
    >
      <span class="text-xs font-bold text-muted-foreground">发送好友申请</span>
      <Button variant="ghost" size="icon" class="no-drag h-6 w-6" @click="handleClose">
        <X class="h-4 w-4" />
      </Button>
    </div>

    <div class="flex flex-1 flex-col gap-6 p-6">
      <div class="flex items-center gap-4 rounded-2xl bg-muted/30 p-4">
        <Avatar class="h-14 w-14 border-2 border-background">
          <AvatarImage :src="targetUser.avatar" />
          <AvatarFallback>{{ targetUser.nickname?.[0] }}</AvatarFallback>
        </Avatar>
        <div>
          <div class="text-base font-bold">{{ targetUser.nickname }}</div>
          <div class="text-[10px] text-muted-foreground">ID: {{ targetUser.id }}</div>
          <div class="text-[10px] text-muted-foreground">来源: {{ applySource }}</div>
        </div>
      </div>

      <div class="flex flex-1 flex-col space-y-2">
        <div class="space-y-2">
          <Label class="ml-1 text-xs font-medium text-muted-foreground">选择分组</Label>
          <Select v-model:model-value="selectedGroupId">
            <SelectTrigger class="no-drag h-9 w-full">
              <SelectValue placeholder="选择好友分组（默认：我的好友）" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="group in groups"
                :key="group.groupId"
                :value="String(group.groupId)"
              >
                {{ group.groupName }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <label class="ml-1 text-xs font-medium text-muted-foreground">填写验证信息</label>
        <Textarea
          v-model="applyMsg"
          placeholder="给对方打个招呼吧..."
          class="no-drag flex-1 resize-none border-none bg-muted/20"
        />
      </div>

      <div class="flex gap-2">
        <Button v-if="isElectron" variant="outline" class="no-drag flex-1" @click="handleClose">
          取消
        </Button>
        <Button class="no-drag flex-1 gap-2" :disabled="loading" @click="submitApply">
          <Send class="h-4 w-4" />
          发送申请
        </Button>
      </div>
    </div>
  </div>
</template>
