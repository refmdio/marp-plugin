import { createKit, resolveDocId, type SplitEditorDocumentApi, type SplitEditorPreviewDelegate } from '@refmdio/plugin-sdk'

import { DEFAULT_MARKDOWN, STAGE_BASE_CLASS, STATE_KEY } from './constants'
import { exportPdf as performPdfExport } from './exporter'
import { HeaderBridge } from './header'
import { loadMarpRenderer } from './renderer'
import { countSlides } from './slides'
import { createInitialState } from './state'
import { getStyles } from './styles'
import type { Kit, UiRefs, UiState } from './types'
import { buildPreviewStage } from './ui'

export class MarpApp {
  private readonly kit: Kit
  private readonly header: HeaderBridge
  private readonly state: UiState
  private readonly host: any
  private readonly container: HTMLElement
  private readonly tokenFromHost: string | undefined

  private refs: UiRefs | null = null
  private renderer: any = null
  private previewFrame: number | null = null
  private pendingPreview = false
  private splitDispose: (() => void) | null = null
  private styleNode: HTMLStyleElement | null = null
  private disposed = false
  private documentBridge: SplitEditorDocumentApi | null = null
  private migrationAttemptedDocId: string | null = null

  constructor(container: Element, host: any) {
    this.container = container as HTMLElement
    this.host = host
    this.kit = createKit(host)
    this.header = new HeaderBridge(host)
    const docId = host?.context?.docId || resolveDocId() || null
    this.state = createInitialState(docId)
    this.tokenFromHost = host?.context?.token ?? undefined
  }

  async mount() {
    this.header.setTitle('Marp Slides')
    this.header.setStatus('Preparing Marp preview…')
    this.header.setBadge(undefined)
    this.header.setActions([])

    this.attachStyles()
    this.container.addEventListener('keydown', this.onKeydown, true)
    if (typeof document !== 'undefined') {
      document.addEventListener('fullscreenchange', this.handleFullscreenChange)
      const docAny = document as any
      if (typeof docAny?.addEventListener === 'function') {
        docAny.addEventListener('webkitfullscreenchange', this.handleFullscreenChange)
      }
    }

    void this.loadRenderer()

    const mountSplit = this.host?.ui?.mountSplitEditor
    if (typeof mountSplit !== 'function') {
      throw new Error('Host does not support split editor reuse yet')
    }

    this.splitDispose = mountSplit(this.container, {
      docId: this.state.docId,
      token: this.tokenFromHost ?? null,
      preview: { delegate: this.createPreviewDelegate() },
      document: { onReady: this.handleDocumentReady },
    }) || null
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    try { this.container.removeEventListener('keydown', this.onKeydown, true) } catch {}
    if (typeof document !== 'undefined') {
      document.removeEventListener('fullscreenchange', this.handleFullscreenChange)
      const docAny = document as any
      if (typeof docAny?.removeEventListener === 'function') {
        docAny.removeEventListener('webkitfullscreenchange', this.handleFullscreenChange)
      }
    }
    if (this.splitDispose) {
      try { this.splitDispose() } catch {}
      this.splitDispose = null
    }
    if (this.previewFrame) {
      cancelAnimationFrame(this.previewFrame)
      this.previewFrame = null
    }
    if (this.styleNode) {
      try { this.styleNode.remove() } catch {}
      this.styleNode = null
    }
    this.refs = null
  }

  private attachStyles() {
    if (this.styleNode || typeof document === 'undefined') return
    const style = document.createElement('style')
    style.textContent = getStyles()
    document.head.appendChild(style)
    this.styleNode = style
  }

  private createPreviewDelegate(): SplitEditorPreviewDelegate {
    return ({ container, docId }) => {
      if (this.state.docId !== docId) {
        this.migrationAttemptedDocId = null
      }
      this.state.docId = docId
      const { refs } = buildPreviewStage(this.kit, {
        onPrev: () => this.changeSlide(-1),
        onNext: () => this.changeSlide(1),
        onToggleFullscreen: () => { void this.toggleFullscreen() },
      })
      this.refs = refs
      container.classList.add('refmd-marp-preview-host')
      container.appendChild(refs.root)
      this.applyUiState()
      return {
        update: ({ content }) => {
          this.handleContentUpdate(typeof content === 'string' ? content : DEFAULT_MARKDOWN)
        },
        dispose: () => {
          if (container.contains(refs.root)) {
            container.removeChild(refs.root)
          }
          if (this.refs === refs) {
            this.refs = null
          }
        },
      }
    }
  }

  private handleDocumentReady = (api: SplitEditorDocumentApi) => {
    this.documentBridge = api
    if (this.migrationAttemptedDocId !== api.docId) {
      this.migrationAttemptedDocId = api.docId
      void this.tryRestoreFromLegacyState(api)
    }
    return () => {
      if (this.documentBridge === api) {
        this.documentBridge = null
      }
    }
  }

  private async tryRestoreFromLegacyState(api: SplitEditorDocumentApi) {
    try {
      const current = api.getContent()
      if (current && current.trim().length > 0) return
      if (typeof this.host?.exec !== 'function') return
      const kvResult = await this.host.exec('host.kv.get', {
        docId: api.docId,
        key: STATE_KEY,
        token: this.tokenFromHost,
      })
      if (kvResult?.ok === false) return
      const legacy = this.extractLegacyState(kvResult?.data)
      const markdown = legacy?.markdown
      if (typeof markdown === 'string' && markdown.trim().length > 0) {
        api.setContent(markdown)
      }
    } catch (error) {
      console.warn('[marp] failed to restore legacy content', error)
    }
  }

  private extractLegacyState(payload: any): { markdown?: string } | null {
    if (!payload || typeof payload !== 'object') return null
    if (payload.value && typeof payload.value === 'object') return payload.value as { markdown?: string }
    return payload as { markdown?: string }
  }

  private async loadRenderer() {
    try {
      const renderer = await loadMarpRenderer()
      this.renderer = renderer
      if (this.pendingPreview) {
        this.schedulePreview()
      }
    } catch (err) {
      console.error('[marp] renderer load failed', err)
      this.state.renderError = 'Failed to load Marp renderer'
      this.applyUiState()
    }
  }

  private handleContentUpdate(markdown: string) {
    this.state.markdown = (markdown && markdown.length > 0) ? markdown : DEFAULT_MARKDOWN
    this.state.loading = false
    this.state.statusMessage = ''
    this.schedulePreview()
  }

  private schedulePreview() {
    this.pendingPreview = true
    if (!this.renderer) return
    if (this.previewFrame) cancelAnimationFrame(this.previewFrame)
    this.previewFrame = requestAnimationFrame(() => {
      this.previewFrame = null
      this.pendingPreview = false
      try {
        const rendered = this.renderer?.render(this.state.markdown || DEFAULT_MARKDOWN)
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
      this.applyUiState()
    })
  }

  private applyUiState() {
    if (!this.refs) return

    const inlineStatus = this.state.statusMessage
      || (this.state.loading ? 'Rendering…' : '')
      || this.state.renderError

    this.header.setBadge(undefined)
    this.header.setStatus(inlineStatus || undefined)
    this.header.setActions([
      {
        id: 'export-pdf',
        label: '⤓',
        disabled: !this.state.previewHtml,
        variant: 'outline',
        onSelect: () => this.exportPdf(),
      },
    ])

    const slideCount = this.state.slideCount
    this.refs.paginationLabel.textContent = slideCount ? `${this.state.currentSlide + 1} / ${slideCount}` : '0 / 0'
    const navDisabled = this.state.loading || slideCount === 0
    this.refs.prevButton.disabled = navDisabled || this.state.currentSlide <= 0
    this.refs.nextButton.disabled = navDisabled || this.state.currentSlide >= Math.max(slideCount - 1, 0)

    const canFullscreen = !this.state.loading && !!this.state.previewHtml && !!this.refs.stageShell
    this.refs.fullscreenButton.disabled = !canFullscreen
    this.updateFullscreenButton()

    this.renderPreviewStage()
  }

  private renderPreviewStage() {
    if (!this.refs) return
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

  private readonly onKeydown = (event: KeyboardEvent) => {
    if (event.defaultPrevented) return
    if (!this.refs) return
    const target = event.target as HTMLElement | null
    if (target) {
      const tag = target.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea') return
      if (target.isContentEditable) return
      if (target.closest('.monaco-editor')) return
    }
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
    if (this.refs?.stageShell) {
      this.refs.stageShell.classList.toggle('fullscreen-active', active)
    }
  }

  private changeSlide(delta: number) {
    if (this.state.loading || this.state.slideCount === 0) return
    const next = Math.min(Math.max(this.state.currentSlide + delta, 0), this.state.slideCount - 1)
    if (next === this.state.currentSlide) return
    this.state.currentSlide = next
    this.applyUiState()
    this.refs?.previewStage?.focus({ preventScroll: true })
  }
}
