const globalScope = globalThis as any
if (!globalScope.process) {
  globalScope.process = { env: { NODE_ENV: 'production' } }
} else {
  if (!globalScope.process.env) {
    globalScope.process.env = { NODE_ENV: 'production' }
  } else if (typeof globalScope.process.env.NODE_ENV === 'undefined') {
    globalScope.process.env.NODE_ENV = 'production'
  }
}
export {}
