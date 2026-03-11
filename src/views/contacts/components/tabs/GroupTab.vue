<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { Plus, Users } from 'lucide-vue-next'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { QuickContextMenu } from '@/components/ui/context-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { socialApi } from '@/api/social'
import type { GroupChatMeta } from '@/stores/contactStore'
import type { GroupMember } from '@/api/types'
import { useChatStore } from '@/stores/chatStore'
import { useContactStore } from '@/stores/contactStore'
import { useUserStore } from '@/stores/userStore'
import { createGroupContextMenu } from '@/config/menu'
import { emitGroupUpdated } from '@/utils/groupSync'

const props = withDefaults(
  defineProps<{
    searchKeyword?: string
  }>(),
  {
    searchKeyword: '',
  },
)

const router = useRouter()
const chatStore = useChatStore()
const contactStore = useContactStore()
const userStore = useUserStore()

const createDialogOpen = ref(false)
const remarkDialogOpen = ref(false)
const leaveDialogOpen = ref(false)
const transferDialogOpen = ref(false)
const disbandDialogOpen = ref(false)

const creating = ref(false)
const mutating = ref(false)
const transferMembers = ref<GroupMember[]>([])
const transferTargetUserId = ref('')
const currentGroup = ref<GroupChatMeta | null>(null)
const remarkValue = ref('')

const createForm = ref({
  name: '',
  notice: '',
  inviteAuditMode: '0',
})
const selectedMemberIds = ref<string[]>([])

const filteredGroups = computed(() => {
  const keyword = props.searchKeyword.trim().toLowerCase()
  if (!keyword) return contactStore.groupChats

  return contactStore.groupChats.filter((group) => {
    return (
      String(group.name || '').toLowerCase().includes(keyword) ||
      String(group.rawName || '').toLowerCase().includes(keyword) ||
      String(group.remark || '').toLowerCase().includes(keyword) ||
      String(group.notice || '').toLowerCase().includes(keyword) ||
      String(group.id || '').toLowerCase().includes(keyword)
    )
  })
})

const friendOptions = computed(() => {
  const result: Array<{ id: string; label: string }> = []
  contactStore.friendGroups.forEach((group) => {
    group.children.forEach((friend) => {
      result.push({
        id: String(friend.id),
        label: friend.showName || friend.nickname || String(friend.id),
      })
    })
  })
  return result
})

const resetCreateForm = () => {
  createForm.value = {
    name: '',
    notice: '',
    inviteAuditMode: '0',
  }
  selectedMemberIds.value = []
}

const rawGroupId = (groupId: string) => (groupId.startsWith('group_') ? groupId.slice(6) : groupId)
const isOwnerGroup = (group?: GroupChatMeta | null) => {
  if (!group) return false
  const currentUserId = String(userStore.userInfo?.id || '')
  if (group.ownerId && currentUserId) {
    return String(group.ownerId) === currentUserId
  }
  return group.myRole === 1
}
const notifyGroupUpdated = (groupId?: string) => {
  const id = String(groupId || '').trim()
  if (!id) return
  emitGroupUpdated(rawGroupId(id))
}

const toggleSelectedMember = (userId: string) => {
  if (selectedMemberIds.value.includes(userId)) {
    selectedMemberIds.value = selectedMemberIds.value.filter((id) => id !== userId)
    return
  }
  selectedMemberIds.value = [...selectedMemberIds.value, userId]
}

const handleCreateGroup = async () => {
  if (!createForm.value.name.trim()) {
    toast.error('请输入群名称')
    return
  }

  creating.value = true
  try {
    const { data } = await socialApi.createGroup({
      name: createForm.value.name.trim(),
      notice: createForm.value.notice.trim() || undefined,
      inviteAuditMode: Number(createForm.value.inviteAuditMode),
      initialMemberIds: selectedMemberIds.value,
    })

    toast.success('群聊创建成功')
    createDialogOpen.value = false
    resetCreateForm()
    await contactStore.fetchGroupChats(true)
    if (data?.id) {
      const chatId = `group_${data.id}`
      chatStore.setActiveChat({
        id: chatId,
        title: data.remark || data.name,
        avatar: data.avatar || '',
        type: 2,
        subTitle: `${data.memberCount || 1} 人`,
      })
      router.push('/chat')
    }
  } finally {
    creating.value = false
  }
}

const openGroupDetail = (groupId: string) => {
  router.push(`/groups/${rawGroupId(groupId)}`)
}

const openChat = (group: GroupChatMeta) => {
  chatStore.setActiveChat({
    id: group.id,
    title: group.name,
    avatar: group.avatar || '',
    type: 2,
    subTitle: `${group.memberCount || 0} 人 · ${group.myTitleName || '群成员'}`,
  })
}

const openRemarkDialog = (group: GroupChatMeta) => {
  currentGroup.value = group
  remarkValue.value = group.remark || ''
  remarkDialogOpen.value = true
}

const saveRemark = async () => {
  if (!currentGroup.value) return
  mutating.value = true
  try {
    await socialApi.updateGroupRemark(rawGroupId(currentGroup.value.id), remarkValue.value.trim())
    toast.success('群备注已更新')
    remarkDialogOpen.value = false
    await contactStore.fetchGroupChats(true)
    notifyGroupUpdated(currentGroup.value.id)
    const refreshed = contactStore.groupChats.find((item) => item.id === currentGroup.value?.id)
    if (refreshed && chatStore.activeChatId === refreshed.id) {
      chatStore.ensureSession({
        id: refreshed.id,
        title: refreshed.name,
        avatar: refreshed.avatar || '',
        type: 2,
        subTitle: `${refreshed.memberCount || 0} 人 · ${refreshed.myTitleName || '群成员'}`,
      })
    }
  } finally {
    mutating.value = false
  }
}

const openLeaveDialog = (group: GroupChatMeta) => {
  currentGroup.value = group
  leaveDialogOpen.value = true
}

const confirmLeave = async () => {
  if (!currentGroup.value) return
  mutating.value = true
  try {
    await socialApi.leaveGroup(rawGroupId(currentGroup.value.id))
    toast.success('已退出群聊')
    leaveDialogOpen.value = false
    notifyGroupUpdated(currentGroup.value.id)
    if (chatStore.activeChatId === currentGroup.value.id) {
      chatStore.setActiveChat(null)
    }
    await contactStore.fetchGroupChats(true)
  } finally {
    mutating.value = false
  }
}

const openTransferDialog = async (group: GroupChatMeta) => {
  currentGroup.value = group
  transferTargetUserId.value = ''
  mutating.value = true
  try {
    const { data } = await socialApi.getGroupMembers(rawGroupId(group.id))
    transferMembers.value = (data || []).filter((item) => item.userId !== String(userStore.userInfo?.id || ''))
    transferDialogOpen.value = true
  } finally {
    mutating.value = false
  }
}

const confirmTransferOwner = async () => {
  if (!currentGroup.value || !transferTargetUserId.value) {
    toast.error('请选择要转让的成员')
    return
  }
  mutating.value = true
  try {
    await socialApi.transferGroupOwner(rawGroupId(currentGroup.value.id), transferTargetUserId.value)
    toast.success('群主已转让')
    transferDialogOpen.value = false
    await contactStore.fetchGroupChats(true)
    notifyGroupUpdated(currentGroup.value.id)
  } finally {
    mutating.value = false
  }
}

const openDisbandDialog = (group: GroupChatMeta) => {
  currentGroup.value = group
  disbandDialogOpen.value = true
}

const confirmDisband = async () => {
  if (!currentGroup.value) return
  mutating.value = true
  try {
    await socialApi.deleteGroup(rawGroupId(currentGroup.value.id))
    toast.success('群聊已解散')
    disbandDialogOpen.value = false
    notifyGroupUpdated(currentGroup.value.id)
    if (chatStore.activeChatId === currentGroup.value.id) {
      chatStore.setActiveChat(null)
    }
    await contactStore.fetchGroupChats(true)
  } finally {
    mutating.value = false
  }
}

const buildMenu = (group: GroupChatMeta) =>
  createGroupContextMenu({
    groupId: group.id,
    isOwner: isOwnerGroup(group),
    onOpenDetail: openGroupDetail,
    onSetRemark: () => openRemarkDialog(group),
    onLeave: () => openLeaveDialog(group),
    onTransferOwner: () => void openTransferDialog(group),
    onDisband: () => openDisbandDialog(group),
  })

onMounted(() => {
  void contactStore.fetchGroupChats()
  void contactStore.fetchFriendGroups()
})
</script>

<template>
  <div class="space-y-2 p-2">
    <div class="flex items-center justify-between px-2 py-1">
      <span class="text-xs font-semibold text-muted-foreground">我的群聊</span>
      <Button variant="ghost" size="icon" class="h-7 w-7" @click="createDialogOpen = true">
        <Plus class="h-4 w-4" />
      </Button>
    </div>

    <QuickContextMenu
      v-for="group in filteredGroups"
      :key="group.id"
      :menu="buildMenu(group)"
      trigger="contextmenu"
      trigger-class="w-full"
    >
      <div
        class="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-muted/50"
        @click="openChat(group)"
      >
        <Avatar class="h-10 w-10 rounded-lg">
          <AvatarImage :src="group.avatar || ''" />
          <AvatarFallback class="rounded-lg bg-indigo-100 text-indigo-600">
            <Users class="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium">{{ group.name }}</p>
          <p class="truncate text-xs text-muted-foreground">
            {{ group.memberCount || 0 }} 人 · {{ group.myTitleName || '群成员' }}
          </p>
        </div>
      </div>
    </QuickContextMenu>

    <div
      v-if="filteredGroups.length === 0"
      class="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground"
    >
      暂无群聊
    </div>

    <Dialog v-model:open="createDialogOpen">
      <DialogContent class="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>创建群聊</DialogTitle>
          <DialogDescription>填写群基础信息，并可选邀请初始成员。</DialogDescription>
        </DialogHeader>

        <div class="space-y-4">
          <div class="space-y-2">
            <label class="text-sm font-medium">群名称</label>
            <Input v-model="createForm.name" maxlength="50" placeholder="输入群名称" />
          </div>

          <div class="space-y-2">
            <label class="text-sm font-medium">群公告</label>
            <Textarea v-model="createForm.notice" rows="3" placeholder="输入群公告（可选）" />
          </div>

          <div class="space-y-2">
            <label class="text-sm font-medium">审批模式</label>
            <Select v-model:model-value="createForm.inviteAuditMode">
              <SelectTrigger>
                <SelectValue placeholder="选择审批模式" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">不需要审批</SelectItem>
                <SelectItem value="1">邀请需要审批</SelectItem>
                <SelectItem value="2">申请需要审批</SelectItem>
                <SelectItem value="3">邀请和申请都需要审批</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div class="space-y-2">
            <label class="text-sm font-medium">初始成员</label>
            <div class="max-h-44 space-y-2 overflow-y-auto rounded-md border p-3">
              <button
                v-for="friend in friendOptions"
                :key="friend.id"
                type="button"
                class="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                :class="cn(selectedMemberIds.includes(friend.id) && 'bg-primary/10 text-primary')"
                @click="toggleSelectedMember(friend.id)"
              >
                <span class="truncate">{{ friend.label }}</span>
                <span class="text-xs text-muted-foreground">
                  {{ selectedMemberIds.includes(friend.id) ? '已选' : '' }}
                </span>
              </button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="createDialogOpen = false">取消</Button>
          <Button :disabled="creating" @click="handleCreateGroup">
            {{ creating ? '创建中...' : '创建' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="remarkDialogOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>设置群备注</DialogTitle>
          <DialogDescription>该备注仅对你自己可见，并同步到多端。</DialogDescription>
        </DialogHeader>
        <Input v-model="remarkValue" maxlength="50" placeholder="输入群备注，留空则清除" />
        <DialogFooter>
          <Button variant="outline" @click="remarkDialogOpen = false">取消</Button>
          <Button :disabled="mutating" @click="saveRemark">{{ mutating ? '保存中...' : '保存' }}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="leaveDialogOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>退出群聊</DialogTitle>
          <DialogDescription>退出后将无法继续接收该群消息。</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="leaveDialogOpen = false">取消</Button>
          <Button variant="destructive" :disabled="mutating" @click="confirmLeave">{{ mutating ? '处理中...' : '退群' }}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="transferDialogOpen">
      <DialogContent class="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>转让群主</DialogTitle>
          <DialogDescription>请选择要接任群主的成员。</DialogDescription>
        </DialogHeader>
        <Select v-model:model-value="transferTargetUserId">
          <SelectTrigger>
            <SelectValue placeholder="选择成员" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="member in transferMembers" :key="member.userId" :value="member.userId">
              {{ member.displayName || member.nickname || member.userId }}
            </SelectItem>
          </SelectContent>
        </Select>
        <DialogFooter>
          <Button variant="outline" @click="transferDialogOpen = false">取消</Button>
          <Button :disabled="mutating || !transferTargetUserId" @click="confirmTransferOwner">
            {{ mutating ? '处理中...' : '确认转让' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="disbandDialogOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>解散群聊</DialogTitle>
          <DialogDescription>解散后群成员和聊天入口都会失效。</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="disbandDialogOpen = false">取消</Button>
          <Button variant="destructive" :disabled="mutating" @click="confirmDisband">{{ mutating ? '处理中...' : '解散群聊' }}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
