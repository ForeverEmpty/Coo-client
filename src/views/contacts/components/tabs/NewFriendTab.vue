<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { UserPlus, Check, X, Clock3 } from 'lucide-vue-next'
import { toast } from 'vue-sonner'

import { socialApi } from '@/api/social'
import type { FriendApply, FriendApplySource } from '@/api/types'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { usePlatform } from '@/composables/usePlatform'
import { formatLocalDateTime } from '@/utils/dateTime'
import CompactProfile from '../../CompactProfile.vue'
import AcceptApplyDialog from '../AcceptApplyDialog.vue'
import { timeAgo } from '@/utils/timeAgo'

const { p, isElectron } = usePlatform()

const applyList = ref<FriendApply[]>([])
const sentApplyList = ref<FriendApply[]>([])
const loading = ref(false)

const webDetailOpen = ref(false)
const selectedUserId = ref<string | null>(null)
const selectedSource = ref<FriendApplySource>('SEARCH')
const expandedMessages = ref<Set<string>>(new Set())

const acceptDialogOpen = ref(false)
const pendingAcceptApply = ref<FriendApply | null>(null)

const isEmpty = computed(() => applyList.value.length === 0 && sentApplyList.value.length === 0)

const normalizeSource = (source?: string): FriendApplySource => {
  const value = source?.trim().toUpperCase()
  if (value === 'SEARCH' || value === 'QR' || value === 'GROUP') {
    return value
  }
  return 'SEARCH'
}

const formatDateTime = (time: string) => {
  return formatLocalDateTime(time, 'zh-CN')
}

const fetchApplyList = async () => {
  try {
    loading.value = true
    const [receivedRes, sentRes] = await Promise.all([
      socialApi.getApplyList(),
      socialApi.getSentApplyList(),
    ])
    applyList.value = receivedRes.data || []
    sentApplyList.value = sentRes.data || []
  } finally {
    loading.value = false
  }
}

const handleAudit = async (applyId: string, status: 1 | 2 | 3) => {
  if (status === 1) {
    const apply = applyList.value.find((a) => a.id === applyId)
    if (!apply) return

    if (isElectron) {
      p.send('open-window', {
        type: 'ACCEPT_APPLY',
        route: `/contacts/accept-apply?applyId=${apply.id}&nickname=${encodeURIComponent(
          apply.nickname,
        )}&avatar=${encodeURIComponent(apply.avatar || '')}`,
      })
    } else {
      pendingAcceptApply.value = apply
      acceptDialogOpen.value = true
    }
    return
  }

  try {
    await socialApi.auditApply({ applyId, status })
    const messages: Record<number, string> = {
      2: '已拒绝好友申请',
      3: '已忽略好友申请',
    }
    if (messages[status]) toast.success(messages[status])
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

const sourceTextMap = new Map<string, string>([
  ['SEARCH', '账号搜索'],
  ['QR', '扫码添加'],
  ['GROUP', '群聊'],
])

const getStatusText = (status: 0 | 1 | 2 | 3) => statusTextMap.get(status) || '未知'
const getStatusClass = (status: 0 | 1 | 2 | 3) => statusClassMap.get(status) || ''
const getSourceText = (source?: string) => sourceTextMap.get(source || '') || '未知来源'

const openProfile = (userId: string, source?: string) => {
  const resolvedSource = normalizeSource(source)
  if (isElectron) {
    p.send('open-window', {
      type: 'USER_DETAIL',
      route: `/contacts/profile-compact/${userId}?source=${resolvedSource}`,
    })
  } else {
    selectedUserId.value = userId
    selectedSource.value = resolvedSource
    webDetailOpen.value = true
  }
}

const handleReceivedItemClick = (apply: FriendApply) => {
  openProfile(apply.fromId, apply.source)
}

const handleSentItemClick = (apply: FriendApply) => {
  if (!apply.toId) return
  openProfile(apply.toId, apply.source)
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
  void fetchApplyList()
  if (isElectron) {
    p.on('accept-apply-result', () => {
      void fetchApplyList()
    })
  }
})
</script>

<template>
  <div class="flex flex-col h-full">
    <div v-if="loading" class="p-8 text-center text-muted-foreground text-sm">
      <p>加载中...</p>
    </div>

    <div
      v-else-if="isEmpty"
      class="p-8 text-center text-muted-foreground text-sm flex flex-col items-center gap-2 opacity-60"
    >
      <UserPlus class="w-8 h-8" />
      <p>暂无好友申请</p>
    </div>

    <div v-else class="flex-1">
      <div class="flex flex-col">
        <div class="px-4 pt-3 pb-2 text-xs font-semibold text-muted-foreground">我发出的申请</div>

        <div v-if="sentApplyList.length === 0" class="px-4 pb-3 text-xs text-muted-foreground/70">
          · 暂无近7天发出的申请
        </div>

        <div
          v-for="apply in sentApplyList"
          :key="`sent-${apply.id}`"
          @click="handleSentItemClick(apply)"
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
              {{ apply.nickname?.charAt(0).toUpperCase() || '?' }}
            </div>
          </div>

          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between gap-2">
              <p class="font-medium text-sm truncate">
                {{ apply.nickname || `用户 ${apply.toId}` }}
              </p>
              <Badge variant="outline" class="text-blue-600 border-blue-500/30 bg-blue-500/10">
                <Clock3 class="w-3 h-3 mr-1" />
                正在等待验证
              </Badge>
            </div>
            <p class="text-xs text-muted-foreground mt-0.5 truncate">
              {{ apply.msg || '已发送好友申请' }}
            </p>
            <div class="flex items-center gap-2 text-xs text-muted-foreground/60 mt-0.5">
              <span :title="formatDateTime(apply.createTime)">{{ timeAgo(apply.createTime) }}</span>
              <span v-if="apply.source">来源: {{ getSourceText(apply.source) }}</span>
            </div>
          </div>
        </div>

        <div class="px-4 pt-3 pb-2 text-xs font-semibold text-muted-foreground">收到的申请</div>

        <div v-if="applyList.length === 0" class="px-4 pb-3 text-xs text-muted-foreground/70">
          暂无收到的申请
        </div>

        <div
          v-for="apply in applyList"
          :key="`received-${apply.id}`"
          @click="handleReceivedItemClick(apply)"
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
            <div class="flex items-center gap-2 text-xs text-muted-foreground/60 mt-0.5">
              <span :title="formatDateTime(apply.createTime)">{{ timeAgo(apply.createTime) }}</span>
              <span v-if="apply.source">来源: {{ getSourceText(apply.source) }}</span>
            </div>
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
    </div>

    <Dialog v-if="!isElectron" v-model:open="webDetailOpen">
      <DialogContent class="p-0 max-w-2xl">
        <CompactProfile v-if="selectedUserId" :user-id="selectedUserId" :source="selectedSource" />
      </DialogContent>
    </Dialog>

    <Dialog v-if="!isElectron" v-model:open="acceptDialogOpen">
      <DialogContent class="p-0 max-w-md" :show-close-button="false">
        <AcceptApplyDialog
          v-if="pendingAcceptApply"
          :apply-id="pendingAcceptApply.id"
          :nickname="pendingAcceptApply.nickname"
          :avatar="pendingAcceptApply.avatar"
          @accept="
            () => {
              acceptDialogOpen = false
              pendingAcceptApply = null
              void fetchApplyList()
            }
          "
          @cancel="
            () => {
              acceptDialogOpen = false
              pendingAcceptApply = null
            }
          "
        />
      </DialogContent>
    </Dialog>
  </div>
</template>

<style scoped></style>
