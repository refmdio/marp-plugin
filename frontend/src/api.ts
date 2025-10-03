import { PLUGIN_ID } from './constants'

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
