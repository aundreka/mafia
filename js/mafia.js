/* ------------------------------------------------------------------
   Mafia — secret killers hiding in a sleepy town.
------------------------------------------------------------------- */

import { shuffle, escapeHtml } from './util.js';

export const meta = {
  key: 'mafia',
  name: 'Mafia Night',
  emoji: '🎭',
  tagline: 'Find the killers before they find you',
  min: 4,
  max: 20,
  dealLabel: 'Deal the roles',
  color: '#FF6B7A'
};

export const ROLES = {
  mafia: {
    key: 'mafia', name: 'Mafia', emoji: '🎭', team: 'Team Mafia', rarity: 'LEGENDARY',
    color: '#FF6B7A', deep: '#E0424F',
    desc: 'Each night you and your crew quietly pick someone to take out. By day, act appalled.'
  },
  doctor: {
    key: 'doctor', name: 'Doctor', emoji: '💉', team: 'Team Town', rarity: 'EPIC',
    color: '#58D39B', deep: '#2FAE79',
    desc: 'Every night you save one person. Guess right and the mafia goes home empty-handed.'
  },
  detective: {
    key: 'detective', name: 'Detective', emoji: '🔍', team: 'Team Town', rarity: 'EPIC',
    color: '#9D8CF6', deep: '#7562DE',
    desc: 'Each night you point at one player and learn whether they are mafia. Sharing it is risky.'
  },
  villager: {
    key: 'villager', name: 'Villager', emoji: '🌻', team: 'Team Town', rarity: 'RARE',
    color: '#FFC85C', deep: '#E8A426',
    desc: 'No powers, just instincts. Listen hard, argue well, and vote the mafia out.'
  }
};

/**
 * Role counts for a table of `n` players. Mafia grow at roughly 1 per 4
 * players; support roles arrive once the town is big enough to absorb them,
 * and the town always keeps the majority.
 */
export function roleCounts(n) {
  const mafia = Math.max(1, Math.floor(n / 4));
  let doctor = 1;
  let detective = 1;

  if (n >= 13) doctor = 2;
  if (n >= 15) detective = 2;

  let villager = n - mafia - doctor - detective;
  while (villager < 1) {
    if (detective > 1) detective--;
    else if (doctor > 1) doctor--;
    else if (detective > 0) detective--;
    else doctor--;
    villager = n - mafia - doctor - detective;
  }

  return { mafia, doctor, detective, villager };
}

/** Chips shown in the lobby before dealing. */
export function preview(n) {
  const counts = roleCounts(Math.max(n, meta.min));
  return Object.entries(counts)
    .filter(([, c]) => c > 0)
    .map(([key, c]) => ({
      className: `chip-${key}`,
      label: `${ROLES[key].emoji} ${c} ${ROLES[key].name}${c > 1 ? 's' : ''}`
    }));
}

/** Chips shown to the host mid-round. */
export function inPlay(players) {
  const counts = { mafia: 0, doctor: 0, detective: 0, villager: 0 };
  for (const p of players) if (p.role) counts[p.role]++;
  return Object.entries(counts)
    .filter(([, c]) => c > 0)
    .map(([key, c]) => ({
      className: `chip-${key}`,
      label: `${ROLES[key].emoji} ${c} ${ROLES[key].name}${c > 1 ? 's' : ''}`
    }));
}

/** Deal — returns a flat patch of room paths. */
export function deal(players) {
  const bag = [];
  const counts = roleCounts(players.length);
  for (const [key, n] of Object.entries(counts)) for (let i = 0; i < n; i++) bag.push(key);

  const dealt = shuffle(bag);
  const patch = {};
  players.forEach((p, i) => {
    patch[`players/${p.id}/role`] = dealt[i];
    patch[`players/${p.id}/spy`] = null;
    patch[`players/${p.id}/place`] = null;
    patch[`players/${p.id}/job`] = null;
  });
  return patch;
}

/** Wipe every field this game wrote. */
export function clear(players) {
  const patch = {};
  for (const p of players) patch[`players/${p.id}/role`] = null;
  return patch;
}

export const stepsTitle = 'Night order';
export const steps = [
  '<b>Everyone, eyes closed.</b>',
  '<b>Mafia, wake up</b> — pick someone to take out.',
  '<b>Doctor, wake up</b> — pick someone to save.',
  '<b>Detective, wake up</b> — point at someone; nod yes if mafia.',
  '<b>Everyone, eyes open</b> — tell the story, then vote.'
];

/** The card a given player sees when their chest opens. */
export function card(me, players) {
  const role = ROLES[me.role];
  if (!role) return null;

  let extra = null;
  if (me.role === 'mafia') {
    const crew = players.filter((p) => p.role === 'mafia' && p.id !== me.id);
    extra = crew.length
      ? `Your crew: ${crew.map((p) => `<b>${escapeHtml(p.name)}</b>`).join(', ')}`
      : 'You are working <b>alone</b> tonight.';
  }

  return {
    rarity: role.rarity,
    emoji: role.emoji,
    title: role.name,
    desc: role.desc,
    team: role.team,
    color: role.color,
    deep: role.deep,
    extra
  };
}
