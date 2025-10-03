export function countSlides(html: string): number {
  if (!html) return 0
  const template = document.createElement('template')
  template.innerHTML = html
  const svgCount = template.content.querySelectorAll('svg[data-marpit-svg]').length
  if (svgCount > 0) return svgCount
  const sectionCount = template.content.querySelectorAll('section').length
  if (sectionCount > 0) return sectionCount
  return html.trim() ? 1 : 0
}
