# 🎉 Party Night — Mafia & Spyfall

Two cute party games sharing one room system. The host makes a room, everyone
joins with a four-letter code on their own phone, and each player opens a
treasure chest to find their secret role.

Pure static site — HTML, CSS and ES modules, no build step. Room state lives in
Firebase Realtime Database (free tier is plenty).

---

## 🎭 Mafia

Secret killers hiding in a sleepy town. **4–20 players.**

| Players | 🎭 Mafia | 💉 Doctor | 🔍 Detective | 🌻 Villager |
|---------|---------|-----------|--------------|-------------|
| 4–7     | 1 | 1 | 1 | 1–4 |
| 8–11    | 2 | 1 | 1 | 4–7 |
| 12      | 3 | 1 | 1 | 7 |
| 13–14   | 3 | 2 | 1 | 7–8 |
| 15      | 3 | 2 | 2 | 8 |
| 16–19   | 4 | 2 | 2 | 8–11 |
| 20      | 5 | 2 | 2 | 11 |

Mafia grow at roughly one per four players, and the town always keeps the
majority. Mafia players see each other's names on their card.

## 🕵️ Spyfall

Everyone shares a location except the spies, who have to work out where they
are before the room works out who they are. **3–20 players.**

| Players | 🕵️ Spies |
|---------|----------|
| 3–8     | 1 |
| 9–13    | 2 |
| 14–20   | 3 |

Non-spies get the location **plus a job there** ("Palengke — you are the
Tindera ng isda"). Spies get nothing but the hot seat. 28 locations across two
packs: 20 classic and 8 Pinoy (Palengke, Jeepney Terminal, Sari-sari Store,
Barangay Fiesta, Videoke Bar, Karinderya, Basketball Court, Beach Resort).
Delete either the `CLASSIC` or `PINOY` array in [js/spyfall.js](js/spyfall.js)
to drop that pack — nothing else refers to them.

Extras: a synced round timer (6/8/10 min, host-controlled), a tap-to-cross-off
location sheet on every player's phone, and a **Reveal the location** button
for the end of the round.

**One deliberate design choice:** the location is written onto each non-spy's
own player record, never the room root — so a spy poking at their own data
learns nothing. The host's Game Master panel hides it too, otherwise a host who
drew Spy could just read it off their own screen.

---

## Running it locally

Because it uses ES modules, open it through a server rather than `file://`:

```bash
python3 -m http.server 8080
# → http://localhost:8080
```

With no Firebase keys it runs in **local test mode** — rooms live in
`localStorage` and sync between tabs, and each tab counts as a separate player.
Open four fresh tabs and you can play a whole round on one machine. A banner at
the top tells you when you're in it.

## Hooking up Firebase

**Firebase is genuinely free for this.** The Spark plan costs ₱0 and asks for
no credit card. What trips people into a payment prompt is **Cloud Storage**
and **Cloud Functions**, which now sit behind the paid Blaze plan — this app
touches neither, so skip those two products entirely and you will never see an
upgrade screen.

1. Go to [console.firebase.google.com](https://console.firebase.google.com) →
   **Create a project**. Turn Google Analytics **off** — it just adds steps.
2. In the left sidebar: **Build → Realtime Database → Create Database.**
   - Pick a location (Singapore is closest to PH).
   - Choose **Start in locked mode**. You'll paste proper rules in step 5.
   - ⚠️ Make sure it says *Realtime Database*, **not** *Firestore*.
3. **Project settings** (⚙️ top left) **→ Your apps → Web (`</>`)**. Give it any
   nickname, skip Firebase Hosting for now, and copy the `firebaseConfig` block.
4. Paste those values into [js/config.js](js/config.js) over the `YOUR_...`
   placeholders. The local-mode banner disappears on reload.
   - Only `databaseURL` is strictly required for Realtime Database — the other
     fields matter for Auth and Analytics, which this app doesn't use. Filling
     them all in anyway keeps things clear.
5. **Realtime Database → Rules** tab → paste the contents of
   [database.rules.json](database.rules.json) → **Publish**.

**If step 5 is skipped**, the app can reach Firebase but the rules refuse to
answer. It waits 8 seconds, gives up, and drops to local mode with a red
**⚠️ OFFLINE — other phones will not see your room** banner plus a toast naming
the cause. If you ever see that banner, the fix is almost always publishing the
rules or correcting `databaseURL`.

Add `?local=1` to the URL to force local mode on purpose — useful for trying
things out without touching your real database.

Those rules keep the database usable without accounts while still stopping
anyone from vacuuming up every room: reads and writes are scoped to one room
node at a time, and you have to know a room's code to touch it.

The Firebase web API key is not a secret — it identifies your project, and the
database rules are what actually protect the data.

### Free tier limits

1 GB stored and 10 GB downloaded per month. A room is a few kilobytes and gets
deleted when the host leaves, so you would need tens of thousands of games a
month to feel it.

## Deploying

Any static host works. Upload the whole folder as-is:

- **Netlify / Vercel** — drag the folder in, no build command.
- **GitHub Pages** — push to a repo, Settings → Pages → deploy from branch.
- **Firebase Hosting** — `firebase init hosting` (public dir `.`), then `firebase deploy`.

Sharing `https://yoursite.com/#ABCD` opens the join screen with the code
already filled in.

## Files

| File | What it does |
|------|--------------|
| [index.html](index.html) | All six screens: home, join, lobby, reveal, locations, game master |
| [css/style.css](css/style.css) | The whole look — palette, chunky buttons, CSS treasure chest |
| [js/config.js](js/config.js) | Firebase keys ← **the only file you need to edit** |
| [js/store.js](js/store.js) | Room storage; Firebase and localStorage behind one API |
| [js/games.js](js/games.js) | Registry of playable games |
| [js/mafia.js](js/mafia.js) | Mafia roles, scaling table, dealing |
| [js/spyfall.js](js/spyfall.js) | Locations, spy counts, dealing |
| [js/util.js](js/util.js) | Shuffle, pick, escape |
| [js/app.js](js/app.js) | Screens, lobby sync, presence, reveal, timer |

### Adding a third game

Every game module exports the same shape, and [js/app.js](js/app.js) never
special-cases one by name (apart from showing the Spyfall timer). Copy
[js/mafia.js](js/mafia.js), implement `meta`, `preview`, `inPlay`, `deal`,
`clear`, `card`, `steps` and `stepsTitle`, then add it to the registry in
[js/games.js](js/games.js) and drop a tile into the game picker in
[index.html](index.html).
