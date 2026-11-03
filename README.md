# Vibecoder Simulator

A 3D first-person freelance simulator. You are a solo prompt engineer with one AI agent, a strict token quota, and weekly rent to pay.

**[Play Online](https://natlab3d.github.io/Vibecoder-Simulator/)**

---

## Play Offline (Single File)

You can play the complete game without installing anything:
- Download or open `dist/VibecoderSimulator.html` (self-contained single-file HTML build, ~940 KB).
- Double-click to play in any modern browser (Chrome, Edge, Firefox, Safari).
- Requires no Node.js, no internet, and no dev server. Career progress saves automatically in browser local storage.

---

## Story & Overview

You start in a modest apartment with an open laptop, an espresso machine, and a free AI tier plan. Your goal: climb from micro-gigs to landing the Frontier Lab contract and becoming a **Chief AI Architect** before running out of money or burning out.

### Careers & Difficulty
- **Laid-off Developer (Easy)**: 10 years of coding experience. Fast hand-coding, high bug detection, standard market rates.
- **Marketer Turned Prompter (Medium)**: Great at talking to models with discounted token packs, but slower at hand-coding and 10% lower client rates.
- **Broke Student (Hard)**: Learns courses 15% faster, but deals with 25% slower AI runs, 20% higher token burn, and 15% lower junior contract rates.

### Core Loop
1. **Accept Contracts**: Browse the Market for gigs across 5 tiers, choosing between fast-but-risky or cautious approaches.
2. **Write Specs**: Planning before generating cuts bug rates and saves tokens.
3. **Dispatch AI Agents**: Prompt models (Spark, Core, Apex) to work in the background while you study, eat, or sleep.
4. **Test & Fix**: Agents leave bugs. Run quality assurance tests to uncover hidden bugs before the client catches them.
5. **Deliver & Get Paid**: Meet the client's quality bar to earn money, 5-star reviews, and reputation. Happy repeat clients offer monthly retainers.
6. **Survive the Bills**: Pay rent, internet, food, and AI subscription plans every 28 days.

---

## Controls

| Key | Action |
| :--- | :--- |
| **W, A, S, D** | Walk around the room |
| **Mouse Drag** | Look around |
| **E** | Interact (Laptop, Bed, Coffee Station, Front Door) |
| **Space** / **Tab** | Open or close laptop |
| **1, 2, 3** | Change simulation speed (1x, 3x, 8x) |
| **P** | Pause / Resume time |

---

## Running from Source

Requires [Node.js](https://nodejs.org/) (v18+).

```bash
# Clone the repository
git clone https://github.com/Natlab3d/Vibecoder-Simulator.git
cd Vibecoder-Simulator

# Install dependencies
npm install

# Start local dev server
npm run dev
```

Open `http://localhost:3000` in your browser.

To rebuild the single-file offline bundle:
```bash
npm run build:single
```
