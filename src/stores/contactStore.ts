import { defineStore } from 'pinia'
import { ref } from 'vue'
import { socialApi } from '@/api/social'
import type { FriendGroup, GroupListItem } from '@/api/types'
import { useChatStore } from '@/stores/chatStore'

export interface GroupChatMeta {
  id: string
  name: string
  rawName: string
  avatar?: string
  subTitle?: string
  memberCount?: number
  notice?: string
  remark?: string
  myRole?: number
  myTitleName?: string
  myNicknameInGroup?: string
}

const mapGroupToMeta = (group: GroupListItem): GroupChatMeta => ({
  id: `group_${group.id}`,
  name: group.remark || group.name,
  rawName: group.name,
  avatar: group.avatar || '',
  subTitle: '群聊',
  memberCount: group.memberCount,
  notice: group.notice,
  remark: group.remark,
  myRole: group.myRole,
  myTitleName: group.myTitleName,
  myNicknameInGroup: group.myNicknameInGroup,
})

const toGroupSessionSubTitle = (group: GroupChatMeta) =>
  `${group.memberCount || 0} 人 · ${group.myTitleName || '群成员'}`

export const useContactStore = defineStore('contact', () => {
  const friendGroups = ref<FriendGroup[]>([])
  const groupChats = ref<GroupChatMeta[]>([])
  const friendGroupsLoaded = ref(false)
  const loadingFriendGroups = ref(false)
  const groupChatsLoaded = ref(false)
  const loadingGroupChats = ref(false)
  let friendGroupsInFlight: Promise<void> | null = null
  let groupChatsInFlight: Promise<void> | null = null

  const fetchFriendGroups = async (force = false) => {
    if (loadingFriendGroups.value && friendGroupsInFlight) return friendGroupsInFlight
    if (friendGroupsLoaded.value && !force) return

    loadingFriendGroups.value = true
    friendGroupsInFlight = (async () => {
      try {
        const res = await socialApi.getFriendList()
        friendGroups.value = res.data || []
        friendGroupsLoaded.value = true
      } finally {
        loadingFriendGroups.value = false
        friendGroupsInFlight = null
      }
    })()
    return friendGroupsInFlight
  }

  const fetchGroupChats = async (force = false) => {
    if (loadingGroupChats.value && groupChatsInFlight) return groupChatsInFlight
    if (groupChatsLoaded.value && !force) return

    loadingGroupChats.value = true
    groupChatsInFlight = (async () => {
      try {
        const res = await socialApi.getMyGroups()
        const nextGroups = (res.data || []).map(mapGroupToMeta)
        groupChats.value = nextGroups
        groupChatsLoaded.value = true

        const chatStore = useChatStore()
        nextGroups.forEach((group) => {
          chatStore.ensureSession({
            id: group.id,
            title: group.name,
            avatar: group.avatar || '',
            type: 2,
            subTitle: toGroupSessionSubTitle(group),
          })
        })

        const activeChatId = chatStore.activeChatId
        if (
          activeChatId &&
          activeChatId.startsWith('group_') &&
          !nextGroups.some((group) => group.id === activeChatId)
        ) {
          chatStore.setActiveChat(null)
        }
      } finally {
        loadingGroupChats.value = false
        groupChatsInFlight = null
      }
    })()
    return groupChatsInFlight
  }

  return {
    friendGroups,
    groupChats,
    friendGroupsLoaded,
    loadingFriendGroups,
    groupChatsLoaded,
    loadingGroupChats,
    fetchFriendGroups,
    fetchGroupChats,
  }
})
