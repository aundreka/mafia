/* ------------------------------------------------------------------
   Spyfall: everyone shares a location except the spies, who have to
   work out where they are before the room works out who they are.
------------------------------------------------------------------- */

import { shuffle, pick } from './util.js';

export const meta = {
  key: 'spyfall',
  name: 'Spyfall',
  emoji: '🕵️',
  tagline: 'One of you has no idea where they are',
  min: 3,
  max: 20,
  dealLabel: 'Send everyone in',
  color: '#7562DE'
};

/** Round lengths the host can pick from, in minutes. */
export const DURATIONS = [6, 8, 10];
export const DEFAULT_DURATION = 8;

/* ── locations ────────────────────────────────────────────────────
   Two packs, concatenated. Delete either array to drop that pack, nothing else references them by name.
------------------------------------------------------------------ */

export const CLASSIC = [
  { name: 'Airplane',        emoji: '✈️', roles: ['Pilot', 'Flight attendant', 'First class snob', 'Nervous flyer', 'Air marshal', 'Tired baby', 'Co-pilot'] },
  { name: 'Bank',            emoji: '🏦', roles: ['Teller', 'Manager', 'Security guard', 'Armoured van driver', 'Customer', 'Robber', 'Consultant'] },
  { name: 'Beach',           emoji: '🏖️', roles: ['Lifeguard', 'Surfer', 'Ice cream vendor', 'Sunbather', 'Photographer', 'Kid with a bucket', 'Beach cop'] },
  { name: 'Casino',          emoji: '🎰', roles: ['Dealer', 'Bouncer', 'High roller', 'Bartender', 'Card counter', 'Hostess', 'Pit boss'] },
  { name: 'Hospital',        emoji: '🏥', roles: ['Surgeon', 'Nurse', 'Patient', 'Intern', 'Receptionist', 'Anaesthesiologist', 'Worried relative'] },
  { name: 'Hotel',           emoji: '🏨', roles: ['Receptionist', 'Bellhop', 'Housekeeper', 'Guest', 'Bartender', 'Manager', 'Security'] },
  { name: 'Movie Studio',    emoji: '🎬', roles: ['Director', 'Lead actor', 'Stunt double', 'Camera operator', 'Costume designer', 'Producer', 'Extra'] },
  { name: 'Pirate Ship',     emoji: '🏴‍☠️', roles: ['Captain', 'First mate', 'Cabin boy', 'Cannoneer', 'Cook', 'Prisoner', 'Lookout'] },
  { name: 'Polar Station',   emoji: '🧊', roles: ['Biologist', 'Radio operator', 'Medic', 'Geologist', 'Cook', 'Expedition leader', 'Mechanic'] },
  { name: 'Police Station',  emoji: '🚓', roles: ['Detective', 'Patrol officer', 'Suspect', 'Lawyer', 'Criminologist', 'Journalist', 'Desk sergeant'] },
  { name: 'Restaurant',      emoji: '🍝', roles: ['Head chef', 'Waiter', 'Food critic', 'Dishwasher', 'Hungry customer', 'Host', 'Musician'] },
  { name: 'School',          emoji: '🎒', roles: ['Teacher', 'Principal', 'Student', 'Janitor', 'Cafeteria lady', 'Coach', 'Guidance counsellor'] },
  { name: 'Space Station',   emoji: '🛰️', roles: ['Commander', 'Engineer', 'Scientist', 'Space tourist', 'Doctor', 'Alien specialist', 'Mission control'] },
  { name: 'Submarine',       emoji: '🚢', roles: ['Captain', 'Sonar operator', 'Cook', 'Navigator', 'Engineer', 'Radio operator', 'New recruit'] },
  { name: 'Supermarket',     emoji: '🛒', roles: ['Cashier', 'Shelf stacker', 'Customer', 'Security guard', 'Butcher', 'Manager', 'Sample lady'] },
  { name: 'Theatre',         emoji: '🎭', roles: ['Lead actor', 'Prompter', 'Usher', 'Audience member', 'Director', 'Stagehand', 'Critic'] },
  { name: 'Train',           emoji: '🚆', roles: ['Conductor', 'Ticket inspector', 'Passenger', 'Snack cart attendant', 'Engineer', 'Stowaway', 'Tourist'] },
  { name: 'Amusement Park',  emoji: '🎡', roles: ['Ride operator', 'Mascot', 'Ticket seller', 'Excited kid', 'Tired parent', 'Janitor', 'Food vendor'] },
  { name: 'Gym',             emoji: '🏋️', roles: ['Personal trainer', 'Receptionist', 'Bodybuilder', 'First timer', 'Yoga instructor', 'Janitor', 'Protein guy'] },
  { name: 'Wedding',         emoji: '💒', roles: ['Bride', 'Groom', 'Priest', 'Photographer', 'Caterer', 'Drunk uncle', 'Flower girl'] }
];

export const PINOY = [
  { name: 'Palengke',            emoji: '🐟', roles: ['Tindera ng isda', 'Suki', 'Karga-boy', 'Barker', 'Bantay ng puwesto', 'Tindero ng gulay', 'Namimili'] },
  { name: 'Jeepney Terminal',    emoji: '🚐', roles: ['Driver', 'Barker', 'Konduktor', 'Late passenger', 'Vendor ng sampaguita', 'Dispatcher', 'Estudyante'] },
  { name: 'Sari-sari Store',     emoji: '🏪', roles: ['Tindera', 'Batang utusan', 'Suking umuutang', 'Delivery guy', 'Tambay sa labas', 'Aso ng may-ari', 'Bumibili ng load'] },
  { name: 'Barangay Fiesta',     emoji: '🎊', roles: ['Kapitan', 'Lechon carver', 'Kumakanta sa stage', 'Bisita', 'Bata sa palaro', 'Tiyahin sa kusina', 'Photographer'] },
  { name: 'Videoke Bar',         emoji: '🎤', roles: ['Sumisigaw ng My Way', 'Waiter', 'May-ari', 'Bouncer', 'Manunuod', 'Nagpapa-request', 'Nagbabayad ng bill'] },
  { name: 'Karinderya',          emoji: '🍚', roles: ['Kusinera', 'Tagasilbi', 'Regular na kostumer', 'Tricycle driver', 'Nagbabantay ng kaldero', 'Naghuhugas', 'Nakikitawad'] },
  { name: 'Basketball Court',    emoji: '🏀', roles: ['Point guard', 'Referee', 'Coach', 'Manunuod', 'Announcer', 'Water boy', 'Tambay sa gilid'] },
  { name: 'Beach Resort',        emoji: '🌴', roles: ['Resort staff', 'Banana boat driver', 'Turista', 'Lifeguard', 'Cook sa grill', 'Massage lady', 'Tour guide'] }
];

export const LOCATIONS = [...CLASSIC, ...PINOY];

/** Spies scale gently, one for a small table, more once the room is loud. */
export function spyCount(n) {
  if (n <= 8) return 1;
  if (n <= 13) return 2;
  return 3;
}

export function preview(n) {
  const players = Math.max(n, meta.min);
  const spies = spyCount(players);
  return [
    { className: 'chip-spy', label: `🕵️ ${spies} Spy${spies > 1 ? 's' : ''}` },
    { className: 'chip-place', label: `📍 ${players - spies} at the location` },
    { className: 'chip-villager', label: `🗺️ ${LOCATIONS.length} possible places` }
  ];
}

export function inPlay(players) {
  const spies = players.filter((p) => p.spy).length;
  const rest = players.filter((p) => p.place).length;
  return [
    { className: 'chip-spy', label: `🕵️ ${spies} Spy${spies > 1 ? 's' : ''}` },
    { className: 'chip-place', label: `📍 ${rest} at the location` }
  ];
}

/**
 * Deal. The location is written onto each non-spy's own record rather than
 * the room root, so a spy poking at their own data learns nothing.
 */
export function deal(players) {
  const place = pick(LOCATIONS);
  const jobs = shuffle(place.roles);
  const order = shuffle(players.map((p) => p.id));
  const spies = new Set(order.slice(0, spyCount(players.length)));

  const patch = { location: null }; // cleared until the round is revealed
  let jobIndex = 0;

  for (const p of players) {
    const base = `players/${p.id}`;
    patch[`${base}/role`] = null;
    if (spies.has(p.id)) {
      patch[`${base}/spy`] = true;
      patch[`${base}/place`] = null;
      patch[`${base}/job`] = null;
    } else {
      patch[`${base}/spy`] = null;
      patch[`${base}/place`] = place.name;
      patch[`${base}/job`] = jobs[jobIndex++ % jobs.length];
    }
  }
  return patch;
}

export function clear(players) {
  const patch = { location: null, timerEndsAt: null };
  for (const p of players) {
    patch[`players/${p.id}/spy`] = null;
    patch[`players/${p.id}/place`] = null;
    patch[`players/${p.id}/job`] = null;
  }
  return patch;
}

/** Where this round is set, read off whichever player is not a spy. */
export function locationOf(players) {
  return players.find((p) => p.place)?.place || null;
}

export function lookup(name) {
  return LOCATIONS.find((l) => l.name === name);
}

/* Shown on the How to play screen, for people who have never played. */
export const howto = {
  goal: 'Everyone is at the same place and has a job there. Everyone except the spy, who has no idea where they are. The spy is trying to work out the location. Everyone else is trying to work out who the spy is.',
  sections: [
    { icon: '📱', title: 'Look at your card',
      body: 'Open the chest on your own phone. If it names a place, that is where you are and what you do there. If it says Spy, you get nothing and you have to fake it.' },
    { icon: '💬', title: 'Take turns asking questions',
      body: 'The host starts the timer. Somebody asks anyone a question about the place, like "what are you wearing right now?" or "would you bring a kid here?" That person answers, then they get to ask the next question, to anybody they like.' },
    { icon: '🎭', title: 'The whole trick',
      body: 'Answer so the others can tell you belong, but stay vague enough that the spy cannot figure out where you are. The spy has to bluff their answers while listening hard for clues.' },
    { icon: '🗺️', title: 'The location list',
      body: 'Every player can open the full list of places from their reveal screen and cross off the ones that no longer fit. It is private to your phone, so nobody sees what you have ruled out.' },
    { icon: '🚨', title: 'Ending the round',
      body: 'Anyone can accuse another player, but every remaining player has to agree before the vote counts. At any moment the spy can stop everything and name the location.' }
  ],
  win: [
    { who: '🕵️ The spy wins', how: 'by naming the location correctly, or by surviving until the timer runs out.' },
    { who: '📍 Everyone else wins', how: 'by getting the group to vote out the spy.' }
  ],
  tip: 'A question that is too easy helps the spy. A question that is too clever makes you look like the spy. Somewhere in between is where the game lives.'
};

export const stepsTitle = 'How a round goes';
export const steps = [
  '<b>Start the timer</b>, then pick someone to ask first.',
  '<b>Ask one question</b> about the place: "what are you wearing?", "would you bring a kid here?"',
  'They answer, then <b>they ask the next person</b>. Round and round.',
  '<b>Anyone can accuse</b>, but everyone else has to agree before the vote counts.',
  '<b>The spy can guess</b> the location at any moment to end the round.'
];

export const winNote = 'Town wins by voting out the spy. The spy wins by guessing the location, or by surviving until time runs out.';

export function card(me) {
  if (me.spy) {
    return {
      rarity: 'LEGENDARY',
      emoji: '🕵️',
      title: 'Spy',
      desc: 'You have no idea where everyone else is. Ask questions, sound like you belong, and work it out before they catch you.',
      team: 'You are alone',
      color: '#7562DE',
      deep: '#4B43A8',
      extra: 'Guess the location any time to end the round. <b>Get it right and you win.</b>'
    };
  }

  if (!me.place) return null;
  const place = lookup(me.place);

  return {
    rarity: 'LOCATION',
    emoji: place?.emoji || '📍',
    title: me.place,
    desc: 'Answer questions like you really work here, but not so clearly that the spy figures it out.',
    team: `You are the ${me.job}`,
    color: '#2E96DC',
    deep: '#1F79BC',
    extra: null
  };
}
