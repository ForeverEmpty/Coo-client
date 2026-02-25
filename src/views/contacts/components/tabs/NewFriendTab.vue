<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { UserPlus, Check, X } from 'lucide-vue-next'
import { toast } from 'vue-sonner'

import { socialApi } from '@/api/social'
import type { FriendApply } from '@/api/types'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { usePlatform } from '@/composables/usePlatform'
import CompactProfile from '../../CompactProfile.vue'

const { p, isElectron } = usePlatform()

const applyList = ref<FriendApply[]>([])
const loading = ref(false)
const webDetailOpen = ref(false)
const selectedUserId = ref<string | null>(null)
const expandedMessages = ref<Set<string>>(new Set())

const fetchApplyList = async () => {
  try {
    loading.value = true
    const { data } = await socialApi.getApplyList()
    applyList.value = data
  } finally {
    loading.value = false
  }
}

const handleAudit = async (applyId: string, status: 1 | 2 | 3) => {
  try {
    await socialApi.auditApply({ applyId, status })
    const messages = {
      1: '已同意好友申请',
      2: '已拒绝好友申请',
      3: '已忽略好友申请',
    }
    toast.success(messages[status])
    await fetchApplyList()
  } catch {}
}

const handleUnignore = async (applyId: string) => {
  try {
    await socialApi.unignoreApply(applyId)
    toast.success('已取消忽略')
    await fetchApplyList()
  } catch {}
}

const statusTextMap = new Map<0 | 1 | 2 | 3, string>([
  [0, '待处理'],
  [1, '已同意'],
  [2, '已拒绝'],
  [3, '已忽略'],
])

const statusClassMap = new Map<0 | 1 | 2 | 3, string>([
  [0, 'text-yellow-600'],
  [1, 'text-green-600'],
  [2, 'text-red-600'],
  [3, 'text-gray-600'],
])

const getStatusText = (status: 0 | 1 | 2 | 3) => statusTextMap.get(status) || '未知'

const getStatusClass = (status: 0 | 1 | 2 | 3) => statusClassMap.get(status) || ''

const handleItemClick = (apply: FriendApply) => {
  if (isElectron) {
    p.send('open-window', {
      type: 'USER_DETAIL',
      route: `/contacts/profile-compact/${apply.fromId}`,
    })
  } else {
    selectedUserId.value = apply.fromId
    webDetailOpen.value = true
  }
}

const toggleMessageExpand = (applyId: string, event: Event) => {
  event.stopPropagation()
  if (expandedMessages.value.has(applyId)) {
    expandedMessages.value.delete(applyId)
  } else {
    expandedMessages.value.add(applyId)
  }
}

const isMessageExpanded = (applyId: string) => expandedMessages.value.has(applyId)

onMounted(() => {
  fetchApplyList()
})
</script>

<template>
  <div class="flex flex-col h-full">
    <div v-if="loading" class="p-8 text-center text-muted-foreground text-sm">
      <p>加载中...</p>
    </div>

    <div
      v-else-if="applyList.length === 0"
      class="p-8 text-center text-muted-foreground text-sm flex flex-col items-center gap-2 opacity-60"
    >
      <UserPlus class="w-8 h-8" />
      <p>暂无好友申请</p>
    </div>

    <div v-else class="flex-1 overflow-y-auto">
      <div
        v-for="apply in applyList"
        :key="apply.id"
        @click="handleItemClick(apply)"
        class="flex items-start gap-3 p-4 hover:bg-accent/50 transition-colors border-b border-border/50"
      >
        <div class="shrink-0">
          <img
            v-if="apply.avatar"
            :src="apply.avatar"
            :alt="apply.nickname"
            class="w-12 h-12 rounded-full object-cover"
          />
          <div
            v-else
            class="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold"
          >
            {{ apply.nickname.charAt(0).toUpperCase() }}
          </div>
        </div>

        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <p class="font-medium text-sm truncate">{{ apply.nickname }}</p>
            <span class="text-xs" :class="getStatusClass(apply.status)">
              {{ getStatusText(apply.status) }}
            </span>
          </div>
          <p
            @click="toggleMessageExpand(apply.id, $event)"
            :class="[
              'text-xs text-muted-foreground mt-0.5 cursor-pointer hover:text-foreground transition-colors',
              isMessageExpanded(apply.id) ? 'whitespace-pre-wrap' : 'truncate',
            ]"
            :title="isMessageExpanded(apply.id) ? '点击收起' : '点击展开'"
          >
            {{ apply.msg }}
          </p>
          <p class="text-xs text-muted-foreground/60 mt-0.5">
            {{ new Date(apply.createTime).toLocaleString('zh-CN') }}
          </p>
        </div>

        <div v-if="apply.status === 0" class="flex flex-col items-end gap-1.5 shrink-0">
          <div class="flex gap-1.5">
            <button
              @click.stop="handleAudit(apply.id, 1)"
              class="p-1.5 rounded-lg bg-green-500 hover:bg-green-600 text-white transition-colors"
              title="同意"
            >
              <Check class="w-3.5 h-3.5" />
            </button>
            <button
              @click.stop="handleAudit(apply.id, 2)"
              class="p-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors"
              title="拒绝"
            >
              <X class="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            @click.stop="handleAudit(apply.id, 3)"
            class="text-xs text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
            title="忽略"
          >
            忽略
          </button>
        </div>

        <div v-else-if="apply.status === 3" class="flex flex-col items-end gap-1.5 shrink-0">
          <span class="text-xs text-muted-foreground">已忽略</span>
          <button
            @click.stop="handleUnignore(apply.id)"
            class="text-xs text-primary hover:text-primary/80 hover:underline transition-all"
          >
            取消忽略
          </button>
        </div>
      </div>
    </div>

    <Dialog v-if="!isElectron" v-model:open="webDetailOpen">
      <DialogContent class="p-0 max-w-2xl">
        <CompactProfile v-if="selectedUserId" :user-id="selectedUserId" />
      </DialogContent>
    </Dialog>
  </div>
</template>
