import FriendTab from '@/views/contacts/components/tabs/FriendTab.vue'
import GroupTab from '@/views/contacts/components/tabs/GroupTab.vue'
import NewFriendTab from '@/views/contacts/components/tabs/NewFriendTab.vue'
import { UserPlus, Users, UsersRound } from 'lucide-vue-next'

export const contactTab = [
  { id: 'friends', label: '好友', icon: Users, component: FriendTab },
  { id: 'groups', label: '群聊', icon: UsersRound, component: GroupTab },
  { id: 'new', label: '新朋友', icon: UserPlus, component: NewFriendTab },
] as const
