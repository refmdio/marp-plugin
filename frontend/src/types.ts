import type { createKit } from '@refmdio/plugin-sdk'

export type ToolbarAction =
  | 'bold'
  | 'italic'
  | 'heading'
  | 'quote'
  | 'code'
  | 'link'
  | 'list'
  | 'list-ordered'
  | 'table'

export type HeaderAction = {
  id?: string
  label: string
  disabled?: boolean
  variant?: 'default' | 'primary' | 'outline'
  onSelect: () => void
}

export type UiRefs = {
  root: HTMLElement
  textarea: HTMLTextAreaElement
  previewStage: HTMLElement
  paginationLabel: HTMLElement
  prevButton: HTMLButtonElement
  nextButton: HTMLButtonElement
  fullscreenButton: HTMLButtonElement
  toolbar: HTMLElement
  stageShell: HTMLElement
}

export type UiState = {
  docId: string | null
  markdown: string
  previewHtml: string
  previewCss: string
  renderError: string | null
  loading: boolean
  saving: boolean
  dirty: boolean
  lastSavedAt: string | null
  statusMessage: string
  slideCount: number
  currentSlide: number
}

export type ApplyOptions = {
  syncTextarea?: boolean
  preserveSelection?: boolean
}

export type Kit = ReturnType<typeof createKit>
