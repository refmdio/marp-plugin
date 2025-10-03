import type { ToolbarAction } from './types'

export const PLUGIN_ID = 'marp'
export const STATE_KEY = 'marpState'

export const DEFAULT_MARKDOWN = `---
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

export const STAGE_BASE_CLASS = 'refmd-marp-stage'

export const TOOLBAR_ACTIONS: Array<ToolbarAction | 'divider'> = [
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

export const TOOLBAR_LABELS: Record<ToolbarAction, string> = {
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

export const TOOLBAR_TITLES: Record<ToolbarAction, string> = {
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
