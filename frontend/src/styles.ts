import { STAGE_BASE_CLASS } from './constants'

export function getStyles(): string {
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
.refmd-marp-section-label strong {
  letter-spacing: normal;
  font-size: 0.75rem;
  color: var(--foreground, #0f172a);
}
.refmd-marp-editor-toolbar-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--refmd-border-color);
}
.refmd-marp-toolbar {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  background: var(--refmd-muted-surface);
  border: 1px solid var(--refmd-muted-border);
  border-radius: 9999px;
  padding: 0.4rem 0.65rem;
}
.refmd-marp-toolbar__btn {
  border: none;
  background: transparent;
  cursor: pointer;
  padding: 0.25rem 0.45rem;
  border-radius: 9999px;
  color: var(--muted-foreground, #64748b);
  font-weight: 600;
  font-size: 0.75rem;
  letter-spacing: 0.05em;
  min-width: 2rem;
  transition: background-color 0.2s ease, color 0.2s ease;
}
.refmd-marp-toolbar__btn:hover:not([disabled]) {
  background: color-mix(in srgb, var(--primary, #3b82f6) 16%, transparent);
  color: var(--primary, #3b82f6);
}
.refmd-marp-toolbar__btn[disabled] {
  opacity: 0.5;
  cursor: not-allowed;
}
.refmd-marp-toolbar__divider {
  width: 1px;
  height: 1.4rem;
  background: var(--refmd-muted-border);
}
.refmd-marp-editor {
  min-height: 0;
}
.refmd-marp-textarea {
  width: 100%;
  height: 100%;
  border: 1px solid var(--refmd-input-border);
  border-radius: 1rem;
  background: var(--refmd-input-surface);
  padding: 1rem 1.1rem;
  color: var(--foreground, #0f172a);
  box-shadow: inset 0 2px 4px rgba(15, 23, 42, 0.06);
}
.refmd-marp-textarea:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--primary, #3b82f6) 30%, transparent);
  outline-offset: 3px;
}
.refmd-marp-textarea[disabled] {
  opacity: 0.6;
  cursor: not-allowed;
}
.refmd-marp-pagination-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 0;
}
.refmd-marp-pagination-container {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  background: color-mix(in srgb, var(--muted, rgba(241,245,249,0.75)) 55%, transparent);
  border: 1px solid color-mix(in srgb, var(--muted, rgba(226,232,240,0.6)) 50%, transparent);
  border-radius: 9999px;
  padding: 0.35rem 0.75rem;
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.16);
}
.refmd-marp-pagination {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  margin-right: 0.5rem;
  background: rgba(255,255,255,0.6);
  border-radius: 9999px;
  padding: 0.2rem 0.5rem;
  box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.12);
}
.dark .refmd-marp-pagination {
  background: rgba(15,23,42,0.55);
}
.refmd-marp-pagination-btn {
  border: none;
  border-radius: 0.75rem;
  padding: 0.35rem 0.65rem;
  background: rgba(255,255,255,0.85);
  color: var(--muted-foreground, #64748b);
  cursor: pointer;
  font-weight: 600;
  font-size: 0.7rem;
  min-width: 2.2rem;
  border: 1px solid color-mix(in srgb, var(--border, rgba(148,163,184,0.35)) 55%, transparent);
  transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease;
  box-shadow: 0 3px 10px rgba(15, 23, 42, 0.12);
}
.dark .refmd-marp-pagination-btn {
  background: rgba(15,23,42,0.7);
  color: rgba(226,232,240,0.92);
  border: 1px solid rgba(148,163,184,0.25);
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
