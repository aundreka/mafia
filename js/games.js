/* Registry of playable games. Each module exposes the same shape:
   meta, preview(n), inPlay(players), deal(players), clear(players), card(me, players) */

import * as mafia from './mafia.js';
import * as spyfall from './spyfall.js';

export const GAMES = { mafia, spyfall };
export const GAME_KEYS = Object.keys(GAMES);
export const DEFAULT_GAME = 'mafia';

export function gameOf(key) {
  return GAMES[key] || GAMES[DEFAULT_GAME];
}
