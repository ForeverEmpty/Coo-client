<script setup lang="ts">
import type { Friend, FriendGroup } from '@/api/types'

import { onMounted, ref } from 'vue'
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

const handleManageGroups = () => {
  if (isElectron) {
    p.send('open-window', {
      type: 'GROUP_MANAGE',
      route: '/contacts/group-manage',
    })
  } else {
    manageGroupOpen.value = true
  }
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

const deleteFriend = async (friend: Friend) => {
  if (deletingFriendId.value) return

  deletingFriendId.value = friend.id
  try {
    await socialApi.deleteFriend(friend.id)

    if (chatStore.activeChatId === friend.id) {
      chatStore.activeChatId = null
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

const getFriendMenu = (friend: Friend) =>
  createFriendContextMenu({
    friend,
    deletingFriendId: deletingFriendId.value,
    onDeleteFriend: (currentFriend) => {
      void requestDeleteFriend(currentFriend)
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
    <div class="px-3 py-2 flex items-center justify-between border-b border-border/40">
      <span class="text-xs font-semibold text-muted-foreground">我的好友</span>
      <Button
        variant="ghost"
        size="icon"
        class="h-6 w-6 text-muted-foreground"
        @click="handleManageGroups"
      >
        <Settings class="w-3.5 h-3.5" />
      </Button>
    </div>
    <Accordion type="multiple" class="w-full" :default-value="['g1', 'g2']">
      <AccordionItem
        v-for="g in friendGroups"
        :key="g.groupId"
        :value="g.groupId"
        class="border-none"
      >
        <AccordionTrigger
          class="px-3 py-2 text-xs font-bold text-muted-foreground hover:bg-muted/30 hover:no-underline"
        >
          {{ g.groupName }}
          <span class="ml-auto text-[10px] opacity-70">{{ g.children.length }}</span>
        </AccordionTrigger>
        <AccordionContent class="pb-0">
          <QuickContextMenu
            v-for="friend in g.children"
            :key="friend.id"
            :menu="getFriendMenu(friend)"
            trigger="contextmenu"
            trigger-class="w-full"
          >
            <div
              @click="chatStore.setActiveChat(friend.id)"
              :class="
                cn(
                  'ml-1 flex items-center gap-3 rounded-lg px-3 py-2 transition-colors',
                  chatStore.activeChatId === friend.id
                    ? 'bg-primary/10 text-primary'
                    : 'cursor-pointer hover:bg-muted/50',
                )
              "
            >
              <Avatar class="h-9 w-9">
                <AvatarImage :src="friend.avatar || ''" />
                <AvatarFallback>{{ friend.showName[0] }}</AvatarFallback>
              </Avatar>
              <span class="text-sm font-medium">{{ friend.showName || '' }}</span>
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

    <Dialog v-if="!isElectron" v-model:open="manageGroupOpen">
      <DialogContent
        class="sm:max-w-md p-0 overflow-hidden border-none bg-background"
        :show-close-button="false"
      >
        <GroupManager @close="manageGroupOpen = false" @update="fetchFriendGroups" />
      </DialogContent>
    </Dialog>
  </div>
</template>
