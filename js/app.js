/* ------------------------------------------------------------------
   App shell: game picker, lobby sync, dealing and reveal.
   The game-specific bits all live behind the modules in games.js.
------------------------------------------------------------------- */

import {
  initStore, mode, storeError, getRoom, setRoom, updateRoom, deleteRoom,
  subscribeRoom, setPlayer, removePlayer, watchDisconnect, watchRoomDisconnect
} from './store.js';
import { GAMES, GAME_KEYS, DEFAULT_GAME, gameOf } from './games.js';
import { LOCATIONS, DURATIONS, DEFAULT_DURATION } from './spyfall.js';
import { isConfigured } from './config.js';
import { escapeHtml } from './util.js';

const $  = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1
const AVATARS = ['🐱','🐶','🦊','🐻','🐼','🐰','🐯','🦁','🐸','🐵','🐷','🐨','🐮','🐔','🐧','🦄','🐙','🦉','🐢','🦝'];
const AVATAR_BG = ['#FFD9A8','#B9E7FF','#FFC9D3','#CFE9B8','#E3D4FF','#FFE9A8','#C7F0E4','#FFD2C2'];

const HEARTBEAT_MS = 8000;
const STALE_MS     = 40000;

/* In cloud mode identity lives in localStorage, so a refresh drops you back
   into your room. In local test mode it lives in sessionStorage instead, otherwise every tab on this machine would be the same player. */
const identity = isConfigured() ? localStorage : sessionStorage;

const me = {
  id: loadOrCreateId(),
  name: identity.getItem('mafia:name') || '',
  code: null
};

let pickedGame = identity.getItem('mafia:game') || DEFAULT_GAME;
let room = null;
let unsubscribe = null;
let heartbeat = null;
let revealed = false;
let lastStatus = null;
let lastRound = null;
let leaving = false;
let aloneHere = null;
let crossedOff = new Set();

const game = () => gameOf(room?.game || pickedGame);

/* ── boot ─────────────────────────────────────────────────── */

init();

async function init() {
  await initStore();

  if (mode === 'local') {
    const flag = $('#mode-flag');
    if (storeError) {
      // Keys are filled in but the database would not talk to us, say so
      // loudly, otherwise phones silently fail to see each other.
      flag.classList.add('warn');
      flag.textContent = '⚠️ OFFLINE: other phones will not see your room';
      toast(storeError, 9000);
    } else {
      flag.textContent = 'LOCAL TEST MODE: open a second tab to play along';
    }
    flag.hidden = false;
  }

  $('#input-name').value = me.name;

  wireHome();
  wireHowTo();
  wireJoin();
  wireLobby();
  wireReveal();
  wireLocations();
  wireGameMaster();

  buildDurationSeg();
  buildLocationGrid();
  paintGamePicker();

  setInterval(tickTimer, 250);

  const hashCode = normalizeCode(location.hash.replace('#', ''));
  if (hashCode.length === 4) {
    show('screen-join');
    fillCodeBoxes(hashCode);
  } else if (!localStorage.getItem('mafia:seen-howto')) {
    // First time on this phone: show the rules before anything else.
    localStorage.setItem('mafia:seen-howto', '1');
    openHowTo(pickedGame);
  }

  window.addEventListener('beforeunload', () => {
    if (!me.code || leaving) return;
    // Closing the tab as the last one here would otherwise strand an empty
    // room in the database forever, nobody is left to clean it up.
    if (playerList().length <= 1) deleteRoom(me.code);
    else removePlayer(me.code, me.id);
  });
}

/* ── screens ──────────────────────────────────────────────── */

function show(id) {
  $$('.screen').forEach((s) => s.classList.toggle('is-active', s.id === id));
  window.scrollTo(0, 0);
}

function toast(message, ms = 2400) {
  const el = $('#toast');
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.hidden = true; }, ms);
}

/* ── home ─────────────────────────────────────────────────── */

function wireHome() {
  $('#input-name').addEventListener('input', (e) => {
    me.name = e.target.value.trim();
    identity.setItem('mafia:name', me.name);
  });

  $$('#game-picker .game-tile').forEach((tile) => {
    tile.addEventListener('click', () => {
      pickedGame = tile.dataset.game;
      identity.setItem('mafia:game', pickedGame);
      paintGamePicker();
    });
  });

  $('#btn-create').addEventListener('click', createRoom);
  $('#btn-goto-join').addEventListener('click', () => {
    if (!requireName()) return;
    show('screen-join');
    $('.code-box').focus();
  });

  $$('[data-back]').forEach((b) =>
    b.addEventListener('click', () => show(b.dataset.back))
  );
}

function paintGamePicker() {
  $$('#game-picker .game-tile').forEach((t) =>
    t.classList.toggle('is-picked', t.dataset.game === pickedGame)
  );
  $('#logo-emoji').textContent = GAMES[pickedGame].meta.emoji;
  $('.tagline').textContent = GAMES[pickedGame].meta.tagline;
}

/* ── how to play ──────────────────────────────────────────── */

let howToGame = DEFAULT_GAME;

function wireHowTo() {
  $('#btn-howto').addEventListener('click', () => openHowTo(pickedGame));
  $('#btn-close-howto').addEventListener('click', () => show('screen-home'));
  $('#btn-howto-done').addEventListener('click', () => {
    // Reading about a game is a good signal you want to play that one.
    pickedGame = howToGame;
    identity.setItem('mafia:game', pickedGame);
    paintGamePicker();
    show('screen-home');
  });

  $$('#howto-picker .game-tile').forEach((tile) =>
    tile.addEventListener('click', () => openHowTo(tile.dataset.game))
  );
}

function openHowTo(key) {
  howToGame = GAMES[key] ? key : DEFAULT_GAME;
  const g = GAMES[howToGame];

  $$('#howto-picker .game-tile').forEach((t) =>
    t.classList.toggle('is-picked', t.dataset.game === howToGame)
  );

  $('#howto-title').textContent = `How to play ${g.meta.name}`;
  $('#howto-goal').textContent = g.howto.goal;
  $('#howto-count').textContent = `${g.meta.min} to ${g.meta.max} players · one phone each`;
  $('#howto-tip').textContent = g.howto.tip;

  const sections = $('#howto-sections');
  sections.innerHTML = '';
  g.howto.sections.forEach((s, i) => {
    const card = document.createElement('div');
    card.className = 'card howto-step';
    card.innerHTML =
      `<div class="howto-head"><span class="howto-icon">${s.icon}</span>
         <h3 class="card-title sm">${escapeHtml(s.title)}</h3></div>
       <p class="howto-body">${escapeHtml(s.body)}</p>`;
    card.style.animationDelay = `${i * 60}ms`;
    sections.append(card);
  });

  const wins = $('#howto-win');
  wins.innerHTML = '';
  for (const w of g.howto.win) {
    const row = document.createElement('p');
    row.className = 'howto-win';
    row.innerHTML = `<b>${escapeHtml(w.who)}</b> ${escapeHtml(w.how)}`;
    wins.append(row);
  }

  show('screen-howto');
}

function requireName() {
  if (me.name.length >= 1) return true;
  toast('Pop your name in first 🙂');
  $('#input-name').focus();
  return false;
}

/* ── create ───────────────────────────────────────────────── */

async function createRoom() {
  if (!requireName()) return;

  const btn = $('#btn-create');
  btn.disabled = true;

  try {
    const code = await freshCode();
    await setRoom(code, {
      code,
      hostId: me.id,
      game: pickedGame,
      createdAt: Date.now(),
      status: 'lobby',
      round: 0,
      duration: DEFAULT_DURATION,
      players: { [me.id]: newPlayer() }
    });
    await enterRoom(code);
  } catch (err) {
    console.error(err);
    toast('Could not make a room, check your connection.');
  } finally {
    btn.disabled = false;
  }
}

async function freshCode() {
  for (let attempt = 0; attempt < 12; attempt++) {
    const code = randomCode();
    if (!(await getRoom(code))) return code;
  }
  throw new Error('No free room codes');
}

function randomCode() {
  const bytes = new Uint32Array(4);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

function newPlayer() {
  return {
    id: me.id,
    name: me.name.slice(0, 14),
    avatar: avatarIndex(me.id),
    joinedAt: Date.now(),
    lastSeen: Date.now()
  };
}

/* ── join ─────────────────────────────────────────────────── */

function wireJoin() {
  const boxes = $$('.code-box');

  boxes.forEach((box, i) => {
    box.addEventListener('input', () => {
      box.value = normalizeCode(box.value).slice(-1);
      box.classList.toggle('filled', !!box.value);
      if (box.value && i < boxes.length - 1) boxes[i + 1].focus();
      if (boxes.every((b) => b.value)) joinRoom();
    });

    box.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !box.value && i > 0) {
        boxes[i - 1].focus();
        boxes[i - 1].value = '';
        boxes[i - 1].classList.remove('filled');
        e.preventDefault();
      }
      if (e.key === 'Enter') joinRoom();
    });

    box.addEventListener('paste', (e) => {
      e.preventDefault();
      fillCodeBoxes(normalizeCode(e.clipboardData.getData('text')));
    });
  });

  $('#btn-join').addEventListener('click', joinRoom);
}

function fillCodeBoxes(code) {
  const boxes = $$('.code-box');
  boxes.forEach((b, i) => {
    b.value = code[i] || '';
    b.classList.toggle('filled', !!b.value);
  });
  boxes[Math.min(code.length, 3)]?.focus();
}

function readCodeBoxes() {
  return $$('.code-box').map((b) => b.value).join('').toUpperCase();
}

function normalizeCode(text) {
  return (text || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
}

async function joinRoom() {
  const code = readCodeBoxes();
  if (code.length !== 4) return toast('Four letters, please 🔑');
  if (!requireName()) return;

  const btn = $('#btn-join');
  btn.disabled = true;

  try {
    const target = await getRoom(code);
    if (!target) return toast(`No room called ${code}`);

    const players = target.players || {};
    // A husk left behind by a crashed host: sweep it and report it as gone,
    // rather than dropping someone into an empty room with a dead host id.
    if (Object.keys(players).length === 0) {
      await deleteRoom(code);
      return toast(`No room called ${code}`);
    }
    const max = gameOf(target.game).meta.max;
    if (!players[me.id]) {
      if (target.status === 'playing') return toast('That game already started 🎬');
      if (Object.keys(players).length >= max) return toast(`Room is full (${max} max)`);
    }

    await setPlayer(code, me.id, {
      ...newPlayer(),
      ...(players[me.id] || {}),
      name: me.name.slice(0, 14),
      lastSeen: Date.now()
    });
    await enterRoom(code);
  } catch (err) {
    console.error(err);
    toast('Could not join, check your connection.');
  } finally {
    btn.disabled = false;
  }
}

/* ── room session ─────────────────────────────────────────── */

async function enterRoom(code) {
  me.code = code;
  revealed = false;
  lastStatus = null;
  lastRound = null;
  aloneHere = null;
  history.replaceState(null, '', `#${code}`);

  // Paint the code before the first snapshot lands, otherwise the host
  // stares at the placeholder dots for as long as the round trip takes.
  $('#lobby-code').textContent = code;
  $('#gm-code').textContent = code;
  $('#lobby-count').textContent = 'Connecting…';

  watchDisconnect(code, me.id);
  unsubscribe?.();
  unsubscribe = subscribeRoom(code, onRoomChange);

  clearInterval(heartbeat);
  heartbeat = setInterval(pulse, HEARTBEAT_MS);

  show('screen-lobby');
}

function pulse() {
  if (!me.code || !room) return;
  updateRoom(me.code, { [`players/${me.id}/lastSeen`]: Date.now() });
  if (isHost()) pruneStale();
}

function isHost() {
  return room && room.hostId === me.id;
}

function playerList() {
  return Object.values(room?.players || {}).sort((a, b) => a.joinedAt - b.joinedAt);
}

function pruneStale() {
  const now = Date.now();
  const patch = {};
  for (const p of playerList()) {
    if (p.id !== me.id && now - (p.lastSeen || 0) > STALE_MS) patch[`players/${p.id}`] = null;
  }
  if (Object.keys(patch).length) updateRoom(me.code, patch);
}

function onRoomChange(next) {
  if (!next) {
    if (!leaving && me.code) {
      toast('The host closed the room 👋');
      goHome();
    }
    return;
  }

  room = next;

  // An empty husk, every player vanished without anyone tidying up.
  if (!room.players || Object.keys(room.players).length === 0) {
    deleteRoom(room.code || me.code);
    goHome();
    return;
  }

  if (!room.players[me.id]) {
    toast('You left the room');
    goHome();
    return;
  }

  const stillHere = playerList();

  // While I'm the only one here, ask the server to bin the whole room if I
  // drop off. Cancel the moment someone else arrives.
  const alone = stillHere.length === 1 && stillHere[0].id === me.id;
  if (alone !== aloneHere) {
    aloneHere = alone;
    watchRoomDisconnect(me.code, alone, me.id);
  }

  if (!room.players[room.hostId] && stillHere.length) {
    if (stillHere[0].id === me.id) updateRoom(me.code, { hostId: me.id });
    return;
  }

  renderLobby();

  // A new deal is either a status flip or a bumped round (host re-shuffled).
  if (room.status !== lastStatus || room.round !== lastRound) {
    lastStatus = room.status;
    lastRound = room.round;
    revealed = false;
    crossedOff = new Set();
    paintLocationGrid();
    resetChest();
    show(room.status === 'playing' ? 'screen-reveal' : 'screen-lobby');
  }

  if (room.status === 'playing') {
    renderRoleCard();
    renderGameMaster();
  }
  renderLocationReveal();
}

function goHome() {
  leaving = true;
  unsubscribe?.();
  unsubscribe = null;
  clearInterval(heartbeat);
  room = null;
  me.code = null;
  history.replaceState(null, '', location.pathname);
  show('screen-home');
  setTimeout(() => { leaving = false; }, 400);
}

/* ── lobby ────────────────────────────────────────────────── */

function wireLobby() {
  $('#btn-copy-code').addEventListener('click', copyCode);
  $('#btn-start').addEventListener('click', startGame);

  $('#btn-switch-game').addEventListener('click', () => {
    if (!isHost()) return;
    const next = GAME_KEYS[(GAME_KEYS.indexOf(room.game) + 1) % GAME_KEYS.length];
    updateRoom(me.code, { game: next, ...game().clear(playerList()) });
    toast(`Switched to ${GAMES[next].meta.name} ${GAMES[next].meta.emoji}`);
  });

  $('#btn-leave').addEventListener('click', async () => {
    if (!me.code) return goHome();
    leaving = true;
    const code = me.code;
    const wasHost = isHost();
    const others = playerList().filter((p) => p.id !== me.id);
    await removePlayer(code, me.id);
    if (wasHost && others.length === 0) await deleteRoom(code);
    else if (wasHost) await updateRoom(code, { hostId: others[0].id });
    goHome();
  });
}

async function copyCode() {
  const code = me.code || '';
  try {
    await navigator.clipboard.writeText(code);
    toast(`Copied ${code}, go share it 📋`);
  } catch {
    toast(`Room code: ${code}`);
  }
}

function buildDurationSeg() {
  const seg = $('#duration-seg');
  seg.innerHTML = '';
  for (const mins of DURATIONS) {
    const b = document.createElement('button');
    b.className = 'seg-btn';
    b.dataset.mins = mins;
    b.textContent = `${mins} min`;
    b.addEventListener('click', () => updateRoom(me.code, { duration: mins }));
    seg.append(b);
  }
}

function renderLobby() {
  const g = game();
  const players = playerList();

  $('#lobby-code').textContent = room.code;
  $('#gm-code').textContent = room.code;
  $('#lobby-game-label').textContent = `${g.meta.emoji} ${g.meta.name}`;

  $('#lobby-count').textContent =
    players.length === 1 ? '1 player here' : `${players.length} players here`;
  $('#lobby-you').textContent = isHost() ? 'You’re the host' : 'You’re in';
  $('#lobby-you').className = isHost() ? 'pill host' : 'pill';

  const list = $('#player-list');
  list.innerHTML = '';
  for (const p of players) {
    const li = document.createElement('li');

    const av = document.createElement('span');
    av.className = 'avatar';
    av.style.background = AVATAR_BG[(p.avatar ?? 0) % AVATAR_BG.length];
    av.textContent = AVATARS[(p.avatar ?? 0) % AVATARS.length];

    const name = document.createElement('span');
    name.className = 'player-name';
    name.textContent = p.name + (p.id === me.id ? ' (you)' : '');

    li.append(av, name);

    if (p.id === room.hostId) {
      const tag = document.createElement('span');
      tag.className = 'pill host';
      tag.textContent = 'HOST';
      li.append(tag);
    }
    list.append(li);
  }

  const host = isHost();
  $('#host-panel').hidden = !host;
  $('#guest-panel').hidden = host;
  $('#guest-waiting-text').textContent =
    `Hang tight, the host is setting up ${g.meta.name}.`;

  if (host) {
    const short = g.meta.min - players.length;
    $('#btn-start').disabled = short > 0;
    $('#start-label').textContent = g.meta.dealLabel;
    $('#lineup-title').textContent = room.game === 'spyfall' ? 'Tonight’s setup' : 'Tonight’s line-up';
    $('#start-hint').textContent = short > 0
      ? `Need ${short} more player${short === 1 ? '' : 's'}`
      : 'Everyone in? Deal when ready.';
    renderChips($('#role-preview'), g.preview(players.length));

    const timed = room.game === 'spyfall';
    $('#duration-row').hidden = !timed;
    $$('#duration-seg .seg-btn').forEach((b) =>
      b.classList.toggle('on', Number(b.dataset.mins) === (room.duration || DEFAULT_DURATION))
    );

    const other = GAMES[GAME_KEYS[(GAME_KEYS.indexOf(room.game) + 1) % GAME_KEYS.length]].meta;
    $('#btn-switch-game').textContent = `Switch to ${other.name} ${other.emoji}`;
  }
}

function renderChips(container, chips) {
  container.innerHTML = '';
  for (const c of chips) {
    const el = document.createElement('span');
    el.className = `chip ${c.className}`;
    el.textContent = c.label;
    container.append(el);
  }
}

/* ── dealing ──────────────────────────────────────────────── */

async function startGame() {
  const g = game();
  const players = playerList();
  if (players.length < g.meta.min) return toast(`Need at least ${g.meta.min} players`);

  $('#btn-start').disabled = true;
  await updateRoom(me.code, {
    status: 'playing',
    round: (room.round || 0) + 1,
    timerEndsAt: null,
    ...g.deal(players)
  });
}

async function endGame() {
  await updateRoom(me.code, { status: 'lobby', ...game().clear(playerList()) });
}

/* ── reveal ───────────────────────────────────────────────── */

function wireReveal() {
  $('#chest').addEventListener('click', () => {
    if (revealed) return;
    revealed = true;
    openChest();
  });

  $('#btn-hide-role').addEventListener('click', () => {
    revealed = false;
    resetChest();
  });

  $('#btn-open-locations').addEventListener('click', () => show('screen-locations'));
  $('#btn-gm').addEventListener('click', () => show('screen-gm'));
}

function openChest() {
  $('#chest').classList.add('opened');
  $('#chest-glow').classList.add('on');
  $('#chest-tap').style.visibility = 'hidden';

  const info = game().card(room?.players?.[me.id], playerList());
  $('#reveal-kicker').textContent = info?.rarity || 'READY';

  setTimeout(() => {
    $('#role-card').hidden = false;
    $('#btn-hide-role').hidden = false;
    syncRevealButtons();
  }, 320);
}

function resetChest() {
  $('#chest').classList.remove('opened');
  $('#chest-glow').classList.remove('on');
  $('#chest-tap').style.visibility = 'visible';
  $('#reveal-kicker').textContent = 'Your role is ready';
  $('#role-card').hidden = true;
  $('#btn-hide-role').hidden = true;
  syncRevealButtons();
}

function syncRevealButtons() {
  $('#btn-gm').hidden = !isHost();
  $('#btn-open-locations').hidden = room?.game !== 'spyfall' || room?.status !== 'playing';
  $('#timer').hidden = room?.game !== 'spyfall' || room?.status !== 'playing';
}

function renderRoleCard() {
  const mine = room.players?.[me.id];
  const info = game().card(mine, playerList());
  if (!info) return;

  const card = $('#role-card');
  card.style.setProperty('--role', info.color);
  card.style.setProperty('--role-deep', info.deep);

  $('#role-rarity').textContent = info.rarity;
  $('#role-emoji').textContent = info.emoji;
  $('#role-name').textContent = info.title;
  $('#role-desc').textContent = info.desc;
  $('#role-team').textContent = info.team;

  const extra = $('#role-mates');
  extra.hidden = !info.extra;
  if (info.extra) extra.innerHTML = info.extra;

  syncRevealButtons();
}

function renderLocationReveal() {
  const banner = $('#location-reveal');
  if (room?.game === 'spyfall' && room.location) {
    const place = LOCATIONS.find((l) => l.name === room.location);
    banner.hidden = false;
    banner.innerHTML = `<span class="reveal-banner-label">The location was</span>
      <span class="reveal-banner-place">${place?.emoji || '📍'} ${escapeHtml(room.location)}</span>`;
  } else {
    banner.hidden = true;
  }
}

/* ── locations sheet ──────────────────────────────────────── */

function wireLocations() {
  $('#btn-close-locations').addEventListener('click', () => show('screen-reveal'));
}

function buildLocationGrid() {
  const grid = $('#loc-grid');
  grid.innerHTML = '';
  for (const loc of LOCATIONS) {
    const b = document.createElement('button');
    b.className = 'loc';
    b.dataset.name = loc.name;
    b.innerHTML = `<span class="loc-emoji">${loc.emoji}</span><span>${escapeHtml(loc.name)}</span>`;
    b.addEventListener('click', () => {
      if (crossedOff.has(loc.name)) crossedOff.delete(loc.name);
      else crossedOff.add(loc.name);
      paintLocationGrid();
    });
    grid.append(b);
  }
}

function paintLocationGrid() {
  $$('#loc-grid .loc').forEach((b) =>
    b.classList.toggle('struck', crossedOff.has(b.dataset.name))
  );
}

/* ── timer ────────────────────────────────────────────────── */

function tickTimer() {
  if (room?.game !== 'spyfall') return;

  const total = (room.duration || DEFAULT_DURATION) * 60000;
  const left = room.timerEndsAt ? Math.max(0, room.timerEndsAt - Date.now()) : total;
  const text = clockText(left);

  $('#timer-clock').textContent = text;
  $('#gm-clock').textContent = text;
  $('#timer').classList.toggle('urgent', room.timerEndsAt && left < 60000);

  const running = !!room.timerEndsAt && left > 0;
  $('#timer-label').textContent = running ? 'Stop the round' : 'Start the round';
  $('#btn-timer').firstElementChild.textContent = running ? '⏹️' : '▶️';

  if (room.timerEndsAt && left === 0 && !tickTimer._fired) {
    tickTimer._fired = true;
    toast('⏰ Time’s up, the spy survives unless you catch them now!', 4000);
  }
  if (left > 0) tickTimer._fired = false;
}

function clockText(ms) {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/* ── game master ──────────────────────────────────────────── */

function wireGameMaster() {
  $('#btn-reshuffle').addEventListener('click', async () => {
    await startGame();
    toast('Fresh round dealt 🔄');
  });

  $('#btn-timer').addEventListener('click', () => {
    const left = room.timerEndsAt ? room.timerEndsAt - Date.now() : 0;
    const running = left > 0;
    updateRoom(me.code, {
      timerEndsAt: running ? null : Date.now() + (room.duration || DEFAULT_DURATION) * 60000
    });
  });

  $('#btn-reveal-location').addEventListener('click', () => {
    const place = playerList().find((p) => p.place)?.place;
    if (!place) return toast('Deal a round first');
    updateRoom(me.code, { location: place, timerEndsAt: null });
  });

  $('#btn-end').addEventListener('click', endGame);
  $('#btn-gm-myrole').addEventListener('click', () => show('screen-reveal'));
}

function renderGameMaster() {
  if (!isHost()) return;
  const g = game();
  const spyfall = room.game === 'spyfall';

  renderChips($('#gm-roles'), g.inPlay(playerList()));
  $('#gm-timer-card').hidden = !spyfall;
  $('#gm-hint').textContent = spyfall
    ? 'The location stays hidden here too, so a host who drew Spy can’t cheat.'
    : 'Only counts, nobody’s secret is spoiled.';

  $('#gm-script-title').textContent = g.stepsTitle;
  const steps = $('#gm-steps');
  steps.innerHTML = '';
  for (const s of g.steps) {
    const li = document.createElement('li');
    li.innerHTML = s;
    steps.append(li);
  }
  if (g.winNote) {
    const li = document.createElement('li');
    li.className = 'note';
    li.textContent = g.winNote;
    steps.append(li);
  }
}

/* ── identity ─────────────────────────────────────────────── */

function loadOrCreateId() {
  let id = identity.getItem('mafia:id');
  if (!id) {
    id = (crypto.randomUUID?.() || Math.random().toString(36).slice(2) + Date.now().toString(36))
      .replace(/-/g, '')
      .slice(0, 16);
    identity.setItem('mafia:id', id);
  }
  return id;
}

function avatarIndex(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % AVATARS.length;
}
