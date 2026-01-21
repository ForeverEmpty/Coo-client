<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import type { TooltipContentProps } from 'reka-ui'
import { onUnmounted, ref, watch } from 'vue'
import { useVModel } from '@vueuse/core'

import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useTooltipManager } from '@/composables/useTooltipManager'

interface Props {
  modelValue?: string | number
  pattern?: string | RegExp
  tooltip?: boolean
  align?: TooltipContentProps['align']
  side?: TooltipContentProps['side']
  alignOffset?: TooltipContentProps['alignOffset']
  sideOffset?: TooltipContentProps['sideOffset']
  defaultValue?: string | number
  tooltipId?: string
  class?: HTMLAttributes['class']
}

const props = withDefaults(defineProps<Props>(), {
  tooltip: true,
  align: 'start',
  side: 'bottom',
  sideOffset: -4,
  alignOffset: 10,
  tooltipId: `validated-input-tooltip`,
})
const emits = defineEmits(['update:modelValue', 'blur', 'validate'])

const modelValue = useVModel(props, 'modelValue', emits)

const { activeTooltipId, setActiveTooltip } = useTooltipManager()

const isValid = ref(true)
const isFocused = ref(false)
const hasInteracted = ref(false)

const validate = (val: string | number) => {
  if (!props.pattern) return true
  const regex = typeof props.pattern === 'string' ? new RegExp(props.pattern) : props.pattern
  return regex.test(String(val))
}

const handleBlur = (event: FocusEvent) => {
  isFocused.value = false
  hasInteracted.value = true
  const result = validate(modelValue.value || '')
  isValid.value = result

  if (!result) {
    setActiveTooltip(props.tooltipId)
  } else if (activeTooltipId.value === props.tooltipId) {
    setActiveTooltip(null)
  }

  emits('blur', event)
  emits('validate', isValid.value)
}

const handleFocus = () => {
  isFocused.value = true

  if (activeTooltipId.value === props.tooltipId) {
    setActiveTooltip(null)
  }
}

watch(modelValue, () => {
  if (!isValid.value) {
    isValid.value = true

    if (activeTooltipId.value === props.tooltipId) {
      setActiveTooltip(null)
    }
  }
})

onUnmounted(() => {
  if (activeTooltipId.value === props.tooltipId) {
    setActiveTooltip(null)
  }
})
</script>

<template>
  <TooltipProvider :delay-duration="0">
    <Tooltip
      :open="
        tooltip && !isValid && !isFocused && hasInteracted && activeTooltipId === props.tooltipId
      "
    >
      <TooltipTrigger as-child>
        <div class="w-full">
          <Input
            v-model="modelValue"
            v-bind="$attrs"
            :class="
              cn(
                'transition-all duration-200',
                !isValid && 'border-destructive ring-destructive focus-visible:ring-destructive',
                props.class,
              )
            "
            @blur="handleBlur"
            @focus="handleFocus"
          />
        </div>
      </TooltipTrigger>
      <TooltipContent
        :align="align"
        :side="side"
        :align-offset="alignOffset"
        :side-offset="sideOffset"
      >
        <slot name="message">格式输入有误</slot>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
</template>
