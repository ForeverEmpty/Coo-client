<script setup lang="ts">
import type { Friend, FriendGroup } from '@/api/types'

import { computed, onMounted, ref } from 'vue'
import { toast } from 'vue-sonner'
import { Settings } from 'lucide-vue-next'

import { socialApi } from '@/api/social'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
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
import { useDialog } from '@/composables/useDialog'
import { usePlatform } from '@/composables/usePlatform'
import { createFriendContextMenu } from '@/config/menu'
import { cn } from '@/lib/utils'
import { useChatStore } from '@/stores/chatStore'
import GroupManager from '../GroupManager.vue'

const chatStore = useChatStore()
const { p, isElectron } = usePlatform()
const { confirm } = useDialog()

const friendGroups = ref<FriendGroup[]>([])
const deletingFriendId = ref<string | null>(null)

const confirmDialogOpen = ref(false)
const pendingDeleteFriend = ref<Friend | null>(null)

const manageGroupOpen = ref(false)
const remarkDialogOpen = ref(false)
const pendingRemarkFriend = ref<Friend | null>(null)
const remarkValue = ref('')
const savingRemark = ref(false)
const movingGroupFriendId = ref<string | null>(null)

const expandedGroupIds = computed(() => friendGroups.value.map((item) => String(item.groupId)))

const handleManageGroups = () => {
  if (isElectron) {
    p.send('open-window', {
      type: 'GROUP_MANAGE',
      route: '/contacts/group-manage',
    })
    return
  }
  manageGroupOpen.value = true
}

const fetchFriendGroups = async () => {
  try {
    const res = await socialApi.getFriendList()
    friendGroups.value = res.data || []
  } catch {}
}

const closeDeleteDialog = () => {
  confirmDialogOpen.value = false
  pendingDeleteFriend.value = null
}

const closeRemarkDialog = () => {
  remarkDialogOpen.value = false
  pendingRemarkFriend.value = null
  remarkValue.value = ''
}

const findFriendById = (friendId: string) => {
  for (const group of friendGroups.value) {
    const matched = group.children.find((friend) => friend.id === friendId)
    if (matched) {
      return matched
    }
  }
  return null
}

const syncActiveChatMeta = (friendId: string) => {
  if (chatStore.activeChatId !== friendId) {
    return
  }

  const friend = findFriendById(friendId)
  if (!friend) {
    return
  }

  chatStore.ensureSession({
    id: friend.id,
    title: friend.showName || friend.nickname || friend.id,
    avatar: friend.avatar || '',
    type: 1,
    subTitle: '在线',
  })
}

const deleteFriend = async (friend: Friend) => {
  if (deletingFriendId.value) return

  deletingFriendId.value = friend.id
  try {
    await socialApi.deleteFriend(friend.id)

    if (chatStore.activeChatId === friend.id) {
      chatStore.setActiveChat(null)
    }

    toast.success('已删除好友（单向删除）')
    closeDeleteDialog()
    await fetchFriendGroups()
  } finally {
    deletingFriendId.value = null
  }
}

const requestDeleteFriend = async (friend: Friend) => {
  if (deletingFriendId.value) return

  if (isElectron) {
    const confirmed = await confirm({
      title: '删除好友',
      description: `确认删除“${friend.showName || friend.nickname}”吗？这是单向删除。`,
      confirmText: '确认删除',
      cancelText: '取消',
      variant: 'destructive',
    })

    if (!confirmed) return
    await deleteFriend(friend)
    return
  }

  pendingDeleteFriend.value = friend
  confirmDialogOpen.value = true
}

const confirmDeleteFriend = async () => {
  const friend = pendingDeleteFriend.value
  if (!friend) return
  await deleteFriend(friend)
}

const requestSetRemark = (friend: Friend) => {
  if (savingRemark.value || movingGroupFriendId.value) {
    return
  }
  pendingRemarkFriend.value = friend
  remarkValue.value = friend.remark || ''
  remarkDialogOpen.value = true
}

const submitRemark = async () => {
  const friend = pendingRemarkFriend.value
  if (!friend || savingRemark.value) {
    return
  }

  savingRemark.value = true
  try {
    await socialApi.updateFriendRelation({
      friendId: friend.id,
      remark: remarkValue.value.trim(),
    })
    toast.success('备注已更新')
    closeRemarkDialog()
    await fetchFriendGroups()
    syncActiveChatMeta(friend.id)
  } finally {
    savingRemark.value = false
  }
}

const moveFriendGroup = async (friend: Friend, targetGroupId: string) => {
  if (movingGroupFriendId.value || String(friend.groupId ?? '0') === String(targetGroupId)) {
    return
  }

  movingGroupFriendId.value = friend.id
  try {
    await socialApi.updateFriendRelation({
      friendId: friend.id,
      groupId: targetGroupId,
    })
    toast.success('已更换分组')
    await fetchFriendGroups()
    syncActiveChatMeta(friend.id)
  } finally {
    movingGroupFriendId.value = null
  }
}

const getFriendMenu = (friend: Friend) =>
  createFriendContextMenu({
    friend,
    deletingFriendId: deletingFriendId.value,
    groups: friendGroups.value.map((group) => ({
      groupId: String(group.groupId),
      groupName: group.groupName,
    })),
    onDeleteFriend: (currentFriend) => {
      void requestDeleteFriend(currentFriend)
    },
    onSetRemark: (currentFriend) => {
      requestSetRemark(currentFriend)
    },
    onMoveGroup: (currentFriend, targetGroupId) => {
      void moveFriendGroup(currentFriend, targetGroupId)
    },
  })

onMounted(() => {
  void fetchFriendGroups()
  if (isElectron) {
    p.on('group-updated', () => {
      void fetchFriendGroups()
    })
  }
})
</script>

<template>
  <div>
    <div class="flex items-center justify-between border-b border-border/40 px-3 py-2">
      <span class="text-xs font-semibold text-muted-foreground">我的好友</span>
      <Button
        variant="ghost"
        size="icon"
        class="h-6 w-6 text-muted-foreground"
        @click="handleManageGroups"
      >
        <Settings class="h-3.5 w-3.5" />
      </Button>
    </div>

    <Accordion type="multiple" class="w-full" :default-value="expandedGroupIds">
      <AccordionItem
        v-for="group in friendGroups"
        :key="group.groupId"
        :value="String(group.groupId)"
        class="border-none"
      >
        <AccordionTrigger
          class="px-3 py-2 text-xs font-bold text-muted-foreground hover:bg-muted/30 hover:no-underline"
        >
          {{ group.groupName }}
          <span class="ml-auto text-[10px] opacity-70">{{ group.children.length }}</span>
        </AccordionTrigger>
        <AccordionContent class="pb-0">
          <QuickContextMenu
            v-for="friend in group.children"
            :key="friend.id"
            :menu="getFriendMenu(friend)"
            trigger="contextmenu"
            trigger-class="w-full"
          >
            <div
              :class="
                cn(
                  'ml-1 flex items-center gap-3 rounded-lg px-3 py-2 transition-colors',
                  chatStore.activeChatId === friend.id
                    ? 'bg-primary/10 text-primary'
                    : 'cursor-pointer hover:bg-muted/50',
                )
              "
              @click="
                chatStore.setActiveChat({
                  id: friend.id,
                  title: friend.showName || friend.nickname || friend.id,
                  avatar: friend.avatar || '',
                  type: 1,
                  subTitle: '在线',
                })
              "
            >
              <Avatar class="h-9 w-9">
                <AvatarImage :src="friend.avatar || ''" />
                <AvatarFallback>{{
                  (friend.showName || friend.nickname || '?')[0]
                }}</AvatarFallback>
              </Avatar>
              <span class="text-sm font-medium">{{ friend.showName || friend.nickname }}</span>
            </div>
          </QuickContextMenu>
        </AccordionContent>
      </AccordionItem>
    </Accordion>

    <Dialog v-if="!isElectron" v-model:open="confirmDialogOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>删除好友</DialogTitle>
          <DialogDescription>
            确认删除“{{
              pendingDeleteFriend?.showName || pendingDeleteFriend?.nickname
            }}”吗？这是单向删除。
          </DialogDescription>
        </DialogHeader>

        <DialogFooter class="gap-2">
          <Button variant="outline" :disabled="!!deletingFriendId" @click="closeDeleteDialog">
            取消
          </Button>
          <Button variant="destructive" :disabled="!!deletingFriendId" @click="confirmDeleteFriend">
            确认删除
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="remarkDialogOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>设置备注</DialogTitle>
          <DialogDescription>
            为“{{ pendingRemarkFriend?.showName || pendingRemarkFriend?.nickname }}”设置备注名。
          </DialogDescription>
        </DialogHeader>

        <div class="space-y-2">
          <Input
            v-model="remarkValue"
            placeholder="输入备注（留空则清空备注）"
            maxlength="24"
            @keyup.enter="submitRemark"
          />
          <p class="text-xs text-muted-foreground">优先显示备注，未设置时显示昵称。</p>
        </div>

        <DialogFooter class="gap-2">
          <Button variant="outline" :disabled="savingRemark" @click="closeRemarkDialog"
            >取消</Button
          >
          <Button :disabled="savingRemark" @click="submitRemark">保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog v-if="!isElectron" v-model:open="manageGroupOpen">
      <DialogContent
        class="overflow-hidden border-none bg-background p-0 sm:max-w-md"
        :show-close-button="false"
      >
        <GroupManager @close="manageGroupOpen = false" @update="fetchFriendGroups" />
      </DialogContent>
    </Dialog>
  </div>
</template>
