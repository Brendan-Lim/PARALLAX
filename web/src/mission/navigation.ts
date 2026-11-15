import { demoMode } from './demoProfile';
/** One explicit reveal intent; later navigation or user interaction cancels pending work. */
let cancel = () => {};
export function revealTarget(id: string, activate = false, fallback?: string) {
  cancel();
  let frame = 0;
  let revealed: HTMLElement | null = null;
  const observer = new MutationObserver(schedule);
  function stop() {
    observer.disconnect();
    cancelAnimationFrame(frame);
    window.removeEventListener('hashchange', stop);
    window.removeEventListener('pointerdown', stop, true);
    window.removeEventListener('keydown', stop, true);
  }
  function schedule() {
    if (revealed?.isConnected) return;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const guide = document.querySelector('.m-guide');
      if (demoMode && document.querySelector('.m-experience') && !guide) return;
      const requested = document.getElementById(id);
      const el =
        !activate && fallback && requested instanceof HTMLButtonElement && requested.disabled
          ? document.getElementById(fallback)
          : requested;
      if (
        !el ||
        !el.getClientRects().length ||
        (activate && el instanceof HTMLButtonElement && el.disabled)
      )
        return;
      const header = document.querySelector('.s-header')?.getBoundingClientRect().bottom ?? 0;
      const offset =
        Math.max(
          header,
          guide && !guide.contains(el) && getComputedStyle(guide).position === 'sticky'
            ? guide.getBoundingClientRect().bottom
            : 0,
        ) + 16;
      el.focus({ preventScroll: true });
      window.scrollTo({
        top: window.scrollY + el.getBoundingClientRect().top - offset,
        behavior: 'instant',
      });
      revealed = el;
      if (activate && el instanceof HTMLButtonElement) {
        stop();
        el.click();
      }
    });
  }
  cancel = stop;
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['hidden', 'disabled'],
  });
  window.addEventListener('hashchange', stop);
  window.addEventListener('pointerdown', stop, true);
  window.addEventListener('keydown', stop, true);
  schedule();
  return stop;
}

export function companionLink(session: string, run: string, event?: string) {
  const query = new URLSearchParams(location.search);
  if (event) query.set('event', event);
  else query.delete('event');
  return `?${query}#mission/companion/${session}/${run}`;
}
