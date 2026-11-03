# Vibecoder Simulator

A first-person freelancer sim. You are a solo developer with one AI agent, never enough tokens, and rent to pay.

## Play without installing anything

`dist/VibecoderSimulator.html` is the whole game in a single file (about 900 KB). Double-click it and play in any modern browser. No Node, no npm, no dev server and no internet connection. Progress is saved in that browser's localStorage.

To rebuild it after changing code:

```bash
npm run build:single
```

## Run it from source

Needs Node.js. No API key is needed, the game runs entirely in your browser.

```bash
npm install
npm run dev
```

Then open http://localhost:3000 in Chrome. Your career saves automatically in the browser.

## How the game works

**Time only moves when something runs.** Read and plan as long as you like. Every action shows its cost in clock time first. One game hour is 4 seconds at 1x, with 3x, 8x and pause. Sleep runs at 8x.

**A job is a process, not a button.**

1. Pick a job in the Market, and an approach: fewer tasks but riskier, or more tasks but cleaner.
2. Write a spec (your time). Covered tasks get 40% fewer bugs and use 15% fewer tokens.
3. Run the agent. Choose a model (Spark, Core, Apex) and a run size (1, 2 or 4 hours). You spend 20 minutes on the prompt, then the agent works in the background while you do something else, even while you sleep.
4. Test (your time). Agents leave hidden bugs. A test finds most of them, not all.
5. Fix with the agent, or by hand. Fixes can introduce new bugs.
6. Deliver. Below the client's quality bar they reject it. Clients pay 7 days after delivery.

**Tokens work like a real AI plan.** A 5-hour window starts on your first run, plus a weekly quota. When they run out you wait, buy credits (expensive), upgrade your plan (monthly bill), or code by hand (slow, tiring, free).

**You are limited too.** Energy drains as you work. Food, coffee, breaks and sleep restore it. Past 8 hours a day, or late at night, you build burnout. At 60% you work slower and buggier. At 100% you are off sick for 3 days. A second collapse ends your career.

**Money.** Bills arrive every 28 days. Unpaid bills become debt at 5% a month. Debt above $3,000 at month end means bankruptcy.

**Career.** Five tiers from micro-gigs to the Frontier Lab contract. Each tier needs reputation and a course. Your rating sets what clients pay. Good repeat clients may offer monthly retainers.

**Endings.** Chief AI Architect (ship the frontier job), Bankrupt, or Burned out.

## Controls

WASD walk, mouse drag look, E use, Tab or Space laptop, P pause, 1 2 3 speed.

## Project layout

- `src/game/Engine.ts` all game rules, no browser code
- `src/game/Content.ts` jobs, clients, courses, plans, gear, all balance numbers
- `src/game/threeScene.ts` the 3D room
- `src/components/` HUD, laptop tabs and modals
- `Tools/Simulate.ts` balance simulator
- `Tools/Inline.mjs` packs the build into one HTML file

## Balance simulator

Runs bot players through the real engine and prints one table.

```bash
npx tsx Tools/Simulate.ts 40 30
```

Arguments are seeds per bot and months per career. Use it after changing any number in `Content.ts`.

Latest results, 40 seeds: a careful player wins around month 12 working about 45 hours a week. An overworker burns out by about month 4.5. A button spammer earns about a sixth as much and goes bankrupt in 40% of careers. Doing nothing goes bankrupt at month 3.
