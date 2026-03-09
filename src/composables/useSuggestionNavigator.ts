import { ref, watch, type Ref } from 'vue'

interface UseSuggestionNavigatorOptions<T> {
  items: Ref<T[]>
  onSelect: (item: T) => void
}

export function useSuggestionNavigator<T>(options: UseSuggestionNavigatorOptions<T>) {
  const { items, onSelect } = options
  const highlightedIndex = ref(-1)

  watch(
    items,
    (nextItems) => {
      if (nextItems.length === 0) {
        highlightedIndex.value = -1
        return
      }
      if (highlightedIndex.value >= nextItems.length) {
        highlightedIndex.value = 0
      }
    },
    { immediate: true },
  )

  const resetHighlight = () => {
    highlightedIndex.value = -1
  }

  const move = (delta: 1 | -1) => {
    const total = items.value.length
    if (total === 0) {
      highlightedIndex.value = -1
      return
    }

    if (highlightedIndex.value < 0) {
      highlightedIndex.value = delta > 0 ? 0 : total - 1
      return
    }

    const next = (highlightedIndex.value + delta + total) % total
    highlightedIndex.value = next
  }

  const selectByIndex = (index: number) => {
    const target = items.value[index]
    if (!target) return false
    onSelect(target)
    return true
  }

  const selectActiveOrFirst = () => {
    if (items.value.length === 0) return false
    if (highlightedIndex.value >= 0) {
      return selectByIndex(highlightedIndex.value)
    }
    return selectByIndex(0)
  }

  const handleKeydown = (event: KeyboardEvent, enabled: boolean) => {
    if (!enabled) return false

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      move(1)
      return true
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      move(-1)
      return true
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      return selectActiveOrFirst()
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      resetHighlight()
      return true
    }
    return false
  }

  return {
    highlightedIndex,
    resetHighlight,
    move,
    selectByIndex,
    selectActiveOrFirst,
    handleKeydown,
  }
}
