/* ------------------------------------------------------------------
   Room storage.

   Two interchangeable backends behind one tiny API:
     • cloud: Firebase Realtime Database (real cross-device play)
     • local: localStorage + BroadcastChannel (multi-tab testing)

   Room shape:
   {
     code, hostId, createdAt, status: 'lobby' | 'playing', round,
     players: { [id]: { id, name, avatar, joinedAt, lastSeen, role? } }
   }
------------------------------------------------------------------- */

import { firebaseConfig, isConfigured, ROOM_TTL_MS } from './config.js';

const FIREBASE_VERSION = '10.12.5';

export let mode = 'local';
export let storeError = null;
let backend = null;

/** Give up on a hung network call instead of leaving the UI dead.
    A healthy connection settles in ~4s, so this leaves plenty of head-room
    for slow mobile data before we fall back to offline play. */
const CONNECT_TIMEOUT_MS = 15000;

function withTimeout(promise, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(label)), CONNECT_TIMEOUT_MS))
  ]);
}

export async function initStore() {
  // ?local=1 forces the offline backend, handy for testing without
  // touching a real database.
  const forceLocal = new URLSearchParams(location.search).has('local');

  if (!forceLocal && isConfigured()) {
    try {
      backend = await withTimeout(cloudBackend(), 'Firebase SDK did not load');
      await withTimeout(backend.probe(), 'Database did not answer, are the rules published?');
      mode = 'cloud';
      return mode;
    } catch (err) {
      console.warn('[party] Firebase unavailable, falling back to local mode.', err);
      storeError = friendlyError(err);
    }
  }

  backend = localBackend();
  mode = 'local';
  return mode;
}

function friendlyError(err) {
  const text = String(err?.message || err);
  if (/permission_denied|Permission denied/i.test(text)) {
    return 'Firebase said permission denied, publish database.rules.json in the Rules tab.';
  }
  if (/did not answer/i.test(text)) {
    return 'Could not reach your database. Check databaseURL in config.js and that the rules are published.';
  }
  if (/did not load/i.test(text)) {
    return 'Could not download the Firebase SDK, check your internet connection.';
  }
  return `Firebase error: ${text}`;
}

/* ── public API ───────────────────────────────────────────── */

export const getRoom       = (code)            => backend.get(code);
export const setRoom       = (code, room)      => backend.set(code, room);
export const updateRoom    = (code, patch)     => backend.update(code, patch);
export const deleteRoom    = (code)            => backend.remove(code);
export const subscribeRoom = (code, cb)        => backend.subscribe(code, cb);
export const setPlayer     = (code, id, p)     => backend.update(code, { [`players/${id}`]: p });
export const removePlayer  = (code, id)        => backend.update(code, { [`players/${id}`]: null });
export const watchDisconnect = (code, id)      => backend.onDisconnectRemove?.(code, id);
/** Arm/disarm server-side deletion of the whole room if this client vanishes. */
export const watchRoomDisconnect = (code, on, playerId) =>
  backend.onDisconnectRoom?.(code, on, playerId);

/* ── Firebase Realtime Database ───────────────────────────── */

async function cloudBackend() {
  const base = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}`;
  const { initializeApp } = await import(`${base}/firebase-app.js`);
  const rtdb = await import(`${base}/firebase-database.js`);

  const app = initializeApp(firebaseConfig);
  const db = rtdb.getDatabase(app);
  const roomRef = (code) => rtdb.ref(db, `rooms/${code}`);

  return {
    async get(code) {
      const snap = await rtdb.get(roomRef(code));
      return snap.exists() ? snap.val() : null;
    },
    set(code, room) {
      return rtdb.set(roomRef(code), room);
    },
    update(code, patch) {
      return rtdb.update(roomRef(code), patch);
    },
    remove(code) {
      return rtdb.remove(roomRef(code));
    },
    subscribe(code, cb) {
      return rtdb.onValue(roomRef(code), (snap) => cb(snap.exists() ? snap.val() : null));
    },
    onDisconnectRemove(code, id) {
      rtdb.onDisconnect(rtdb.ref(db, `rooms/${code}/players/${id}`)).remove();
    },
    // Registered on the server, so it still fires when a tab is killed, // a beforeunload delete never survives long enough to reach Firebase.
    async onDisconnectRoom(code, on, playerId) {
      const od = rtdb.onDisconnect(roomRef(code));
      if (on) return od.remove();
      // cancel() clears handlers at this path AND below it, so the player's
      // own removal handler goes with it, put that one back.
      await od.cancel();
      if (playerId) {
        await rtdb.onDisconnect(rtdb.ref(db, `rooms/${code}/players/${playerId}`)).remove();
      }
    },
    // Reads an empty room slot to prove the rules let us in. Uses a
    // four-character code because database.rules.json only opens up
    // `rooms/$code` when the code is exactly that long.
    probe() {
      return rtdb.get(roomRef('ZZZZ'));
    }
  };
}

/* ── localStorage backend ─────────────────────────────────── */

function localBackend() {
  const KEY = (code) => `mafia:room:${code}`;
  const channel = 'BroadcastChannel' in window ? new BroadcastChannel('mafia-rooms') : null;
  const listeners = new Map(); // code → Set<cb>

  const read = (code) => {
    try {
      const raw = localStorage.getItem(KEY(code));
      if (!raw) return null;
      const room = JSON.parse(raw);
      if (room.createdAt && Date.now() - room.createdAt > ROOM_TTL_MS) {
        localStorage.removeItem(KEY(code));
        return null;
      }
      return room;
    } catch {
      return null;
    }
  };

  const write = (code, room) => {
    if (room === null) localStorage.removeItem(KEY(code));
    else localStorage.setItem(KEY(code), JSON.stringify(room));
    fanout(code);
    channel?.postMessage(code);
  };

  const fanout = (code) => {
    const set = listeners.get(code);
    if (!set) return;
    const room = read(code);
    set.forEach((cb) => cb(room));
  };

  channel?.addEventListener('message', (e) => fanout(e.data));
  window.addEventListener('storage', (e) => {
    if (e.key?.startsWith('mafia:room:')) fanout(e.key.slice('mafia:room:'.length));
  });

  return {
    async get(code) { return read(code); },
    async set(code, room) { write(code, room); },
    async update(code, patch) {
      const room = read(code);
      if (!room) return;
      for (const [path, value] of Object.entries(patch)) setPath(room, path, value);
      write(code, room);
    },
    async remove(code) { write(code, null); },
    subscribe(code, cb) {
      if (!listeners.has(code)) listeners.set(code, new Set());
      listeners.get(code).add(cb);
      cb(read(code));
      const poll = setInterval(() => cb(read(code)), 700); // safety net
      return () => { listeners.get(code)?.delete(cb); clearInterval(poll); };
    }
  };
}

/** Writes `value` at a slash-delimited path; `null` deletes the key. */
function setPath(obj, path, value) {
  const parts = path.split('/').filter(Boolean);
  const last = parts.pop();
  let node = obj;
  for (const part of parts) {
    if (typeof node[part] !== 'object' || node[part] === null) node[part] = {};
    node = node[part];
  }
  if (value === null) delete node[last];
  else node[last] = value;
}
