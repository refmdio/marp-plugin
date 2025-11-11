import type { createKit } from '@refmdio/plugin-sdk'

export type HeaderAction = {
  id?: string
  label: string
  disabled?: boolean
  variant?: 'default' | 'primary' | 'outline'
  onSelect: () => void
}

export type UiRefs = {
  root: HTMLElement
  previewStage: HTMLElement
  paginationLabel: HTMLElement
  prevButton: HTMLButtonElement
  nextButton: HTMLButtonElement
  fullscreenButton: HTMLButtonElement
  stageShell: HTMLElement
}

export type UiState = {
  docId: string | null
  markdown: string
  previewHtml: string
  previewCss: string
  renderError: string | null
  loading: boolean
  statusMessage: string
  slideCount: number
  currentSlide: number
}

export type Kit = ReturnType<typeof createKit>
