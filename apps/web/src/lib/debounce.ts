export function debounce<Args extends unknown[]>(fn: (...args: Args) => void, ms: number) {
  let timer: ReturnType<typeof setTimeout> | null = null;

  function debounced(...args: Args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, ms);
  }

  debounced.flush = (...args: Args) => {
    if (timer) clearTimeout(timer);
    timer = null;
    fn(...args);
  };

  return debounced;
}
