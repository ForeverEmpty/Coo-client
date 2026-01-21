import { ref } from 'vue'

const activeTooltipId = ref<string | null>(null)

export function useTooltipManager() {
  const setActiveTooltip = (id: string | null) => {
    activeTooltipId.value = id
  }

  return {
    activeTooltipId,
    setActiveTooltip,
  }
}
