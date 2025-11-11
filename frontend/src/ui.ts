import { STAGE_BASE_CLASS } from './constants'
import type { Kit, UiRefs } from './types'

export type PreviewHandlers = {
  onPrev: () => void
  onNext: () => void
  onToggleFullscreen: () => void
}

export function buildPreviewStage(kit: Kit, handlers: PreviewHandlers): { refs: UiRefs } {
  const previewStage = kit.h(
    'div',
    { className: `${STAGE_BASE_CLASS} ${STAGE_BASE_CLASS}--loading`, tabIndex: 0 },
    'Loading…',
  ) as HTMLElement

  const prevButton = kit.button({ label: '<', className: 'refmd-marp-pagination-btn', disabled: true }) as HTMLButtonElement
  prevButton.addEventListener('click', handlers.onPrev)

  const nextButton = kit.button({ label: '>', className: 'refmd-marp-pagination-btn', disabled: true }) as HTMLButtonElement
  nextButton.addEventListener('click', handlers.onNext)

  const fullscreenButton = kit.button({
    label: '⤢',
    className: 'refmd-marp-pagination-btn refmd-marp-pagination-btn--icon',
    disabled: true,
  }) as HTMLButtonElement
  fullscreenButton.setAttribute('aria-label', 'Toggle full screen')
  fullscreenButton.addEventListener('click', handlers.onToggleFullscreen)

  const paginationLabel = kit.h('span', { className: 'refmd-marp-pagination-label' }, '0 / 0') as HTMLElement

  const paginationGroup = kit.h(
    'div',
    { className: 'refmd-marp-pagination flex items-center gap-1' },
    prevButton,
    paginationLabel,
    nextButton,
  ) as HTMLElement

  const paginationContainer = kit.h(
    'div',
    { className: 'refmd-marp-pagination-container' },
    paginationGroup,
    fullscreenButton,
  ) as HTMLElement

  const paginationFooter = kit.h('div', { className: 'refmd-marp-pagination-footer' }, paginationContainer) as HTMLElement

  const stageShell = kit.h('div', { className: 'refmd-marp-stage-shell flex-1 min-h-0' }, previewStage, paginationFooter) as HTMLElement

  const root = kit.h('div', { className: 'refmd-marp-preview-root flex h-full w-full flex-1 flex-col gap-4' }, stageShell) as HTMLElement

  return {
    refs: {
      root,
      previewStage,
      paginationLabel,
      prevButton,
      nextButton,
      fullscreenButton,
      stageShell,
    },
  }
}
