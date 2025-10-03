let marpRendererSingleton: any | null = null

export async function loadMarpRenderer() {
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
