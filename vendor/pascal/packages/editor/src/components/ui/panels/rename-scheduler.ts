// 23R-A-030/036: one pending debounced rename. Enter/blur flush it, Esc and
// "Hoàn tác" cancel it, so a stale 800 ms timer can never re-apply a name.
export function createRenameScheduler(ms: number) {
  let timer: ReturnType<typeof setTimeout> | null = null
  const cancel = () => {
    if (timer) clearTimeout(timer)
    timer = null
  }
  return {
    schedule(run: () => void) {
      cancel()
      timer = setTimeout(() => {
        timer = null
        run()
      }, ms)
    },
    cancel,
  }
}
