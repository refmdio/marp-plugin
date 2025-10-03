import { DEFAULT_MARKDOWN } from './constants'
import type { UiState } from './types'

export function createInitialState(docId: string | null): UiState {
  return {
    docId,
    markdown: DEFAULT_MARKDOWN,
    previewHtml: '',
    previewCss: '',
    renderError: null,
    loading: true,
    saving: false,
    dirty: false,
    lastSavedAt: null,
    statusMessage: 'Loading Marp deck…',
    slideCount: 0,
    currentSlide: 0,
  }
}

export function extractState(kv: any) {
  if (!kv || typeof kv !== 'object') return null
  if (kv.value && typeof kv.value === 'object') return kv.value
  return kv
}
