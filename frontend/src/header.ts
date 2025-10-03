import type { HeaderAction } from './types'

export class HeaderBridge {
  constructor(private readonly host: any) {}

  setTitle(title?: string | null) {
    try {
      this.host?.ui?.setDocumentTitle?.(title ?? undefined)
    } catch {}
  }

  setStatus(status?: string | null) {
    try {
      this.host?.ui?.setDocumentStatus?.(status ?? undefined)
    } catch {}
  }

  setBadge(badge?: string | null) {
    try {
      this.host?.ui?.setDocumentBadge?.(badge ?? undefined)
    } catch {}
  }

  setActions(actions: HeaderAction[]) {
    try {
      this.host?.ui?.setDocumentActions?.(actions)
    } catch {}
  }
}
