import { createKit, resolveDocId } from '@refmdio/plugin-sdk'

const PLUGIN_ID = 'marp'
const STATE_KEY = 'marpState'
const DEFAULT_MARKDOWN = `---
marp: true
theme: default
paginate: true
class: lead
---

# Welcome to Marp

- Edit Markdown in the left pane
- Use front-matter directives to configure slides
- Export HTML through the top bar
`

const STAGE_BASE_CLASS = 'refmd-marp-stage'
type UiRefs = {
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

type UiState = {
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

let marpRendererSingleton: any | null = null
let kitRef: ReturnType<typeof createKit> | null = null
let hostRef: any
let refs: UiRefs
let state: UiState
let tokenFromHost: string | undefined
let toolbarButtons: HTMLButtonElement[] = []
let fullscreenListenerAttached = false
type HeaderAction = {
  id?: string
  label: string
  disabled?: boolean
  variant?: 'default' | 'primary' | 'outline'
  onSelect: () => void
}

type ToolbarAction =
  | 'bold'
  | 'italic'
  | 'heading'
  | 'quote'
  | 'code'
  | 'link'
  | 'list'
  | 'list-ordered'
  | 'table'

const TOOLBAR_ACTIONS: Array<ToolbarAction | 'divider'> = [
  'bold',
  'italic',
  'heading',
  'quote',
  'code',
  'divider',
  'link',
  'list',
  'list-ordered',
  'table',
]

const TOOLBAR_LABELS: Record<ToolbarAction, string> = {
  bold: 'B',
  italic: 'I',
  heading: 'H',
  quote: '"',
  code: '<>',
  link: '[]',
  list: '*',
  'list-ordered': '1.',
  table: '#|',
}

const TOOLBAR_TITLES: Record<ToolbarAction, string> = {
  bold: 'Bold',
  italic: 'Italic',
  heading: 'Heading',
  quote: 'Block quote',
  code: 'Inline code',
  link: 'Insert link',
  list: 'Bullet list',
  'list-ordered': 'Numbered list',
  table: 'Table',
}

function setHeaderTitle(title?: string | null) {
  try {
    hostRef?.ui?.setDocumentTitle?.(title ?? undefined)
  } catch {}
}

function setHeaderStatus(status?: string | null) {
  try {
    hostRef?.ui?.setDocumentStatus?.(status ?? undefined)
  } catch {}
}

function setHeaderBadge(badge?: string | null) {
  try {
    hostRef?.ui?.setDocumentBadge?.(badge ?? undefined)
  } catch {}
}

function setHeaderActions(actions: HeaderAction[]) {
  try {
    hostRef?.ui?.setDocumentActions?.(actions)
  } catch {}
}


let previewFrame: number | null = null
let saveTimer: number | null = null

async function loadMarpRenderer() {
  ensureProcessShim()
  if (!marpRendererSingleton) {
    const mod = await import('@marp-team/marp-core')
    marpRendererSingleton = new mod.Marp({ inlineSVG: true })
  }
  return marpRendererSingleton
}

function ensureProcessShim() {
  const globalScope = globalThis as any
  if (!globalScope.process) {
    globalScope.process = { env: { NODE_ENV: 'production' } }
  } else if (!globalScope.process.env) {
    globalScope.process.env = { NODE_ENV: 'production' }
  } else if (typeof globalScope.process.env.NODE_ENV === 'undefined') {
    globalScope.process.env.NODE_ENV = 'production'
  }
}

export default async function mount(container: Element, host: any) {
  const kit = createKit(host)
  kitRef = kit
  hostRef = host
  tokenFromHost = host?.context?.token ?? undefined

  const docId = host?.context?.docId || resolveDocId() || null
  state = {
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

  setHeaderTitle('Marp Slides')
  setHeaderStatus(undefined)
  setHeaderBadge(undefined)
  setHeaderActions([])

  refs = buildUi(kit)
  const baseStyles = kit.h('style', null, getStyles())
  container.append(baseStyles, refs.root)

  refs.textarea.addEventListener('input', handleTextareaInput)
  refs.prevButton.addEventListener('click', () => changeSlide(-1))
  refs.nextButton.addEventListener('click', () => changeSlide(1))
  refs.fullscreenButton.addEventListener('click', () => { void toggleFullscreen() })

  if (typeof document !== 'undefined' && !fullscreenListenerAttached) {
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    const docAny = document as any
    if (typeof docAny?.addEventListener === 'function') {
      docAny.addEventListener('webkitfullscreenchange', handleFullscreenChange)
    }
    fullscreenListenerAttached = true
  }

  container.addEventListener('keydown', onKeydown)

  applyUiState({ syncTextarea: true })

  const marpRenderer = await loadMarpRenderer()
  rendererRef = marpRenderer

  if (state.docId) {
    void initializeDeck(state.docId)
  } else {
    state.loading = false
    state.statusMessage = ''
    applyUiState({ syncTextarea: true })
  }
}

let rendererRef: any = null

function buildToolbar(kit: ReturnType<typeof createKit>): HTMLElement {
  toolbarButtons = []
  const items: Node[] = []
  for (const item of TOOLBAR_ACTIONS) {
    if (item === 'divider') {
      items.push(kit.h('span', { className: 'refmd-marp-toolbar__divider', 'aria-hidden': 'true' }))
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
          handleToolbarAction(item)
        },
      },
      TOOLBAR_LABELS[item],
    ) as HTMLButtonElement
    toolbarButtons.push(button)
    items.push(button)
  }
  return kit.h('div', { className: 'refmd-marp-toolbar', role: 'toolbar', 'aria-label': 'Markdown formatting' }, items)
}

function handleToolbarAction(action: ToolbarAction) {
  const textarea = refs?.textarea
  if (!textarea || textarea.disabled) return

  const wrap = (before: string, after = '') => {
    const start = textarea.selectionStart ?? 0
    const end = textarea.selectionEnd ?? 0
    const value = textarea.value ?? ''
    const selected = value.slice(start, end)
    const insert = before + selected + after
    textarea.value = value.slice(0, start) + insert + value.slice(end)
    const cursorStart = start + before.length
    const cursorEnd = cursorStart + selected.length
    textarea.selectionStart = cursorStart
    textarea.selectionEnd = selected.length ? cursorEnd : cursorStart
  }

  const insertPrefix = (prefix: string) => {
    const start = textarea.selectionStart ?? 0
    const value = textarea.value ?? ''
    const lineStart = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1
    textarea.value = value.slice(0, lineStart) + prefix + value.slice(lineStart)
    const cursor = start + prefix.length
    textarea.selectionStart = cursor
    textarea.selectionEnd = cursor
  }

  const insertSnippet = (snippet: string) => {
    const value = textarea.value ?? ''
    const needsNewline = value.length > 0 && !value.endsWith('\n')
    textarea.value = value + (needsNewline ? '\n' : '') + snippet + '\n'
    const cursor = textarea.value.length
    textarea.selectionStart = cursor
    textarea.selectionEnd = cursor
  }

  switch (action) {
    case 'bold':
      wrap('**', '**')
      break
    case 'italic':
      wrap('*', '*')
      break
    case 'heading':
      insertPrefix('# ')
      break
    case 'quote':
      insertPrefix('> ')
      break
    case 'code':
      wrap('`', '`')
      break
    case 'link': {
      const url = typeof window.prompt === 'function' ? window.prompt('Enter URL') : ''
      if (url) wrap('[', `](${url})`)
      break
    }
    case 'list':
      insertPrefix('- ')
      break
    case 'list-ordered':
      insertPrefix('1. ')
      break
    case 'table':
      insertSnippet('| Column | Column |\n| --- | --- |\n| Cell | Cell |')
      break
    default:
      break
  }

  handleTextareaInput()
}

function buildUi(kit: ReturnType<typeof createKit>): UiRefs {
  const textarea = kit.textarea({
    value: state.markdown,
    rows: 24,
    className: 'refmd-marp-textarea flex-1 resize-none font-mono text-sm',
    disabled: true,
  }) as HTMLTextAreaElement

  const previewStage = kit.h('div', { className: `${STAGE_BASE_CLASS} ${STAGE_BASE_CLASS}--loading`, tabIndex: 0 }, 'Loading…') as HTMLElement

  const prevButton = kit.button({ label: '<', className: 'refmd-marp-pagination-btn', disabled: true }) as HTMLButtonElement
  const nextButton = kit.button({ label: '>', className: 'refmd-marp-pagination-btn', disabled: true }) as HTMLButtonElement
  const fullscreenButton = kit.button({ label: '⤢', className: 'refmd-marp-pagination-btn refmd-marp-pagination-btn--icon', disabled: true }) as HTMLButtonElement
  fullscreenButton.setAttribute('aria-label', 'Toggle full screen')
  const paginationLabel = kit.h('span', { className: 'refmd-marp-pagination-label' }, '0 / 0')
  const paginationGroup = kit.h(
    'div',
    { className: 'refmd-marp-pagination flex items-center gap-1' },
    prevButton,
    paginationLabel,
    nextButton,
  )
  const paginationContainer = kit.h(
    'div',
    { className: 'refmd-marp-pagination-container' },
    paginationGroup,
    fullscreenButton,
  )
  const paginationFooter = kit.h('div', { className: 'refmd-marp-pagination-footer' }, paginationContainer)

  const toolbar = buildToolbar(kit)
  const editorToolbarRow = kit.h('div', { className: 'refmd-marp-editor-toolbar-row' }, toolbar)

  const editorPane = kit.h(
    'div',
    { className: 'refmd-marp-editor refmd-marp-pane refmd-marp-card' },
    editorToolbarRow,
    textarea,
  )

  const stageShell = kit.h('div', { className: 'refmd-marp-stage-shell' }, previewStage, paginationFooter)

  const previewPane = kit.h(
    'div',
    { className: 'refmd-marp-preview refmd-marp-pane refmd-marp-card' },
    stageShell,
  )

  const shell = kit.h('div', { className: 'refmd-marp-shell flex flex-1 gap-4 min-h-0' }, editorPane, previewPane)
  const root = kit.h('div', { className: 'refmd-marp refmd-marp-root flex flex-col gap-4 h-full' }, shell)

  return {
    root,
    textarea,
    previewStage,
    paginationLabel,
    prevButton,
    nextButton,
    fullscreenButton,
    toolbar,
    stageShell,
  }
}

async function initializeDeck(docId: string) {
  state.loading = true
  state.statusMessage = 'Loading Marp deck…'
  applyUiState({ syncTextarea: false })
  try {
    const kv = await hostRef?.api?.getKv?.(PLUGIN_ID, docId, STATE_KEY, tokenFromHost)
    const payload = extractState(kv)
    const markdown = payload?.markdown && typeof payload.markdown === 'string' ? payload.markdown : DEFAULT_MARKDOWN
    state.markdown = markdown
    state.loading = false
    state.dirty = false
    state.lastSavedAt = typeof payload?.updatedAt === 'string' ? payload.updatedAt : null
    state.statusMessage = ''
    state.currentSlide = 0
    state.slideCount = 0
    refs.textarea.value = markdown
    applyUiState({ syncTextarea: false })
    schedulePreview()
  } catch (err) {
    console.error('[marp] load failed', err)
    state.loading = false
    state.statusMessage = 'Failed to load Marp deck'
    state.renderError = 'Failed to load data. Try reloading.'
    state.slideCount = 0
    state.currentSlide = 0
    applyUiState({ syncTextarea: false })
  }
}

function handleTextareaInput() {
  state.markdown = refs.textarea.value
  state.dirty = true
  state.statusMessage = 'Unsaved changes'
  applyUiState({ syncTextarea: false, preserveSelection: true })
  schedulePreview()
  scheduleSave()
}

function schedulePreview() {
  if (previewFrame) cancelAnimationFrame(previewFrame)
  previewFrame = requestAnimationFrame(() => {
    try {
      const rendered = rendererRef?.render(state.markdown)
      if (rendered) {
        state.previewHtml = rendered.html
        state.previewCss = rendered.css
        state.renderError = null
        const count = countSlides(rendered.html)
        state.slideCount = count
        if (count === 0) {
          state.currentSlide = 0
        } else if (state.currentSlide >= count) {
          state.currentSlide = count - 1
        } else if (state.currentSlide < 0) {
          state.currentSlide = 0
        }
      }
    } catch (err: any) {
      console.error('[marp] render failed', err)
      state.previewHtml = ''
      state.previewCss = ''
      state.renderError = err?.message ? String(err.message) : 'Render error'
      state.slideCount = 0
      state.currentSlide = 0
    }
    applyUiState({ syncTextarea: false })
  })
}

function scheduleSave() {
  if (saveTimer) window.clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => {
    void performSave()
  }, 900)
}

async function performSave() {
  if (!state.docId || (!state.dirty && !state.saving)) return
  state.saving = true
  state.statusMessage = 'Saving…'
  applyUiState({ syncTextarea: false })
  try {
    await hostRef?.api?.putKv?.(
      PLUGIN_ID,
      state.docId,
      STATE_KEY,
      {
        markdown: state.markdown,
        updatedAt: new Date().toISOString(),
      },
      tokenFromHost,
    )
    state.saving = false
    state.dirty = false
    state.lastSavedAt = new Date().toISOString()
    state.statusMessage = ''
    applyUiState({ syncTextarea: false })
  } catch (err) {
    console.error('[marp] save failed', err)
    state.saving = false
    state.statusMessage = 'Failed to save'
    applyUiState({ syncTextarea: false })
    kitRef?.toast('error', 'Failed to save Marp deck')
  }
}

function exportPdf() {
  if (!state.previewHtml) return
  const html = buildHtmlExport(state, { injectPrint: false, forPdf: true })
  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  iframe.style.opacity = '0'
  iframe.style.pointerEvents = 'none'
  document.body.appendChild(iframe)

  const cleanup = () => {
    window.setTimeout(() => {
      try { document.body.removeChild(iframe) } catch {}
    }, 250)
  }

  const targetWindow = iframe.contentWindow
  const targetDoc = targetWindow?.document
  if (!targetWindow || !targetDoc) {
    kitRef?.toast('error', 'Unable to prepare PDF export frame')
    cleanup()
    return
  }

  try {
    targetDoc.open()
    targetDoc.write(html)
    targetDoc.close()
  } catch (err) {
    console.error('[marp] pdf export failed', err)
    kitRef?.toast('error', 'Failed to prepare PDF export')
    cleanup()
    return
  }

  const triggerPrint = () => {
    try {
      targetWindow.focus()
      targetWindow.print()
    } catch (err) {
      console.error('[marp] pdf print failed', err)
      kitRef?.toast('error', 'Print dialog could not be opened')
    }
    cleanup()
  }

  if (targetDoc.readyState === 'complete') {
    window.setTimeout(triggerPrint, 80)
  } else {
    const onLoad = () => {
      targetWindow.removeEventListener('load', onLoad)
      window.setTimeout(triggerPrint, 80)
    }
    targetWindow.addEventListener('load', onLoad)
  }
}

function onKeydown(event: KeyboardEvent) {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
    event.preventDefault()
    void performSave()
    return
  }
  if (event.target === refs.textarea) return
  if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
    event.preventDefault()
    changeSlide(-1)
  } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
    event.preventDefault()
    changeSlide(1)
  }
}

type ApplyOptions = { syncTextarea?: boolean; preserveSelection?: boolean }


function applyUiState(options: ApplyOptions = {}) {
  const { syncTextarea = false, preserveSelection = false } = options

  if (!state.slideCount) {
    state.currentSlide = 0
  } else if (state.currentSlide >= state.slideCount) {
    state.currentSlide = state.slideCount - 1
  } else if (state.currentSlide < 0) {
    state.currentSlide = 0
  }

  setHeaderBadge(undefined)
  setHeaderStatus(undefined)

  let inlineStatus = state.statusMessage
  if (!inlineStatus) {
    if (state.loading) inlineStatus = 'Loading…'
    else if (!state.docId) inlineStatus = ''
    else if (state.dirty) inlineStatus = 'Unsaved changes'
    else inlineStatus = ''
  }
  setHeaderStatus(inlineStatus || undefined)

  const slideCount = state.slideCount
  refs.paginationLabel.textContent = slideCount ? `${state.currentSlide + 1} / ${slideCount}` : '0 / 0'
  const navDisabled = state.loading || slideCount === 0
  refs.prevButton.disabled = navDisabled || state.currentSlide <= 0
  refs.nextButton.disabled = navDisabled || state.currentSlide >= Math.max(slideCount - 1, 0)

  const canFullscreen = !state.loading && !!state.previewHtml && !!refs.stageShell
  refs.fullscreenButton.disabled = !canFullscreen
  updateFullscreenButton()

  const toolbarDisabled = !state.docId || state.loading
  toolbarButtons.forEach((btn) => {
    btn.disabled = toolbarDisabled
  })

  refs.textarea.disabled = !state.docId || state.loading
  if (syncTextarea) {
    refs.textarea.value = state.markdown
  } else if (!preserveSelection && document.activeElement !== refs.textarea) {
    refs.textarea.value = state.markdown
  }

  if (!state.docId) {
    setHeaderActions([])
  } else {
    setHeaderActions([
      {
        id: 'export-pdf',
        label: '⤓',
        disabled: !state.previewHtml,
        variant: 'outline',
        onSelect: () => exportPdf(),
      },
    ])
  }

  renderPreviewStage()
}

function renderPreviewStage() {
  const stage = refs.previewStage
  const setStageMessage = (text: string, modifier: string) => {
    stage.className = `${STAGE_BASE_CLASS} ${STAGE_BASE_CLASS}--message ${STAGE_BASE_CLASS}--${modifier}`
    stage.textContent = text
  }

  if (state.loading) {
    setStageMessage('Loading…', 'loading')
    return
  }
  if (!state.docId) {
    setStageMessage('No document selected', 'empty')
    return
  }
  if (state.renderError) {
    setStageMessage(state.renderError, 'error')
    return
  }
  if (!state.previewHtml.trim()) {
    setStageMessage('Nothing to preview yet.', 'placeholder')
    return
  }

  const slideCount = state.slideCount
  if (!slideCount) {
    setStageMessage('Nothing to preview yet.', 'placeholder')
    return
  }
  const index = Math.min(Math.max(state.currentSlide, 0), slideCount - 1)
  stage.className = `${STAGE_BASE_CLASS} ${STAGE_BASE_CLASS}--preview`
  stage.innerHTML = `<style>${state.previewCss || ''}</style>` + state.previewHtml
  const wrapper = stage.querySelector('.marpit') as HTMLElement | null
  if (wrapper) wrapper.classList.add('refmd-marp-wrapper')

  const svgs = Array.from(stage.querySelectorAll('svg[data-marpit-svg]')) as HTMLElement[]
  if (!svgs.length) {
    setStageMessage('No slides found', 'placeholder')
    return
  }
  svgs.forEach((svg, idx) => {
    svg.classList.toggle('is-active', idx === index)
  })
}

function isStageFullscreen() {
  if (typeof document === 'undefined') return false
  const stageShell = refs?.stageShell
  if (!stageShell) return false
  const doc = stageShell.ownerDocument ?? document
  const fullscreenElement = (doc as any).fullscreenElement || (doc as any).webkitFullscreenElement || doc.fullscreenElement
  return fullscreenElement === stageShell
}

async function toggleFullscreen() {
  if (typeof document === 'undefined') return
  const stageShell = refs?.stageShell
  if (!stageShell || !stageShell.ownerDocument) return
  const doc = stageShell.ownerDocument as Document & { webkitExitFullscreen?: () => void }
  try {
    if (isStageFullscreen()) {
      if (typeof doc.exitFullscreen === 'function') {
        await doc.exitFullscreen()
      } else if (typeof doc.webkitExitFullscreen === 'function') {
        doc.webkitExitFullscreen()
      }
    } else {
      const req = (stageShell.requestFullscreen ?? (stageShell as any).webkitRequestFullscreen)?.bind(stageShell)
      if (typeof req === 'function') {
        const result = req()
        if (result instanceof Promise) {
          await result
        }
      }
    }
  } catch (error) {
    console.error('[marp] toggle fullscreen failed', error)
  } finally {
    updateFullscreenButton()
  }
}

function updateFullscreenButton() {
  const button = refs?.fullscreenButton
  if (!button) return
  const active = isStageFullscreen()
  button.textContent = active ? '⤺' : '⤢'
  const label = active ? 'Exit full screen' : 'Enter full screen'
  button.title = label
  button.setAttribute('aria-label', label)
  button.setAttribute('aria-pressed', active ? 'true' : 'false')
  if (refs.stageShell) {
    refs.stageShell.classList.toggle('fullscreen-active', active)
  }
}

function handleFullscreenChange() {
  updateFullscreenButton()
}

function changeSlide(delta: number) {
  if (state.loading || state.slideCount === 0) return
  const next = Math.min(Math.max(state.currentSlide + delta, 0), state.slideCount - 1)
  if (next === state.currentSlide) return
  state.currentSlide = next
  applyUiState({ syncTextarea: false })
  refs.previewStage.focus({ preventScroll: true })
}

export async function canOpen(docId: string, ctx: any = {}) {
  const docType = ctx?.document?.type || ctx?.docType
  if (docType && docType === 'marp-slide') return true
  try {
    const kv = await ctx?.host?.api?.getKv?.(PLUGIN_ID, docId, 'meta', ctx?.token)
    if (kv && typeof kv === 'object') {
      const meta = typeof kv.value === 'object' && kv.value !== null ? kv.value : kv
      return Boolean(meta?.isMarp)
    }
  } catch (err) {
    console.warn('[marp] canOpen meta lookup failed', err)
  }
  return false
}

export async function getRoute(docId: string, ctx: any = {}) {
  const token = ctx?.token ? `?token=${encodeURIComponent(ctx.token)}` : ''
  return `/marp/${docId}${token}`
}

export async function exec(action: string, { host, payload }: { host: any; payload?: any } = { host: null }) {
  const call = host && (host.exec || host.api?.exec)
  if (typeof call !== 'function') {
    return { ok: false, error: { code: 'EXEC_NOT_AVAILABLE' } }
  }
  try {
    return await call(action, payload || {})
  } catch (err: any) {
    return { ok: false, error: { code: 'EXEC_ERROR', message: String(err?.message || err) } }
  }
}

function countSlides(html: string): number {
  if (!html) return 0
  const template = document.createElement('template')
  template.innerHTML = html
  const svgCount = template.content.querySelectorAll('svg[data-marpit-svg]').length
  if (svgCount > 0) return svgCount
  const sectionCount = template.content.querySelectorAll('section').length
  if (sectionCount > 0) return sectionCount
  return html.trim() ? 1 : 0
}

function extractState(kv: any) {
  if (!kv || typeof kv !== 'object') return null
  if (kv.value && typeof kv.value === 'object') return kv.value
  return kv
}

function buildHtmlExport(state: UiState, options: { injectPrint?: boolean; forPdf?: boolean } = {}) {
  const css = state.previewCss || ''
  const body = state.previewHtml || '<section class="marp-slide"><h1>Empty slides</h1></section>'
  const printScript = options.injectPrint
    ? '<script>window.addEventListener("load",()=>{try{window.focus();window.print();}catch(e){}});</script>'
    : ''
  const baseStyles = ['body { margin: 0; }']
  if (options.forPdf) {
    baseStyles.push('@page { size: 1280px 720px; margin: 0; }')
  }
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Marp Slides</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
${css}
${baseStyles.join('\n')}
</style>
</head>
<body>
${body}
${printScript}
</body>
</html>`
}

function getStyles() {
  return `
.refmd-marp-root {
  height: 100%;
  width: 100%;
  box-sizing: border-box;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  color: var(--foreground, #0f172a);
  --refmd-surface-base: color-mix(in srgb, var(--background, #ffffff) 96%, transparent);
  --refmd-surface-blur: color-mix(in srgb, var(--background, #ffffff) 82%, transparent);
  --refmd-border-color: color-mix(in srgb, var(--border, rgba(18,20,28,0.08)) 45%, transparent);
  --refmd-muted-surface: color-mix(in srgb, var(--muted, rgba(226,232,240,0.6)) 75%, transparent);
  --refmd-muted-border: color-mix(in srgb, var(--border, rgba(148,163,184,0.35)) 85%, transparent);
  --refmd-error-surface: color-mix(in srgb, var(--destructive, #ef4444) 18%, transparent);
  --refmd-error-border: color-mix(in srgb, var(--destructive, #ef4444) 45%, transparent);
  --refmd-input-surface: color-mix(in srgb, var(--background, #ffffff) 98%, transparent);
  --refmd-input-border: color-mix(in srgb, var(--input, rgba(18,20,28,0.08)) 70%, transparent);
  --refmd-surface: var(--refmd-surface-base);
}
@supports (backdrop-filter: blur(0.5rem)) {
  .refmd-marp-root {
    --refmd-surface: var(--refmd-surface-blur);
  }
}
.dark .refmd-marp-root {
  --refmd-surface-base: color-mix(in srgb, var(--background, #1e1e1e) 94%, transparent);
  --refmd-surface-blur: color-mix(in srgb, var(--background, #1e1e1e) 82%, transparent);
  --refmd-border-color: color-mix(in srgb, var(--border, rgba(255,255,255,0.08)) 55%, transparent);
  --refmd-muted-surface: color-mix(in srgb, var(--muted, #2a2a2a) 80%, transparent);
  --refmd-muted-border: color-mix(in srgb, var(--border, rgba(255,255,255,0.06)) 80%, transparent);
  --refmd-error-surface: color-mix(in srgb, var(--destructive, #ff6b6b) 22%, transparent);
  --refmd-error-border: color-mix(in srgb, var(--destructive, #ff6b6b) 55%, transparent);
  --refmd-input-surface: color-mix(in srgb, var(--background, #1e1e1e) 92%, transparent);
  --refmd-input-border: color-mix(in srgb, var(--input, rgba(255,255,255,0.08)) 80%, transparent);
}
@media (max-width: 1024px) {
  .refmd-marp-root {
    padding: 1rem;
    gap: 1rem;
  }
}
.refmd-marp-card {
  background: var(--refmd-surface);
  border: 1px solid var(--refmd-border-color);
  border-radius: 1.5rem;
  padding: 1.5rem;
  box-shadow: 0 20px 50px rgba(15, 23, 42, 0.12);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}
@media (prefers-reduced-motion: no-preference) {
  .refmd-marp-card {
    transition: border-color .2s ease, box-shadow .2s ease, background-color .2s ease;
  }
  .refmd-marp-card:hover {
    border-color: color-mix(in srgb, var(--primary, #3b82f6) 30%, var(--refmd-border-color));
    box-shadow: 0 26px 70px rgba(15, 23, 42, 0.18);
  }
}
.refmd-marp-preview.refmd-marp-card {
  background: transparent;
  border: none;
  box-shadow: none;
  padding: 0;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}
.refmd-marp-shell {
  display: flex;
  flex: 1;
  flex-direction: row;
  align-items: stretch;
  gap: 1.5rem;
  min-height: 0;
}
@media (max-width: 1024px) {
  .refmd-marp-shell {
    flex-direction: column;
  }
}
.refmd-marp-pane {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  flex: 1 1 0%;
  min-width: 0;
  min-height: 0;
}
.refmd-marp-preview.refmd-marp-pane {
  gap: 0;
  justify-content: center;
}
.refmd-marp-subtext {
  font-size: 0.7rem;
  color: var(--muted-foreground, #64748b);
}
.refmd-marp-section-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.68rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--muted-foreground, #64748b);
}
.refmd-marp-textarea {
  flex: 1 1 auto;
  min-height: 14rem;
  width: 100%;
  padding: 1rem;
  border-radius: 0.75rem;
  border: 1px solid var(--refmd-input-border);
  background: var(--refmd-input-surface);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  line-height: 1.55;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  color: var(--foreground, #0f172a);
  transition: border-color .2s ease, box-shadow .2s ease, background-color .2s ease;
}
.refmd-marp-textarea:focus {
  outline: none;
  border-color: var(--refmd-input-border);
  box-shadow: none;
}
.refmd-marp-textarea[disabled] {
  opacity: 0.6;
  cursor: not-allowed;
}
.dark .refmd-marp-textarea {
  background: var(--refmd-input-surface);
  border-color: var(--refmd-input-border);
  box-shadow: none;
}
.dark .refmd-marp-textarea:focus {
  border-color: var(--refmd-input-border);
  box-shadow: none;
}
.refmd-marp-editor-toolbar-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid color-mix(in srgb, var(--border, rgba(148,163,184,0.25)) 100%, transparent);
}
.refmd-marp-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.7rem;
  color: var(--muted-foreground, #64748b);
}
.refmd-marp-toolbar__btn {
  height: 1.75rem;
  min-width: 1.75rem;
  padding: 0 0.55rem;
  border-radius: 0.45rem;
  border: 1px solid transparent;
  background: transparent;
  color: currentColor;
  font-weight: 600;
  letter-spacing: 0.02em;
}
.refmd-marp-toolbar__btn:hover:not([disabled]) {
  background: color-mix(in srgb, var(--primary, #3b82f6) 12%, transparent);
  border-color: color-mix(in srgb, var(--primary, #3b82f6) 35%, transparent);
  color: var(--primary, #3b82f6);
}
.refmd-marp-toolbar__btn:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--primary, #3b82f6) 35%, transparent);
  outline-offset: 2px;
}
.refmd-marp-toolbar__btn[disabled] {
  opacity: 0.45;
  cursor: not-allowed;
}
.refmd-marp-toolbar__divider {
  width: 1px;
  height: 1.25rem;
  background: color-mix(in srgb, var(--border, rgba(148,163,184,0.35)) 100%, transparent);
  margin: 0 0.35rem;
}
.refmd-marp-status-inline {
  margin-left: auto;
  font-size: 0.7rem;
  color: var(--muted-foreground, #64748b);
  text-align: right;
  white-space: nowrap;
}
.refmd-marp-status-inline.is-error {
  color: color-mix(in srgb, var(--destructive, #ef4444) 70%, black 30%);
}
.refmd-marp-pagination-footer {
  display: flex;
  justify-content: center;
  padding-top: 0;
}
.refmd-marp-pagination-container {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  padding: 0 0.75rem;
  min-height: 2.5rem;
}
.refmd-marp-pagination-container .refmd-marp-pagination {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  margin: 0;
  pointer-events: auto;
}
.refmd-marp-action {
  border-radius: 0.65rem !important;
  border-width: 1px !important;
  padding: 0.4rem 1.1rem !important;
  font-weight: 600 !important;
  letter-spacing: 0.04em;
}
.refmd-marp-action--ghost {
  background: transparent !important;
  border-color: color-mix(in srgb, var(--border, rgba(148,163,184,0.35)) 100%, transparent) !important;
  color: var(--muted-foreground, #64748b) !important;
}
.refmd-marp-action--ghost:hover:not([disabled]) {
  background: color-mix(in srgb, var(--primary, #3b82f6) 12%, transparent) !important;
  border-color: color-mix(in srgb, var(--primary, #3b82f6) 35%, transparent) !important;
  color: var(--primary, #3b82f6) !important;
}
.refmd-marp-pagination {
  gap: 0.5rem !important;
  font-size: 0.7rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--muted-foreground, #64748b);
}
.refmd-marp-pagination-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  border-radius: 9999px !important;
  padding: 0.35rem 0.85rem !important;
  min-width: 2.4rem;
  font-size: 0.7rem !important;
  letter-spacing: 0.18em !important;
  font-weight: 600;
  border: 1px solid color-mix(in srgb, var(--border, rgba(148,163,184,0.35)) 85%, transparent) !important;
  background: color-mix(in srgb, var(--muted, rgba(226,232,240,0.6)) 55%, transparent) !important;
  color: var(--muted-foreground, #64748b) !important;
  transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08);
}
.refmd-marp-pagination-btn:hover:not([disabled]) {
  background: color-mix(in srgb, var(--primary, #3b82f6) 14%, transparent) !important;
  border-color: color-mix(in srgb, var(--primary, #3b82f6) 35%, transparent) !important;
  color: var(--primary, #3b82f6) !important;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.12);
}
.refmd-marp-pagination-btn--icon {
  margin-left: auto;
  min-width: 2.4rem;
  font-size: 0.75rem !important;
  letter-spacing: 0 !important;
  color: var(--muted-foreground, #64748b) !important;
}
.refmd-marp-pagination-btn[disabled] {
  opacity: 0.5;
  cursor: not-allowed;
  box-shadow: none;
}
.refmd-marp-pagination-label {
  color: var(--muted-foreground, #64748b);
  font-size: 0.7rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}
.${STAGE_BASE_CLASS} {
  position: relative;
  flex: 1 1 auto;
  min-height: clamp(16rem, 45vh, 32rem);
  border-radius: 0.85rem;
  border: 1px solid var(--refmd-border-color);
  background: var(--refmd-surface);
  color: var(--muted-foreground, #64748b);
  padding: clamp(0.35rem, 1vw, 1.25rem);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  transition: color .2s ease, border-color .2s ease, background-color .2s ease;
}
.${STAGE_BASE_CLASS}:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--primary, #3b82f6) 35%, transparent);
  outline-offset: 2px;
}
.${STAGE_BASE_CLASS}--message {
  background: var(--refmd-muted-surface);
  border-color: var(--refmd-muted-border);
  color: var(--muted-foreground, #64748b);
  text-align: center;
}
.${STAGE_BASE_CLASS}--loading::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent 0, rgba(59,130,246,0.12) 50%, transparent 100%);
  animation: refmd-marp-shimmer 1.8s ease-in-out infinite;
  pointer-events: none;
}
.${STAGE_BASE_CLASS}--error {
  background: var(--refmd-error-surface);
  border-color: var(--refmd-error-border);
  color: color-mix(in srgb, var(--destructive, #ef4444) 80%, black 20%);
  font-weight: 600;
}
.${STAGE_BASE_CLASS}--placeholder,
.${STAGE_BASE_CLASS}--empty {
  font-size: 0.85rem;
  font-weight: 500;
  text-align: center;
}
.${STAGE_BASE_CLASS}--preview {
  padding: 0;
  background: transparent;
  border: none;
  color: var(--foreground, #0f172a);
  flex: 1 1 auto;
  width: 100%;
  min-height: 0;
  display: block;
  align-self: stretch;
  box-shadow: none;
  overflow: auto;
}
.${STAGE_BASE_CLASS}--preview .refmd-marp-wrapper {
  width: 100%;
  height: auto;
  margin: 0;
}
.${STAGE_BASE_CLASS}--preview svg[data-marpit-svg] {
  display: block;
  width: auto;
  height: auto;
  max-width: none;
  max-height: none;
  box-shadow: none;
  border-radius: 0;
  background: transparent;
  margin: 0;
}
.refmd-marp-stage-shell {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: center;
  gap: 1rem;
  width: 100%;
  min-height: 0;
}
.${STAGE_BASE_CLASS} .refmd-marp-wrapper svg[data-marpit-svg] {
  display: none;
}
.${STAGE_BASE_CLASS} .refmd-marp-wrapper svg[data-marpit-svg].is-active {
  display: block;
}
.refmd-marp-stage-shell.fullscreen-active .refmd-marp-pagination-footer {
  position: fixed;
  left: 50%;
  bottom: clamp(1rem, 3vh, 2rem);
  transform: translateX(-50%);
  z-index: 60;
  pointer-events: none;
  width: 100%;
  max-width: 100vw;
  display: flex;
  justify-content: center;
}
.refmd-marp-stage-shell.fullscreen-active .refmd-marp-pagination-container {
  position: relative;
  pointer-events: none;
  display: flex;
  align-items: center;
  width: 100%;
  max-width: min(88vw, 960px);
  padding: 0 2.5rem;
}
.refmd-marp-stage-shell.fullscreen-active .refmd-marp-pagination {
  pointer-events: auto;
}
.refmd-marp-stage-shell.fullscreen-active .refmd-marp-pagination-container .refmd-marp-pagination-btn--icon {
  pointer-events: auto;
  margin-left: auto;
  background: rgba(15, 23, 42, 0.7) !important;
  border: 1px solid rgba(148, 163, 184, 0.2) !important;
  padding: 0.35rem 0.65rem !important;
  box-shadow: 0 10px 20px rgba(15, 23, 42, 0.25) !important;
}
.refmd-marp-stage-shell.fullscreen-active .refmd-marp-pagination {
  pointer-events: auto;
  margin: 0;
  background: transparent;
  box-shadow: none;
  padding: 0;
  display: inline-flex;
  align-items: center;
}
.refmd-marp-stage-shell.fullscreen-active .refmd-marp-pagination-label {
  display: none;
}
.refmd-marp-stage-shell.fullscreen-active .refmd-marp-pagination-btn {
  pointer-events: auto;
  background: rgba(15, 23, 42, 0.7) !important;
  color: #e2e8f0 !important;
  border: 1px solid rgba(148, 163, 184, 0.2) !important;
  box-shadow: 0 10px 20px rgba(15, 23, 42, 0.25) !important;
  border-radius: 9999px !important;
}
.refmd-marp-stage-shell.fullscreen-active .refmd-marp-pagination-btn:hover:not([disabled]) {
  background: rgba(59, 130, 246, 0.8) !important;
  border-color: rgba(148, 163, 184, 0.35) !important;
}
@keyframes refmd-marp-shimmer {
  0% { transform: translateX(-100%); opacity: 0.2; }
  50% { transform: translateX(0%); opacity: 0.6; }
  100% { transform: translateX(100%); opacity: 0.2; }
}
`
}
