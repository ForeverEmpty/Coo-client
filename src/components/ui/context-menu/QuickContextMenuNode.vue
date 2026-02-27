<script setup lang="ts">
import type { QuickContextMenuEntry } from "./types"
import { computed } from "vue"
import {
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from "."

const props = defineProps<{
  menu: QuickContextMenuEntry[]
}>()

const emit = defineEmits<{
  select: [item: QuickContextMenuEntry]
}>()

const visibleMenu = computed(() => props.menu.filter(item => !item.hidden))

const onMenuItemSelect = (item: QuickContextMenuEntry, event: Event) => {
  if (item.type === "separator" || item.type === "label" || item.type === "submenu") return
  if (item.keepOpen) event.preventDefault()

  item.onSelect?.(item)
  emit("select", item)
}

const onChildSelect = (item: QuickContextMenuEntry) => {
  emit("select", item)
}
</script>

<template>
  <template
    v-for="(item, index) in visibleMenu"
    :key="item.key || `${item.type || 'item'}-${index}`"
  >
    <ContextMenuSeparator v-if="item.type === 'separator'" />

    <ContextMenuLabel
      v-else-if="item.type === 'label'"
      :inset="item.inset"
    >
      {{ item.label }}
    </ContextMenuLabel>

    <ContextMenuSub v-else-if="item.type === 'submenu'">
      <ContextMenuSubTrigger
        :disabled="item.disabled"
        :inset="item.inset"
      >
        <component
          :is="item.icon"
          v-if="item.icon"
        />
        {{ item.label }}
        <ContextMenuShortcut v-if="item.shortcut">
          {{ item.shortcut }}
        </ContextMenuShortcut>
      </ContextMenuSubTrigger>
      <ContextMenuSubContent>
        <QuickContextMenuNode
          :menu="item.items"
          @select="onChildSelect"
        />
      </ContextMenuSubContent>
    </ContextMenuSub>

    <ContextMenuItem
      v-else
      :variant="item.destructive ? 'destructive' : 'default'"
      :disabled="item.disabled"
      @select="onMenuItemSelect(item, $event)"
    >
      <component
        :is="item.icon"
        v-if="item.icon"
      />
      {{ item.label }}
      <ContextMenuShortcut v-if="item.shortcut">
        {{ item.shortcut }}
      </ContextMenuShortcut>
    </ContextMenuItem>
  </template>
</template>

