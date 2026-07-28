/* Small helpers shared by the game modules and the app shell. */

/** Cryptographically-seeded Fisher-Yates. Returns a new array. */
export function shuffle(arr) {
  const a = arr.slice();
  if (a.length < 2) return a;
  const rand = new Uint32Array(a.length);
  crypto.getRandomValues(rand);
  for (let i = a.length - 1; i > 0; i--) {
    const j = rand[i] % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** One uniformly random item. */
export function pick(arr) {
  const r = new Uint32Array(1);
  crypto.getRandomValues(r);
  return arr[r[0] % arr.length];
}

export function escapeHtml(text) {
  const d = document.createElement('div');
  d.textContent = text ?? '';
  return d.innerHTML;
}
