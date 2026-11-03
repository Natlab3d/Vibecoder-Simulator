// Headless career simulator: runs bot players through the real engine and prints one balance table.
// Usage: npx tsx Tools/Simulate.ts [seeds] [months]
import {
  acceptOffer, advance, answerEvent, buyCredits, buyGear, calendar, closeStatement, createGame, deliver, deliverBlock,
  enroll, highestTier, isTimeRunning, MONTH, HOUR, previewBuild, previewFix, rating, setPlan, startBreak, startBuild,
  startCoffee, startDayOff, startEat, startFix, startHandcode, startHandfix, startNap, startPlan, startSleep, startStudy,
  startTest, startWait, STEP, testBlock, testPlan, handMinutes, handTasks, tierUnlocked, tokenStatus, DAY,
} from '../src/game/Engine';
import { COURSES, CREDIT_PACK, DAY_OFF_ACTIVITIES, PLANS, TIER_INFO } from '../src/game/Content';
import { BackgroundId, GameState, ModelId, PlanId, Project, Tier } from '../src/game/types';

type Policy = (g: GameState) => boolean;

const urgent = (g: GameState, p: Project, days: number) => p.deadlineAt - g.minute < days * DAY;
const byDeadline = (g: GameState) => [...g.projects].sort((a, b) => a.deadlineAt - b.deadlineAt);
const contracts = (g: GameState) => g.projects.filter((p) => p.kind === 'contract');

function eatIfNeeded(g: GameState, energyFloor: number) {
  const { hour } = calendar(g.minute);
  if (g.mealsToday === 0 && hour >= 12 && hour <= 15) return startEat(g).ok;
  if (g.mealsToday === 1 && hour >= 18 && hour <= 21) return startEat(g).ok;
  if (g.energy < energyFloor) {
    if (g.mealsToday < 3 && hour >= 7) return startEat(g).ok;
    if (g.coffeesToday < 3) return startCoffee(g).ok;
    return startNap(g).ok;
  }
  return false;
}

function shop(g: GameState) {
  const order: PlanId[] = ['free', 'pro', 'max', 'ultra'];
  const next = order[order.indexOf(g.plan) + 1];
  const tight = g.weeklyUsed >= PLANS[g.plan].weekly * 0.7;
  if (next && tight && g.cash >= PLANS[next].price * 2 + 350) setPlan(g, next);
  if (!g.coursesDone.includes('prompt_101') && !g.coursesEnrolled.includes('prompt_101') && g.cash >= 160 + 350) enroll(g, 'prompt_101');
  const nextTier = COURSES.find((c) => c.unlocksTier && !g.coursesDone.includes(c.id) && !g.coursesEnrolled.includes(c.id));
  if (nextTier && g.reputation >= TIER_INFO[nextTier.unlocksTier as Tier].rep * 0.5 && g.cash >= nextTier.cost + 350) enroll(g, nextTier.id);
  if (g.cash >= 1200 && !g.gear.includes('chair')) buyGear(g, 'chair');
  if (g.cash >= 1500 && !g.gear.includes('espresso')) buyGear(g, 'espresso');
  if (g.cash >= 1800 && !g.gear.includes('monitor')) buyGear(g, 'monitor');
  if (g.cash >= 2500 && !g.gear.includes('mattress')) buyGear(g, 'mattress');
  if (g.cash >= 3500 && !g.gear.includes('workstation')) buyGear(g, 'workstation');
  const sideCourse = COURSES.find((c) => !c.unlocksTier && !g.coursesDone.includes(c.id) && !g.coursesEnrolled.includes(c.id));
  if (sideCourse && g.cash >= sideCourse.cost + 1500) enroll(g, sideCourse.id);
}

function pickOffer(g: GameState) {
  const usable = g.offers.filter((o) => tierUnlocked(g, o.tier));
  usable.sort((a, b) => b.fee / b.tasks - a.fee / a.tasks);
  return usable[0];
}

const enoughEnergy = (g: GameState, minutes: number, rate: number) => g.energy >= (minutes / HOUR) * rate + 12;

function workProject(g: GameState, p: Project, model: ModelId, useTests: boolean, useSpec: boolean, handFallback: boolean, guard = false): boolean {
  const remaining = p.tasksTotal - p.tasksDone - p.tasksInFlight;
  if (remaining > 0) {
    if (useSpec && p.specTasks === 0 && remaining >= 3 && startPlan(g, p.id).ok) return true;
    const batch = p.tier >= 2 ? 'large' : 'medium';
    const preview = previewBuild(g, p, model, batch);
    if (preview.ok && preview.shortBy === 0) return startBuild(g, p.id, model, batch).ok;
    if (preview.shortBy > 0) g.tally.tokenBlocks += 1;
    const small = previewBuild(g, p, 'spark', 'small');
    if (preview.shortBy > 0 && small.ok && urgent(g, p, 2)) return startBuild(g, p.id, 'spark', 'small').ok;
    if (preview.shortBy > 0 && (urgent(g, p, 1.5) || g.cash > 1200) && g.cash > 200) {
      for (let i = 0; i < 12 && previewBuild(g, p, model, batch).shortBy > 0 && g.cash > 200; i++) buyCredits(g);
      if (previewBuild(g, p, model, batch).ok) return startBuild(g, p.id, model, batch).ok;
    }
    if (handFallback && preview.shortBy > 0 && (!guard || enoughEnergy(g, handMinutes(g, handTasks(g, p)), 14)) && startHandcode(g, p.id).ok) return true;
    if (preview.ok) return startBuild(g, p.id, model, batch).ok;
    return false;
  }
  if (deliverBlock(p)) return false;
  if (useTests && p.knownBugs > 0) {
    const fix = previewFix(g, p, model);
    if (fix.ok && fix.shortBy === 0) return startFix(g, p.id, model).ok;
    if (fix.shortBy > 0 && (urgent(g, p, 1.5) || g.cash > 1200) && g.cash > 200) {
      for (let i = 0; i < 8 && previewFix(g, p, model).shortBy > 0 && g.cash > 200; i++) buyCredits(g);
      if (previewFix(g, p, model).ok) return startFix(g, p.id, model).ok;
    }
    if (handFallback && startHandfix(g, p.id).ok) return true;
    return false;
  }
  if (useTests && (!p.testedSinceChange || (p.lastTestFound ?? 0) > 0)) {
    if (!testBlock(g, p) && (!guard || enoughEnergy(g, testPlan(g, p).minutes, 10))) return startTest(g, p.id).ok;
    return false;
  }
  deliver(g, p.id);
  return true;
}

const careful = (maxHoursDay: number, weekends: boolean, floor: number, handFallback = true): Policy => (g) => {
  const { hour, isWeekend } = calendar(g.minute);
  const anyUrgent = g.projects.some((p) => urgent(g, p, 2));
  if (hour >= 22 || hour < 7) return startSleep(g).ok;
  if (eatIfNeeded(g, floor)) return true;
  shop(g);
  if (g.agents.some((a) => a.stalled) && g.cash > 200 && (g.cash > 1200 || g.projects.some((p) => urgent(g, p, 1.5)))) buyCredits(g);
  const restDay = (weekends && isWeekend && !anyUrgent) || g.burnout >= 65;
  if (restDay) { const act = [...DAY_OFF_ACTIVITIES].reverse().find((a) => (g.cash - a.price >= 300 || a.price === 0) && g.burnout >= a.burnoutRelief * 0.7) ?? DAY_OFF_ACTIVITIES[0]; return g.agents.length ? startBreak(g).ok : startDayOff(g, act.id).ok; }
  if (g.workToday >= maxHoursDay * HOUR && !anyUrgent) return g.agents.length ? startBreak(g).ok : startSleep(g).ok;

  if (contracts(g).length < (PLANS[g.plan].agents > 1 ? 3 : 2)) {
    const offer = pickOffer(g);
    if (offer) acceptOffer(g, offer.id, Math.min(1, offer.approaches.length - 1));
  }
  for (const p of byDeadline(g)) if (workProject(g, p, 'core', true, true, handFallback, true)) return true;
  const studying = g.coursesEnrolled[0];
  if (studying && startStudy(g, studying).ok) return true;
  if (g.agents.length) return startBreak(g).ok;
  if (tokenStatus(g).sessionResetIn) return startWait(g).ok;
  return startSleep(g).ok;
};

const overworker: Policy = (g) => {
  const { hour } = calendar(g.minute);
  if (g.energy < 14) return g.mealsToday < 3 ? startEat(g).ok : startSleep(g).ok;
  shop(g);
  if (contracts(g).length < 3) {
    const offer = pickOffer(g);
    if (offer) acceptOffer(g, offer.id, 0);
  }
  for (const p of byDeadline(g)) if (workProject(g, p, 'core', true, false, true)) return true;
  if (g.coursesEnrolled[0] && startStudy(g, g.coursesEnrolled[0]).ok) return true;
  if (g.agents.length) return startBreak(g).ok;
  if (tokenStatus(g).sessionResetIn) return startWait(g).ok;
  return hour > 20 ? startSleep(g).ok : startNap(g).ok;
};

const spammer: Policy = (g) => {
  if (g.energy < 15) return startSleep(g).ok;
  if (contracts(g).length < 3) {
    const offer = pickOffer(g);
    if (offer) acceptOffer(g, offer.id, 0);
  }
  for (const p of byDeadline(g)) {
    if (p.knownBugs > 0 && startFix(g, p.id, 'spark').ok) return true;
    const remaining = p.tasksTotal - p.tasksDone - p.tasksInFlight;
    if (remaining > 0 && startBuild(g, p.id, 'spark', 'large').ok) return true;
    if (!deliverBlock(p) && p.knownBugs === 0) {
      deliver(g, p.id);
      return true;
    }
  }
  if (g.agents.length) return startBreak(g).ok;
  if (tokenStatus(g).sessionResetIn) return startWait(g).ok;
  return startSleep(g).ok;
};

const handOnly: Policy = (g) => {
  const { hour } = calendar(g.minute);
  if (hour >= 22 || hour < 7) return startSleep(g).ok;
  if (eatIfNeeded(g, 30)) return true;
  if (g.workToday >= 9 * HOUR) return startSleep(g).ok;
  if (contracts(g).length < 1) {
    const offer = pickOffer(g);
    if (offer) acceptOffer(g, offer.id, Math.min(1, offer.approaches.length - 1));
  }
  for (const p of byDeadline(g)) {
    const remaining = p.tasksTotal - p.tasksDone - p.tasksInFlight;
    if (remaining > 0 && startHandcode(g, p.id).ok) return true;
    if (p.knownBugs > 0 && startHandfix(g, p.id).ok) return true;
    if (!deliverBlock(p)) {
      if (!p.testedSinceChange && startTest(g, p.id).ok) return true;
      deliver(g, p.id);
      return true;
    }
  }
  return startNap(g).ok;
};

const idle: Policy = (g) => startSleep(g).ok;

interface Result {
  ending: string;
  months: number;
  winMonth: number | null;
  tierMonth: Record<number, number>;
  earnedBy6: number;
  earned: number;
  stars: number;
  workPerWeek: number;
  tokensPerWeek: number;
  cappedShare: number;
  revisions: number;
  cancelled: number;
  shipped: number;
  credits: number;
  burnouts: number;
  passouts: number;
  plan: string;
  blocksPerWeek: number;
  minCash3: number;
  debt3: boolean;
}

function runCareer(policy: Policy, seed: number, background: BackgroundId, maxMonths: number): Result {
  const g = createGame('Bot', background, seed);
  const tierMonth: Record<number, number> = {};
  let earnedBy6 = 0;
  let winMonth: number | null = null;
  let minCash3 = g.cash;
  let debt3 = false;
  const limit = maxMonths * MONTH;
  let guard = 0;
  while (g.minute < limit && guard++ < 2_000_000) {
    g.fx.length = 0;
    if (g.ending && g.ending !== 'architect') break;
    if (g.ending === 'architect' && !g.endingSeen) {
      g.endingSeen = true;
      winMonth = g.minute / MONTH;
      break;
    }
    if (g.pendingStatement) {
      closeStatement(g);
      continue;
    }
    if (g.pendingEvent) {
      answerEvent(g, g.pendingEvent.kind !== 'scope');
      continue;
    }
    if (!g.human) policy(g);
    if (!g.human && !isTimeRunning(g) && !g.pendingEvent && !g.pendingStatement) startSleep(g);
    advance(g, STEP);
    const t = highestTier(g);
    for (let k = 2; k <= t; k++) if (!(k in tierMonth)) tierMonth[k] = g.minute / MONTH;
    if (g.minute <= 6 * MONTH) earnedBy6 = g.tally.fees;
    if (g.minute <= 3 * MONTH) {
      minCash3 = Math.min(minCash3, g.cash);
      if (g.debt > 0) debt3 = true;
    }
  }
  return {
    ending: g.ending ?? 'alive',
    months: g.minute / MONTH,
    winMonth,
    tierMonth,
    earnedBy6,
    earned: g.tally.fees,
    stars: rating(g),
    workPerWeek: g.tally.workMinutes / HOUR / Math.max(1, g.minute / (7 * DAY)),
    tokensPerWeek: g.tally.tokens / Math.max(1, g.minute / (7 * DAY)),
    cappedShare: g.tally.weeks ? g.tally.weeksCapped / g.tally.weeks : 0,
    revisions: g.tally.revisions,
    cancelled: g.tally.cancelled,
    shipped: g.shipped,
    credits: g.tally.creditsBought * (CREDIT_PACK.price / CREDIT_PACK.tokens),
    burnouts: g.tally.burnouts,
    passouts: g.tally.passouts,
    plan: g.plan,
    blocksPerWeek: g.tally.tokenBlocks / Math.max(1, g.minute / (7 * DAY)),
    minCash3,
    debt3,
  };
}

const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const med = (a: number[]) => {
  if (!a.length) return NaN;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
};
const pct = (n: number, d: number) => `${Math.round((n / d) * 100)}%`;
const f1 = (n: number) => (Number.isNaN(n) ? '-' : n.toFixed(1));

const seeds = Number(process.argv[2] ?? 40);
const months = Number(process.argv[3] ?? 24);

const bots: { name: string; policy: Policy; bg: BackgroundId }[] = [
  { name: 'Careful dev', policy: careful(8.5, true, 30), bg: 'developer' },
  { name: 'Careful mktr', policy: careful(8.5, true, 30), bg: 'marketer' },
  { name: 'Careful stud', policy: careful(8.5, true, 30), bg: 'student' },
  { name: 'Overworker', policy: overworker, bg: 'developer' },
  { name: 'Spammer', policy: spammer, bg: 'developer' },
  { name: 'Hand only', policy: handOnly, bg: 'developer' },
  { name: 'Idle', policy: idle, bg: 'developer' },
];

const header = ['bot', 'alive', 'bank', 'burn', 'win', 'winMo', 'T2mo', 'T3mo', 'T4mo', 'T5mo', '$6mo', '$total', 'stars', 'h/wk', 'tok/wk', 'cap%', 'rev', 'canc', 'ship', 'cred$', 'brn', 'pass', 'endMo', 'blk/wk', 'min$3m', 'debt3m'];
const rows: string[][] = [header];
for (const bot of bots) {
  const results = Array.from({ length: seeds }, (_, i) => runCareer(bot.policy, 1000 + i * 37, bot.bg, months));
  const tier = (k: number) => f1(med(results.filter((r) => k in r.tierMonth).map((r) => r.tierMonth[k])));
  rows.push([
    bot.name,
    pct(results.filter((r) => r.ending === 'alive').length, seeds),
    pct(results.filter((r) => r.ending === 'bankrupt').length, seeds),
    pct(results.filter((r) => r.ending === 'burnout').length, seeds),
    pct(results.filter((r) => r.winMonth !== null).length, seeds),
    f1(med(results.filter((r) => r.winMonth !== null).map((r) => r.winMonth!))),
    tier(2), tier(3), tier(4), tier(5),
    String(Math.round(med(results.map((r) => r.earnedBy6)))),
    String(Math.round(med(results.map((r) => r.earned)))),
    avg(results.map((r) => r.stars)).toFixed(2),
    f1(avg(results.map((r) => r.workPerWeek))),
    String(Math.round(avg(results.map((r) => r.tokensPerWeek)))),
    pct(avg(results.map((r) => r.cappedShare)), 1),
    f1(avg(results.map((r) => r.revisions))),
    f1(avg(results.map((r) => r.cancelled))),
    f1(avg(results.map((r) => r.shipped))),
    String(Math.round(avg(results.map((r) => r.credits)))),
    f1(avg(results.map((r) => r.burnouts))),
    f1(avg(results.map((r) => r.passouts))),
    f1(med(results.map((r) => r.months))),
    f1(avg(results.map((r) => r.blocksPerWeek))),
    String(Math.round(med(results.map((r) => r.minCash3)))),
    pct(results.filter((r) => r.debt3).length, seeds),
  ]);
}
const widths = header.map((_, c) => Math.max(...rows.map((r) => r[c].length)));
for (const r of rows) console.log(r.map((v, c) => v.padEnd(widths[c])).join(' '));
