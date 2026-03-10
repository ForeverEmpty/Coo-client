<script setup lang="ts">
import type { Friend } from '@/api/types'
import { computed, onMounted, ref } from 'vue'
import { Plus, Search } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { contactTab } from '@/config/contact'
import { usePlatform } from '@/composables/usePlatform'
import { useSuggestionNavigator } from '@/composables/useSuggestionNavigator'
import { useChatStore } from '@/stores/chatStore'
import { useContactStore, type GroupChatMeta } from '@/stores/contactStore'
import FriendTab from '@/views/contacts/components/tabs/FriendTab.vue'
import GroupTab from '@/views/contacts/components/tabs/GroupTab.vue'
import NewFriendTab from '@/views/contacts/components/tabs/NewFriendTab.vue'

type ContactTabId = (typeof contactTab)[number]['id']

interface FriendSuggestion {
  kind: 'friend'
  key: string
  label: string
  subtitle: string
  friend: Friend
}

interface GroupSuggestion {
  kind: 'group'
  key: string
  label: string
  subtitle: string
  group: GroupChatMeta
}

type ContactSuggestion = FriendSuggestion | GroupSuggestion

const MAX_SUGGESTIONS_PER_SECTION = 8

const router = useRouter()
const { p, isElectron } = usePlatform()
const chatStore = useChatStore()
const contactStore = useContactStore()

const currentTab = ref<ContactTabId>('friends')
const searchKeyword = ref('')
const suggestionVisible = ref(false)

const normalizedKeyword = computed(() => searchKeyword.value.trim().toLowerCase())

const friendSuggestions = computed<FriendSuggestion[]>(() => {
  const keyword = normalizedKeyword.value
  if (!keyword) return []

  const result: FriendSuggestion[] = []
  for (const group of contactStore.friendGroups) {
    for (const friend of group.children) {
      const fields = [friend.showName, friend.remark, friend.nickname, String(friend.id || '')]
      const matched = fields.some((field) => String(field || '').toLowerCase().includes(keyword))
      if (!matched) continue

      result.push({
        kind: 'friend',
        key: `friend-${friend.id}`,
        label: friend.showName || friend.nickname || String(friend.id),
        subtitle: group.groupName,
        friend,
      })
      if (result.length >= MAX_SUGGESTIONS_PER_SECTION) {
        return result
      }
    }
  }
  return result
})

const groupSuggestions = computed<GroupSuggestion[]>(() => {
  const keyword = normalizedKeyword.value
  if (!keyword) return []

  return contactStore.groupChats
    .filter((group) => {
      return (
        String(group.name || '').toLowerCase().includes(keyword) ||
        String(group.id || '').toLowerCase().includes(keyword)
      )
    })
    .slice(0, MAX_SUGGESTIONS_PER_SECTION)
    .map((group) => ({
      kind: 'group' as const,
      key: `group-${group.id}`,
      label: group.name,
      subtitle: group.subTitle || '群聊',
      group,
    }))
})

const allSuggestions = computed<ContactSuggestion[]>(() => [
  ...friendSuggestions.value,
  ...groupSuggestions.value,
])

const showSuggestionPanel = computed(
  () => suggestionVisible.value && normalizedKeyword.value.length > 0,
)
const hasSuggestions = computed(() => allSuggestions.value.length > 0)

const openFriendChat = (friend: Friend) => {
  currentTab.value = 'friends'
  chatStore.setActiveChat({
    id: String(friend.id),
    title: friend.showName || friend.nickname || String(friend.id),
    avatar: friend.avatar || '',
    type: 1,
    subTitle: '私聊',
  })
}

const openGroupChat = (group: GroupChatMeta) => {
  currentTab.value = 'groups'
  chatStore.setActiveChat({
    id: group.id,
    title: group.name,
    avatar: group.avatar || '',
    type: 2,
    subTitle: group.subTitle || '群聊',
  })
}

const selectSuggestion = (item: ContactSuggestion) => {
  if (item.kind === 'friend') {
    openFriendChat(item.friend)
  } else {
    openGroupChat(item.group)
  }
  searchKeyword.value = item.label
  suggestionVisible.value = false
  resetHighlight()
}

const { highlightedIndex, handleKeydown, resetHighlight } = useSuggestionNavigator<ContactSuggestion>({
  items: allSuggestions,
  onSelect: selectSuggestion,
})

const handleSearchFocus = () => {
  suggestionVisible.value = true
}

const handleSearchInput = () => {
  suggestionVisible.value = true
}

const handleSearchBlur = () => {
  setTimeout(() => {
    suggestionVisible.value = false
    resetHighlight()
  }, 120)
}

const handleSearchKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    suggestionVisible.value = false
    resetHighlight()
    return
  }

  const handled = handleKeydown(event, showSuggestionPanel.value)
  if (handled && event.key === 'Enter') {
    suggestionVisible.value = false
    resetHighlight()
  }
}

const getSuggestionIndex = (kind: ContactSuggestion['kind'], localIndex: number) => {
  if (kind === 'friend') return localIndex
  return friendSuggestions.value.length + localIndex
}

const handleAddClick = () => {
  if (isElectron) {
    p.send('open-search-window')
  } else {
    router.push('/contacts/add')
  }
}

onMounted(() => {
  void contactStore.fetchFriendGroups()
  void contactStore.fetchGroupChats()
})
</script>

<template>
  <div class="flex h-full flex-col border-r bg-background/50">
    <div class="space-y-3 p-3 pb-2">
      <div class="flex items-center gap-2">
        <div class="relative flex-1">
          <Search class="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            v-model="searchKeyword"
            placeholder="搜索好友或群聊"
            class="h-9 border-none bg-muted/50 pl-9 no-drag"
            @focus="handleSearchFocus"
            @blur="handleSearchBlur"
            @input="handleSearchInput"
            @keydown="handleSearchKeydown"
          />

          <div
            v-if="showSuggestionPanel"
            class="absolute z-30 mt-1 w-full rounded-md border bg-popover p-1 shadow-md"
          >
            <div v-if="hasSuggestions" class="max-h-72 overflow-auto">
              <div v-if="friendSuggestions.length > 0" class="pb-1">
                <p class="px-2 py-1 text-[11px] font-semibold text-muted-foreground">好友候选</p>
                <button
                  v-for="(item, index) in friendSuggestions"
                  :key="item.key"
                  type="button"
                  class="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-sm"
                  :class="
                    cn(
                      getSuggestionIndex('friend', index) === highlightedIndex
                        ? 'bg-accent text-accent-foreground'
                        : 'hover:bg-accent/60',
                    )
                  "
                  @mousedown.prevent="selectSuggestion(item)"
                >
                  <span class="truncate">{{ item.label }}</span>
                  <span class="ml-2 shrink-0 text-xs text-muted-foreground">{{ item.subtitle }}</span>
                </button>
              </div>

              <div v-if="groupSuggestions.length > 0">
                <p class="px-2 py-1 text-[11px] font-semibold text-muted-foreground">群聊候选</p>
                <button
                  v-for="(item, index) in groupSuggestions"
                  :key="item.key"
                  type="button"
                  class="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-sm"
                  :class="
                    cn(
                      getSuggestionIndex('group', index) === highlightedIndex
                        ? 'bg-accent text-accent-foreground'
                        : 'hover:bg-accent/60',
                    )
                  "
                  @mousedown.prevent="selectSuggestion(item)"
                >
                  <span class="truncate">{{ item.label }}</span>
                  <span class="ml-2 shrink-0 text-xs text-muted-foreground">{{ item.subtitle }}</span>
                </button>
              </div>
            </div>

            <p v-else class="px-2 py-2 text-xs text-muted-foreground">没有匹配结果</p>
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          class="h-9 w-9 shrink-0 bg-muted/50 no-drag hover:bg-primary/10 hover:text-primary"
          @click="handleAddClick"
        >
          <Plus class="h-5 w-5" />
        </Button>
      </div>

      <div class="grid grid-cols-3 rounded-lg bg-muted/50 p-1 select-none">
        <div
          v-for="tab in contactTab"
          :key="tab.id"
          :class="
            cn(
              'flex cursor-pointer items-center justify-center gap-1 rounded-md py-1.5 text-xs font-medium transition-all',
              currentTab === tab.id
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )
          "
          @click="currentTab = tab.id"
        >
          <component :is="tab.icon" class="h-3.5 w-3.5" />
          {{ tab.label }}
        </div>
      </div>
    </div>

    <ScrollArea class="min-h-0 flex-1 px-1">
      <Transition name="fade" mode="out-in">
        <FriendTab v-if="currentTab === 'friends'" key="friends" :search-keyword="searchKeyword" />
        <GroupTab v-else-if="currentTab === 'groups'" key="groups" :search-keyword="searchKeyword" />
        <NewFriendTab v-else key="new" />
      </Transition>
    </ScrollArea>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
