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
    statusMessage: 'Preparing Marp preview…',
    slideCount: 0,
    currentSlide: 0,
  }
}
