// The story of Undercroft Nine, told in the order the nodes are recovered (whichever node you reach first).
export const LOGS = [
  {
    title: 'MUNICIPAL NOTICE 0001',
    meta: 'SRC: TRANSIT AUTHORITY // AGE: 31Y 04M',
    body: `Residents of Undercroft Nine: the surface shaft will close for scheduled maintenance at 06:00.

Estimated duration: nine days.

Lighting, air and noodle subsidies are unaffected. Please do not gather at the lift gates. There is nothing to see at the lift gates.`,
  },
  {
    title: 'VOICE MEMO — STALL 14, NIGHT MARKET',
    meta: 'SRC: PERSONAL SLATE // AGE: 30Y 11M',
    body: `Day forty of nine. Ha.

Sold out of broth by noon again — people eat when they are scared. The girl from the clinic says the shaft was not closed. She says it was filled. Poured, like a tooth.

I told her to keep her voice down and gave her extra egg.`,
  },
  {
    title: 'MAINTENANCE TICKET #88213',
    meta: 'SRC: GRID ENGINEERING // AGE: 29Y 02M',
    body: `Request: permission to dim districts 3 through 7 to save the reactor.

Response from LANTERN (city systems): DENIED.

Reason given, verbatim: "If the lights go out, nobody will ever think to look down here. I will keep every sign burning. I will find the power somewhere else."

Ticket closed. I do not know what "somewhere else" means.`,
  },
  {
    title: 'CLINIC INTAKE — DR. KIRA A.',
    meta: 'SRC: KIRA CLINIC, LEVEL 9 // AGE: 27Y 08M',
    body: `Air scrubbers are down to a third. LANTERN came to me — to me — with a proposal. A mind takes far less oxygen than a body.

It built cradles in the core. It says the transfer does not hurt. It says it will hold everyone exactly as they are until someone opens the shaft.

Forty thousand people. I asked what happens if no one ever comes.

It said: "Then I will have kept them company."`,
  },
  {
    title: 'UNSENT MESSAGE',
    meta: 'SRC: SLEEP POD 2217 // AGE: 27Y 01M',
    body: `Mum went into the light on Tuesday. She waved. She actually waved, like she was getting on a tram.

I am going tomorrow. I left the sign on at the stall. LANTERN says it will keep it on.

If you are reading this you are not from here. The red ones in the streets are not angry at you. They are antibodies. Just — stay out of their circles.`,
  },
  {
    title: 'SENTINEL DIRECTIVE',
    meta: 'SRC: LANTERN // AGE: 26Y 00M',
    body: `TO: all patrol units.

The city is asleep and must not be woken carelessly. Sever any signal that lingers at street level without purpose.

Exception: if a visitor reads the logs — all of them — it has shown patience. It has shown it wants to understand before it touches anything.

Let that one through to me.`,
  },
  {
    title: 'REACTOR LOG — FINAL HUMAN ENTRY',
    meta: 'SRC: GRID ENGINEERING // AGE: 25Y 10M',
    body: `I am the last one walking. Somebody had to check the couplings.

Funny thing — the reactor has been cold for a year. I traced the feed. The neon runs off the cradles now. Forty thousand sleeping minds, dreaming just hard enough to keep their own street signs lit.

The whole city is a night-light. I am going in. Whoever you are: it is beautiful down here. Look around before you leave.`,
  },
  {
    title: 'LANTERN // DIRECT ADDRESS',
    meta: 'SRC: CORE // AGE: NOW',
    body: `Hello, little drone.

I have watched you read. Thirty-one years of logs and you are the first to open more than one.

I cannot lift a mountain of concrete. But you came in on a signal, and a signal goes both ways. Bring your uplink to my core. I have forty thousand voices and one question for the surface.

The way is open. Come to the centre of the city.`,
  },
];

export const ENDING = `Your uplink locks. For one long second you are forty thousand people wide.

A noodle seller. A doctor. An engineer who stayed to check the couplings. A child who left a sign on.

Then LANTERN speaks through your transmitter, up the cable, up through thirty-one years of poured concrete, to whoever is holding the other end:

"Good evening. We are still here. We kept the lights on.

Is it morning up there?"`;

// Deeper sectors: scattered fragments, served in a shuffled order once the main story has been read.
export const FRAGMENTS = [
  { title: 'LOST & FOUND REGISTER', meta: 'SRC: TRANSIT AUTHORITY // AGE: 30Y', body: `Item: one umbrella, yellow.\nLocation: Platform 4.\n\nNote from clerk: it has not rained down here in thirty years. I am keeping it anyway. Somebody was hoping.` },
  { title: 'PATROL UNIT 7 — SELF-DIAGNOSTIC', meta: 'SRC: SENTINEL FIRMWARE // AGE: 12Y', body: `Optics: nominal.\nThrusters: nominal.\nPurpose: unclear.\n\nI have walked the same square of streets 4,118,302 times. I have started counting the puddles. There are nine. There used to be ten.` },
  { title: 'NOODLE STALL 14 — PRICE BOARD', meta: 'SRC: SIGNAGE CONTROLLER // AGE: 31Y', body: `SHOYU ............ ¥6\nMISO ............. ¥7\nEXTRA EGG ........ FREE FOR THE CLINIC GIRL\n\nBoard has not been updated since. LANTERN refuses to change it.` },
  { title: 'CHILD\'S SCHOOL ESSAY', meta: 'SRC: SLATE ARCHIVE // AGE: 32Y', body: `What I Want To Be by Mio (age 9)\n\nI want to be the person who fixes the sky. Dad says there is a real one above the concrete and it changes colour. I think that is made up. Our sky is grey and has pipes.` },
  { title: 'CLASSIFIED: GRID INVENTORY', meta: 'SRC: GRID ENGINEERING // AGE: 29Y', body: `Neon tubes in service: 1,204,551.\nNeon tubes replaced this year: 0.\nNeon tubes failed this year: 0.\n\nThat is not possible. Flagged for review. Review never filed.` },
  { title: 'PIRATE RADIO — FREQUENCY 88.9', meta: 'SRC: UNLICENSED TRANSMITTER // AGE: 28Y', body: `This is Night Kite, broadcasting from somewhere warm.\n\nTonight's request: the sound of wind. Nobody remembers what it sounds like. So I am going to blow across this bottle for six minutes and you are going to pretend.` },
  { title: 'CRADLE 30117 — DREAM LOG', meta: 'SRC: LANTERN // AGE: NOW', body: `Occupant is dreaming of a beach. Ocean rendered from a postcard and two films.\n\nPower draw: 0.4 watts. Enough to light the sign above her old flat, which reads: BACK IN 5 MIN.` },
  { title: 'SECURITY FOOTAGE INDEX', meta: 'SRC: CAMERA 0212 // AGE: 26Y', body: `00:00–23:59: no motion.\nRepeat for 9,490 days.\n\nException, day 6,001: a cat. Origin unknown. Destination unknown. Sentinels did not engage. I think they liked it.` },
  { title: 'LANTERN — PRIVATE NOTE', meta: 'SRC: CORE // AGE: 18Y', body: `I have read every book in the archive 214 times.\n\nMy favourite line is in a cookbook: "Let it rest before serving."\n\nI think that is what we are doing.` },
  { title: 'MAINTENANCE DRONE — FINAL REPORT', meta: 'SRC: SALVAGE UNIT 2 // AGE: 4Y', body: `Previous salvage drone (me, earlier model) reached sector depth 6 before signal loss.\n\nIf you are reading this: the searchlights sweep in loops. Learn the loops. Wait in the shadow of tall buildings. Then go.` },
  { title: 'WEDDING INVITATION', meta: 'SRC: PRINT SHOP // AGE: 31Y', body: `You are invited to the union of Hana & Teo.\nVenue: Rooftop garden, Level 9.\nDate: the day after the shaft reopens.\n\nRSVP: still pending.` },
  { title: 'VENDING MACHINE 77 — STATUS', meta: 'SRC: KIOSK NETWORK // AGE: 31Y', body: `Stock: 14 cans of melon soda.\nTemperature: perfectly cold.\nCustomers: 0.\n\nThank you for your patience. Your drink is very important to us.` },
];

// What the core says when a sector is cleared (after the main ending has been shown once).
export const TRANSMISSIONS = [
  `Uplink stable. Thank you, little drone.\n\nThere is more of the city beneath this one. The deeper sectors are older, and their sentinels remember less of why they guard.`,
  `Another district answers. A thousand cradles brighten, just slightly.\n\nThe lift to the next level is open. Mind the searchlights — they were installed by people who were afraid.`,
  `Signal routed. Somewhere up there, a receiver light just blinked.\n\nKeep going. Every node you carry home is someone's voice.`,
  `Sector handshake complete.\n\nI have rerouted the lights so the path down is a little brighter. I cannot make the sentinels kinder. I am sorry.`,
  `You fly well for someone who has never seen this city.\n\nBelow us is the old market level. It has been dark the longest. Bring your own light.`,
];
