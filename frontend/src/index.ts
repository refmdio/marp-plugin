import { MarpApp } from './marp-app'
export { canOpen, getRoute, exec } from './api'

export default async function mount(container: Element, host: any) {
  const app = new MarpApp(container, host)
  await app.mount()
  return () => app.dispose()
}
