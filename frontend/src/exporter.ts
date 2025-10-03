import type { Kit, UiState } from './types'

export function buildHtmlExport(
  state: UiState,
  options: { injectPrint?: boolean; forPdf?: boolean } = {},
): string {
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

export function exportPdf(state: UiState, kit?: Kit | null) {
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
      try {
        document.body.removeChild(iframe)
      } catch {}
    }, 250)
  }

  const targetWindow = iframe.contentWindow
  const targetDoc = targetWindow?.document
  if (!targetWindow || !targetDoc) {
    kit?.toast?.('error', 'Unable to prepare PDF export frame')
    cleanup()
    return
  }

  try {
    targetDoc.open()
    targetDoc.write(html)
    targetDoc.close()
  } catch (err) {
    console.error('[marp] pdf export failed', err)
    kit?.toast?.('error', 'Failed to prepare PDF export')
    cleanup()
    return
  }

  const triggerPrint = () => {
    try {
      targetWindow.focus()
      targetWindow.print()
    } catch (error) {
      console.error('[marp] pdf print failed', error)
      kit?.toast?.('error', 'Print dialog could not be opened')
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
