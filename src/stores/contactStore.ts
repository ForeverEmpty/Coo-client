import { defineStore } from 'pinia'
import { ref } from 'vue'
import { socialApi } from '@/api/social'
import type { FriendGroup } from '@/api/types'

export interface GroupChatMeta {
  id: string
  name: string
  avatar?: string
  subTitle?: string
}

const DEFAULT_GROUP_CHATS: GroupChatMeta[] = [
  { id: 'group_1', name: 'Coo Chat 开发群', avatar: '', subTitle: '群聊' },
  { id: 'group_2', name: '周末活动群', avatar: '', subTitle: '群聊' },
]

export const useContactStore = defineStore('contact', () => {
  const friendGroups = ref<FriendGroup[]>([])
  const groupChats = ref<GroupChatMeta[]>(DEFAULT_GROUP_CHATS)
  const friendGroupsLoaded = ref(false)
  const loadingFriendGroups = ref(false)

  const fetchFriendGroups = async (force = false) => {
    if (loadingFriendGroups.value) return
    if (friendGroupsLoaded.value && !force) return

    loadingFriendGroups.value = true
    try {
      const res = await socialApi.getFriendList()
      friendGroups.value = res.data || []
      friendGroupsLoaded.value = true
    } finally {
      loadingFriendGroups.value = false
    }
  }

  return {
    friendGroups,
    groupChats,
    friendGroupsLoaded,
    loadingFriendGroups,
    fetchFriendGroups,
  }
})
