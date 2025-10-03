import { STAGE_BASE_CLASS, TOOLBAR_ACTIONS, TOOLBAR_LABELS, TOOLBAR_TITLES } from './constants'
import type { Kit, ToolbarAction, UiRefs } from './types'

export type UiEventHandlers = {
  onTextareaInput: (event: Event) => void
  onPrev: () => void
  onNext: () => void
  onToggleFullscreen: () => void
  onToolbarAction: (action: ToolbarAction) => void
}

export type BuildUiResult = {
  refs: UiRefs
  toolbarButtons: HTMLButtonElement[]
}

export function buildUi(kit: Kit, initialMarkdown: string, handlers: UiEventHandlers): BuildUiResult {
  const { toolbar, toolbarButtons } = buildToolbar(kit, handlers.onToolbarAction)

  const textarea = kit.textarea({
    value: initialMarkdown,
    rows: 24,
    className: 'refmd-marp-textarea flex-1 resize-none font-mono text-sm',
    disabled: true,
  }) as HTMLTextAreaElement
  textarea.addEventListener('input', handlers.onTextareaInput)

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

  const editorToolbarRow = kit.h('div', { className: 'refmd-marp-editor-toolbar-row' }, toolbar) as HTMLElement

  const editorPane = kit.h(
    'div',
    { className: 'refmd-marp-editor refmd-marp-pane refmd-marp-card' },
    editorToolbarRow,
    textarea,
  ) as HTMLElement

  const stageShell = kit.h('div', { className: 'refmd-marp-stage-shell' }, previewStage, paginationFooter) as HTMLElement

  const previewPane = kit.h(
    'div',
    { className: 'refmd-marp-preview refmd-marp-pane refmd-marp-card' },
    stageShell,
  ) as HTMLElement

  const shell = kit.h('div', { className: 'refmd-marp-shell flex flex-1 gap-4 min-h-0' }, editorPane, previewPane) as HTMLElement
  const root = kit.h('div', { className: 'refmd-marp refmd-marp-root flex flex-col gap-4 h-full' }, shell) as HTMLElement

  return {
    refs: {
      root,
      textarea,
      previewStage,
      paginationLabel,
      prevButton,
      nextButton,
      fullscreenButton,
      toolbar,
      stageShell,
    },
    toolbarButtons,
  }
}

function buildToolbar(kit: Kit, onAction: (action: ToolbarAction) => void) {
  const toolbarButtons: HTMLButtonElement[] = []
  const items: Node[] = []

  for (const item of TOOLBAR_ACTIONS) {
    if (item === 'divider') {
      items.push(
        kit.h('span', { className: 'refmd-marp-toolbar__divider', 'aria-hidden': 'true' }),
      )
      continue
    }

    const button = kit.h(
      'button',
      {
        type: 'button',
        className: 'refmd-marp-toolbar__btn',
        title: TOOLBAR_TITLES[item],
        'aria-label': TOOLBAR_TITLES[item],
        'data-action': item,
        onClick: (event: Event) => {
          event.preventDefault()
          onAction(item)
        },
      },
      TOOLBAR_LABELS[item],
    ) as HTMLButtonElement

    toolbarButtons.push(button)
    items.push(button)
  }

  const toolbar = kit.h(
    'div',
    { className: 'refmd-marp-toolbar', role: 'toolbar', 'aria-label': 'Markdown formatting' },
    items,
  ) as HTMLElement

  return { toolbar, toolbarButtons }
}
