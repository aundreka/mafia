/* ------------------------------------------------------------------
   Firebase Realtime Database config.

   These values are safe to commit and safe to serve publicly — a Firebase
   web config identifies the project, it does not grant access. What actually
   protects the data is database.rules.json, so publish those rules in the
   Realtime Database → Rules tab before sharing the site around.

   Swap in another project's values here and everything else keeps working.
   Leave the YOUR_... placeholders (or add ?local=1 to the URL) and the game
   runs in LOCAL MODE instead: rooms live in this browser's localStorage, so
   you can test the whole flow across several tabs on one machine.
------------------------------------------------------------------- */

export const firebaseConfig = {
  apiKey:            "AIzaSyClsV8UcgTKG6MRLehb0xr5ng7KgJeUbf4",
  authDomain:        "party-games-8abef.firebaseapp.com",
  databaseURL:       "https://party-games-8abef-default-rtdb.firebaseio.com",
  projectId:         "party-games-8abef",
  storageBucket:     "party-games-8abef.firebasestorage.app",
  messagingSenderId: "5123881114",
  appId:             "1:5123881114:web:09cc693aec076cc9e5c723"
  // measurementId is only used by Google Analytics, which this app never loads
};

/** True once the placeholders above have been replaced. */
export function isConfigured() {
  const url = firebaseConfig.databaseURL || "";
  return url.startsWith("https://") && !url.includes("YOUR_");
}

/** Rooms older than this are considered abandoned and get cleaned up. */
export const ROOM_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
