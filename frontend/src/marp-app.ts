import { createKit, resolveDocId } from '@refmdio/plugin-sdk'

import { DEFAULT_MARKDOWN, PLUGIN_ID, STATE_KEY, STAGE_BASE_CLASS } from './constants'
import { exportPdf as performPdfExport } from './exporter'
import { HeaderBridge } from './header'
import { loadMarpRenderer } from './renderer'
import { countSlides } from './slides'
import { createInitialState, extractState } from './state'
import { getStyles } from './styles'
import type { ApplyOptions, Kit, ToolbarAction, UiRefs, UiState } from './types'
import { buildUi } from './ui'

let fullscreenListenerAttached = false

export class MarpApp {
  private readonly kit: Kit
  private readonly header: HeaderBridge
  private readonly state: UiState
  private readonly host: any
  private readonly container: Element
  private readonly tokenFromHost: string | undefined

  private refs!: UiRefs
  private toolbarButtons: HTMLButtonElement[] = []
  private renderer: any = null
  private previewFrame: number | null = null
  private saveTimer: number | null = null

  constructor(container: Element, host: any) {
    this.container = container
    this.host = host
    this.kit = createKit(host)
    this.header = new HeaderBridge(host)
    const docId = host?.context?.docId || resolveDocId() || null
    this.state = createInitialState(docId)
    this.tokenFromHost = host?.context?.token ?? undefined
  }

  async mount() {
    this.header.setTitle('Marp Slides')
    this.header.setStatus(undefined)
    this.header.setBadge(undefined)
    this.header.setActions([])

    const { refs, toolbarButtons } = buildUi(this.kit, this.state.markdown, {
      onTextareaInput: this.handleTextareaInput,
      onPrev: () => this.changeSlide(-1),
      onNext: () => this.changeSlide(1),
      onToggleFullscreen: () => {
        void this.toggleFullscreen()
      },
      onToolbarAction: this.handleToolbarAction,
    })

    this.refs = refs
    this.toolbarButtons = toolbarButtons

    if (typeof document !== 'undefined' && !fullscreenListenerAttached) {
      document.addEventListener('fullscreenchange', this.handleFullscreenChange)
      const docAny = document as any
      if (typeof docAny?.addEventListener === 'function') {
        docAny.addEventListener('webkitfullscreenchange', this.handleFullscreenChange)
      }
      fullscreenListenerAttached = true
    }

    const baseStyles = this.kit.h('style', null, getStyles())
    this.container.append(baseStyles, refs.root)
    this.container.addEventListener('keydown', this.onKeydown)

    this.applyUiState({ syncTextarea: true })

    this.renderer = await loadMarpRenderer()

    if (this.state.docId) {
      await this.initializeDeck(this.state.docId)
    } else {
      this.state.loading = false
      this.state.statusMessage = ''
      this.applyUiState({ syncTextarea: true })
    }
  }

  private readonly handleTextareaInput = () => {
    this.state.markdown = this.refs.textarea.value
    this.state.dirty = true
    this.state.statusMessage = 'Unsaved changes'
    this.applyUiState({ syncTextarea: false, preserveSelection: true })
    this.schedulePreview()
    this.scheduleSave()
  }

  private readonly handleToolbarAction = (action: ToolbarAction) => {
    const textarea = this.refs?.textarea
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

    this.handleTextareaInput()
  }

  private readonly onKeydown = (event: KeyboardEvent) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
      event.preventDefault()
      void this.performSave()
      return
    }
    if (event.target === this.refs.textarea) return
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault()
      this.changeSlide(-1)
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault()
      this.changeSlide(1)
    }
  }

  private readonly handleFullscreenChange = () => {
    this.updateFullscreenButton()
  }

  private schedulePreview() {
    if (!this.renderer) return
    if (this.previewFrame) cancelAnimationFrame(this.previewFrame)
    this.previewFrame = requestAnimationFrame(() => {
      try {
        const rendered = this.renderer?.render(this.state.markdown)
        if (rendered) {
          this.state.previewHtml = rendered.html
          this.state.previewCss = rendered.css
          this.state.renderError = null
          const count = countSlides(rendered.html)
          this.state.slideCount = count
          if (count === 0) {
            this.state.currentSlide = 0
          } else if (this.state.currentSlide >= count) {
            this.state.currentSlide = count - 1
          } else if (this.state.currentSlide < 0) {
            this.state.currentSlide = 0
          }
        }
      } catch (err: any) {
        console.error('[marp] render failed', err)
        this.state.previewHtml = ''
        this.state.previewCss = ''
        this.state.renderError = err?.message ? String(err.message) : 'Render error'
        this.state.slideCount = 0
        this.state.currentSlide = 0
      }
      this.applyUiState({ syncTextarea: false })
    })
  }

  private scheduleSave() {
    if (this.saveTimer) window.clearTimeout(this.saveTimer)
    this.saveTimer = window.setTimeout(() => {
      void this.performSave()
    }, 900)
  }

  private async initializeDeck(docId: string) {
    this.state.loading = true
    this.state.statusMessage = 'Loading Marp deck…'
    this.applyUiState({ syncTextarea: false })
    try {
      const kv = await this.host?.api?.getKv?.(PLUGIN_ID, docId, STATE_KEY, this.tokenFromHost)
      const payload = extractState(kv)
      const markdown = payload?.markdown && typeof payload.markdown === 'string' ? payload.markdown : DEFAULT_MARKDOWN
      this.state.markdown = markdown
      this.state.loading = false
      this.state.dirty = false
      this.state.lastSavedAt = typeof payload?.updatedAt === 'string' ? payload.updatedAt : null
      this.state.statusMessage = ''
      this.state.currentSlide = 0
      this.state.slideCount = 0
      this.refs.textarea.value = markdown
      this.applyUiState({ syncTextarea: false })
      this.schedulePreview()
    } catch (err) {
      console.error('[marp] load failed', err)
      this.state.loading = false
      this.state.statusMessage = 'Failed to load Marp deck'
      this.state.renderError = 'Failed to load data. Try reloading.'
      this.state.slideCount = 0
      this.state.currentSlide = 0
      this.applyUiState({ syncTextarea: false })
    }
  }

  private async performSave() {
    if (!this.state.docId || (!this.state.dirty && !this.state.saving)) return
    this.state.saving = true
    this.state.statusMessage = 'Saving…'
    this.applyUiState({ syncTextarea: false })
    try {
      await this.host?.api?.putKv?.(
        PLUGIN_ID,
        this.state.docId,
        STATE_KEY,
        {
          markdown: this.state.markdown,
          updatedAt: new Date().toISOString(),
        },
        this.tokenFromHost,
      )
      this.state.saving = false
      this.state.dirty = false
      this.state.lastSavedAt = new Date().toISOString()
      this.state.statusMessage = ''
      this.applyUiState({ syncTextarea: false })
    } catch (err) {
      console.error('[marp] save failed', err)
      this.state.saving = false
      this.state.statusMessage = 'Failed to save'
      this.applyUiState({ syncTextarea: false })
      this.kit.toast?.('error', 'Failed to save Marp deck')
    }
  }

  private applyUiState(options: ApplyOptions = {}) {
    const { syncTextarea = false, preserveSelection = false } = options

    if (!this.state.slideCount) {
      this.state.currentSlide = 0
    } else if (this.state.currentSlide >= this.state.slideCount) {
      this.state.currentSlide = this.state.slideCount - 1
    } else if (this.state.currentSlide < 0) {
      this.state.currentSlide = 0
    }

    this.header.setBadge(undefined)
    this.header.setStatus(undefined)

    let inlineStatus = this.state.statusMessage
    if (!inlineStatus) {
      if (this.state.loading) inlineStatus = 'Loading…'
      else if (!this.state.docId) inlineStatus = ''
      else if (this.state.dirty) inlineStatus = 'Unsaved changes'
      else inlineStatus = ''
    }
    this.header.setStatus(inlineStatus || undefined)

    const slideCount = this.state.slideCount
    this.refs.paginationLabel.textContent = slideCount ? `${this.state.currentSlide + 1} / ${slideCount}` : '0 / 0'
    const navDisabled = this.state.loading || slideCount === 0
    this.refs.prevButton.disabled = navDisabled || this.state.currentSlide <= 0
    this.refs.nextButton.disabled = navDisabled || this.state.currentSlide >= Math.max(slideCount - 1, 0)

    const canFullscreen = !this.state.loading && !!this.state.previewHtml && !!this.refs.stageShell
    this.refs.fullscreenButton.disabled = !canFullscreen
    this.updateFullscreenButton()

    const toolbarDisabled = !this.state.docId || this.state.loading
    this.toolbarButtons.forEach((btn) => {
      btn.disabled = toolbarDisabled
    })

    this.refs.textarea.disabled = !this.state.docId || this.state.loading
    if (syncTextarea) {
      this.refs.textarea.value = this.state.markdown
    } else if (!preserveSelection && document.activeElement !== this.refs.textarea) {
      this.refs.textarea.value = this.state.markdown
    }

    if (!this.state.docId) {
      this.header.setActions([])
    } else {
      this.header.setActions([
        {
          id: 'export-pdf',
          label: '⤓',
          disabled: !this.state.previewHtml,
          variant: 'outline',
          onSelect: () => this.exportPdf(),
        },
      ])
    }

    this.renderPreviewStage()
  }

  private renderPreviewStage() {
    const stage = this.refs.previewStage
    const setStageMessage = (text: string, modifier: string) => {
      stage.className = `${STAGE_BASE_CLASS} ${STAGE_BASE_CLASS}--message ${STAGE_BASE_CLASS}--${modifier}`
      stage.textContent = text
    }

    if (this.state.loading) {
      setStageMessage('Loading…', 'loading')
      return
    }
    if (!this.state.docId) {
      setStageMessage('No document selected', 'empty')
      return
    }
    if (this.state.renderError) {
      setStageMessage(this.state.renderError, 'error')
      return
    }
    if (!this.state.previewHtml.trim()) {
      setStageMessage('Nothing to preview yet.', 'placeholder')
      return
    }

    const slideCount = this.state.slideCount
    if (!slideCount) {
      setStageMessage('Nothing to preview yet.', 'placeholder')
      return
    }

    const index = Math.min(Math.max(this.state.currentSlide, 0), slideCount - 1)
    stage.className = `${STAGE_BASE_CLASS} ${STAGE_BASE_CLASS}--preview`
    stage.innerHTML = `<style>${this.state.previewCss || ''}</style>` + this.state.previewHtml
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

  private exportPdf() {
    performPdfExport(this.state, this.kit)
  }

  private isStageFullscreen() {
    if (typeof document === 'undefined') return false
    const stageShell = this.refs?.stageShell
    if (!stageShell) return false
    const doc = stageShell.ownerDocument ?? document
    const fullscreenElement = (doc as any).fullscreenElement || (doc as any).webkitFullscreenElement || doc.fullscreenElement
    return fullscreenElement === stageShell
  }

  private async toggleFullscreen() {
    if (typeof document === 'undefined') return
    const stageShell = this.refs?.stageShell
    if (!stageShell || !stageShell.ownerDocument) return
    const doc = stageShell.ownerDocument as Document & { webkitExitFullscreen?: () => void }
    try {
      if (this.isStageFullscreen()) {
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
      this.updateFullscreenButton()
    }
  }

  private updateFullscreenButton() {
    const button = this.refs?.fullscreenButton
    if (!button) return
    const active = this.isStageFullscreen()
    button.textContent = active ? '⤺' : '⤢'
    const label = active ? 'Exit full screen' : 'Enter full screen'
    button.title = label
    button.setAttribute('aria-label', label)
    button.setAttribute('aria-pressed', active ? 'true' : 'false')
    if (this.refs.stageShell) {
      this.refs.stageShell.classList.toggle('fullscreen-active', active)
    }
  }

  private changeSlide(delta: number) {
    if (this.state.loading || this.state.slideCount === 0) return
    const next = Math.min(Math.max(this.state.currentSlide + delta, 0), this.state.slideCount - 1)
    if (next === this.state.currentSlide) return
    this.state.currentSlide = next
    this.applyUiState({ syncTextarea: false })
    this.refs.previewStage.focus({ preventScroll: true })
  }
}
