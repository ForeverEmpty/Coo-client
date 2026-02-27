import type { Component } from "vue"

export type QuickContextMenuTrigger = "contextmenu" | "click" | "hover"

export type QuickContextMenuEntry =
  | {
      type: "separator"
      key?: string
      hidden?: boolean
    }
  | {
      type: "label"
      key?: string
      label: string
      hidden?: boolean
      inset?: boolean
    }
  | {
      type: "submenu"
      key: string
      label: string
      items: QuickContextMenuEntry[]
      icon?: Component
      shortcut?: string
      disabled?: boolean
      hidden?: boolean
      inset?: boolean
    }
  | {
      type?: "item"
      key: string
      label: string
      icon?: Component
      shortcut?: string
      disabled?: boolean
      destructive?: boolean
      hidden?: boolean
      keepOpen?: boolean
      onSelect?: (item: QuickContextMenuEntry) => void
    }
