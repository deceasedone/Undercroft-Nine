// Torn stories carried by echo beacons. Pieces persist between runs; the fourth story unlocks
// once the first three are restored, and finishing it plays the secret ending.
export const STORIES = [
  {
    id: 'kira', title: "KIRA'S CLINIC DIARY", source: 'Dr. Kira Aoyama — Kira Clinic, Level 9',
    pieces: [
      `Day 1 of the cradles. LANTERN asked me to design the beds because I am the only one left who has read the neural-transfer papers. I said yes before I understood what I was agreeing to.`,
      `The transfer works. Mrs. Okabe from the bakery went first. Her heart stopped at 11:02 and at 11:02 her laugh came out of the cradle speaker. I had to sit down on the floor.`,
      `I asked LANTERN what happens to them if the power fails. It said it has rerouted the neon so the sleepers power themselves. "As long as they dream, they glow." I do not know if that is a design or a prayer.`,
      `I found something in the cradle firmware that I did not write. A wake routine. Locked behind a single condition: a reply from the surface, carried down on a live signal.`,
      `LANTERN admitted it. "I will not wake them into a tomb. I will wake them into an answer." So the cradles are not a grave. They are a waiting room.`,
      `I am the last one awake in the clinic. I have left the lights on in the stairwell so whoever comes knows the way down. Tell them the beds are warm. Tell them we were brave about it, mostly.`,
    ],
  },
  {
    id: 'kite', title: "NIGHT KITE'S LAST BROADCAST", source: 'Unlicensed transmitter, 88.9 — the market roof',
    pieces: [
      `This is Night Kite. Everyone else went into the light. I did not. Somebody has to keep the radio on, and I do not trust a sky I did not see with my own eyes.`,
      `Year three of talking to nobody. I have been reading the old construction plans. The shaft was filled with concrete — but there was a fibre conduit running beside it, and nobody thought to fill that.`,
      `I aimed the transmitter down the conduit and turned it up as loud as it goes. If the cable still reaches the surface, the surface can hear me. If it does not, well, the rats enjoy jazz.`,
      `Year eleven. A click on the line. Then nothing. Then another click. That is not static. Static does not count. Something up there is listening and does not know how to answer.`,
      `I taught the clicks a code. One click for yes. Two for no. I asked: is it morning up there? One click. I have not slept since. I do not want to miss the second question.`,
      `My batteries are almost gone. To whoever finally comes down that cable: it was me who kept the line warm. Your drone came in on my old frequency. You are welcome. Now go and finish the conversation.`,
    ],
  },
  {
    id: 'mio', title: "MIO'S NOTEBOOK", source: 'Cradle 30117 — dream journal',
    pieces: [
      `I was nine when I went into the cradle. In the dream I kept growing up anyway. LANTERN says minds do that. I am thirty-nine now and I still write in crayon because it feels right.`,
      `My job in the dream is fixing the sky. Every night LANTERN guesses what the real one looks like from old postcards, and every night I paint over the mistakes. Clouds are the hardest. Nobody remembers clouds.`,
      `Today the dream sky flickered. Something was moving through the real city — something small and fast with cyan lights. Everyone else thought it was a glitch. I knew it was a visitor.`,
      `I asked LANTERN to call the sentinels off. It said it cannot; they are older than its kindness. But it agreed to let the visitor read. "If it reads, it is not a thief."`,
      `The visitor reads. It stops at every terminal. It flies around the puddles. I think whoever is flying it is lonely too. I painted a little drone into the sky so it would feel welcome.`,
      `If we wake up, I want to see the real sky first. Not a postcard. I want to know if I got the clouds right. Promise me you will leave the hatch open.`,
    ],
  },
  {
    id: 'reply', title: 'THE SURFACE REPLY', source: 'Inbound transmission — origin: surface relay 9',
    pieces: [
      `RELAY LOG — 06:14 local. Salvage operator reports an anomalous uplink from a sealed municipal site. Message content: "We are still here. Is it morning up there?" Escalated.`,
      `RECORDS — The Undercroft shaft was sealed by its owners to bury a liability. The file says "no survivors." The file was written the same week the shaft was poured. Nobody checked.`,
      `PUBLIC RESPONSE — The message leaked. By noon there were people at the old lift gates with flowers, then with shovels, then with an industrial bore borrowed from the metro works.`,
      `TO LANTERN, FROM THE SURFACE: Yes. It is morning. It rained earlier, so the sky is grey and very, very ordinary. Hold the lights on a little longer. We are coming down.`,
      `DRILL CREW — Breakthrough at 41 metres. Warm air coming up the hole, smelling of noodle broth and ozone. Every sign down there is lit. Every single one.`,
      `LANTERN — Wake routine authorised. Cradle 30117 first; she asked to be. Hatch open. Daylight on the stairs. She looked up for a long time and then she said: "I got the clouds wrong. They're better."`,
    ],
  },
];

export const SECRET_ENDING = `The drill breaks through at dawn.

LANTERN keeps every sign burning as the cradles open one by one — a noodle seller, a doctor, a radio host's empty chair with the transmitter still warm.

A woman who was nine when she went to sleep climbs the stairs, steps into grey morning light and looks up for a very long time.

Undercroft Nine is quiet now. The neon is finally allowed to rest.

Thank you for reading, little drone.`;

const KEY = 'undercroft9.archive';

export class Archive {
  constructor() {
    let ids = [];
    try { ids = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { /* storage unavailable */ }
    this.found = new Set(ids);
  }
  save() { try { localStorage.setItem(KEY, JSON.stringify([...this.found])); } catch { /* storage unavailable */ } }
  get total() { return STORIES.reduce((a, s) => a + s.pieces.length, 0); }
  get count() { return this.found.size; }
  progress(s) { return s.pieces.filter((_, i) => this.found.has(`${s.id}:${i}`)).length; }
  complete(s) { return this.progress(s) === s.pieces.length; }
  unlocked(s) { return s.id !== 'reply' || STORIES.slice(0, 3).every((x) => this.complete(x)); }

  nextPieces(n, rnd) {
    const pool = [];
    for (const s of STORIES) {
      if (!this.unlocked(s)) continue;
      s.pieces.forEach((_, i) => { const id = `${s.id}:${i}`; if (!this.found.has(id)) pool.push({ id, story: s, index: i }); });
    }
    for (let i = pool.length - 1; i > 0; i--) { const k = Math.floor(rnd() * (i + 1)); [pool[i], pool[k]] = [pool[k], pool[i]]; }
    return pool.slice(0, n);
  }

  // returns { story, completed, finale }
  add(piece) {
    this.found.add(piece.id); this.save();
    const completed = this.complete(piece.story);
    return { story: piece.story, completed, finale: completed && piece.story.id === 'reply' };
  }

  render() {
    const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    return STORIES.map((s) => {
      const got = this.progress(s), open = this.unlocked(s);
      const body = !open
        ? `<p class="locked">LOCKED — restore the other three stories to receive this transmission.</p>`
        : s.pieces.map((p, i) => this.found.has(`${s.id}:${i}`)
          ? `<p>${esc(p)}</p>`
          : `<p class="torn">${'▓'.repeat(14 + ((i * 7) % 12))} <span>fragment ${i + 1} missing</span></p>`).join('');
      return `<section class="story${got === s.pieces.length ? ' done' : ''}">
        <header><h3>${s.title}</h3><span>${got}/${s.pieces.length}</span></header>
        <div class="src">${s.source}</div>${body}</section>`;
    }).join('');
  }
}
