<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { Check, X, UserCheck } from 'lucide-vue-next'
import { toast } from 'vue-sonner'

import { socialApi } from '@/api/social'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { usePlatform } from '@/composables/usePlatform'
import type { FriendGroup } from '@/api/types'

const props = withDefaults(
  defineProps<{
    applyId?: string
    nickname?: string
    avatar?: string
  }>(),
  {
    applyId: '',
    nickname: '',
    avatar: '',
  },
)

const emit = defineEmits<{
  (e: 'accept', applyId: string): void
  (e: 'cancel'): void
}>()

const { p, isElectron } = usePlatform()

const remark = ref('')
const selectedGroupId = ref<string>('')
const groups = ref<FriendGroup[]>([])
const submitting = ref(false)

const getQueryValue = (key: string) => {
  const params = new URLSearchParams(window.location.search)
  return params.get(key) || ''
}

const applyIdComputed = computed(() => {
  return getQueryValue('applyId') || props.applyId
})

const nicknameComputed = computed(() => {
  return getQueryValue('nickname') || props.nickname
})

const avatarComputed = computed(() => {
  return getQueryValue('avatar') || props.avatar
})

const fetchGroups = async () => {
  try {
    const res = await socialApi.getFriendList()
    groups.value = res.data || []
  } catch {}
}

const handleAccept = async () => {
  if (submitting.value) return
  if (!applyIdComputed.value) {
    toast.error('缺少申请ID')
    return
  }
  const parsedGroupId = selectedGroupId.value
  submitting.value = true
  try {
    await socialApi.auditApply({
      applyId: applyIdComputed.value,
      status: 1,
      remark: remark.value.trim() || undefined,
      groupId: parsedGroupId,
    })
    toast.success('已同意好友申请')
    if (isElectron) {
      p.send('accept-apply-result', { applyId: applyIdComputed.value })
      p.app.close()
    } else {
      emit('accept', applyIdComputed.value)
    }
  } catch {
    submitting.value = false
  }
}

const handleCancel = () => {
  if (isElectron) {
    p.app.close()
  } else {
    emit('cancel')
  }
}

onMounted(() => {
  fetchGroups()
})
</script>

<template>
  <div class="flex flex-col h-full bg-background overflow-hidden relative">
    <div v-if="isElectron" class="absolute top-0 left-0 right-0 h-8 app-region-drag z-10" />

    <!-- 顶部标题 -->
    <div
      class="flex items-center justify-between px-4 py-4 border-b border-border/40 relative z-20"
      :class="{ 'pt-6': isElectron }"
    >
      <div v-if="isElectron">
        <h2 class="text-base font-semibold">同意好友申请</h2>
      </div>
      <DialogHeader v-else>
        <DialogTitle>同意好友申请</DialogTitle>
      </DialogHeader>

      <div
        class="app-region-no-drag cursor-pointer p-1.5 hover:bg-muted rounded-md text-muted-foreground"
        @click="handleCancel"
      >
        <X class="w-4 h-4" />
      </div>
    </div>

    <!-- 用户信息 -->
    <div class="flex items-center gap-3 px-6 py-4 border-b border-border/40">
      <div class="shrink-0">
        <img
          v-if="avatarComputed"
          :src="avatarComputed"
          :alt="nicknameComputed"
          class="w-11 h-11 rounded-full object-cover"
        />
        <div
          v-else
          class="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-lg"
        >
          {{ nicknameComputed?.charAt(0)?.toUpperCase() }}
        </div>
      </div>
      <div class="flex-1 min-w-0">
        <p class="font-medium text-sm truncate">{{ nicknameComputed }}</p>
        <p class="text-xs text-muted-foreground mt-0.5">即将成为您的好友</p>
      </div>
      <UserCheck class="w-5 h-5 text-green-500 shrink-0" />
    </div>

    <!-- 表单内容 -->
    <div class="flex-1 px-6 py-4 space-y-4">
      <!-- 备注 -->
      <div class="space-y-1.5">
        <Label class="text-xs font-medium text-muted-foreground">备注 (可选)</Label>
        <Input
          v-model="remark"
          placeholder="为对方设置备注名..."
          class="h-9 text-sm"
          :maxlength="32"
          @keyup.enter="handleAccept"
        />
      </div>

      <!-- 分组 -->
      <div class="space-y-1.5">
        <Label class="text-xs font-medium text-muted-foreground">分组 (可选)</Label>
        <Select v-model:model-value="selectedGroupId">
          <SelectTrigger class="h-9 text-sm">
            <SelectValue placeholder="选择分组（默认：我的好友）" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="group in groups" :key="group.groupId" :value="String(group.groupId)">
              {{ group.groupName }}
              <span class="text-muted-foreground ml-1 text-xs"
                >({{ group.children?.length ?? 0 }})</span
              >
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>

    <!-- 底部操作按钮 -->
    <div class="flex gap-3 px-6 py-4 border-t border-border/40">
      <Button variant="outline" class="flex-1 h-9 text-sm" @click="handleCancel"> 取消 </Button>
      <Button
        class="flex-1 h-9 text-sm bg-green-600 hover:bg-green-700 text-white"
        :disabled="submitting"
        @click="handleAccept"
      >
        <Check class="w-4 h-4 mr-1.5" />
        同意
      </Button>
    </div>
  </div>
</template>
