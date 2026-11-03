import {
  ActionResult,
  ActivityKind,
  AgentRun,
  BackgroundId,
  BatchId,
  ClientState,
  GameEventData,
  GameState,
  GearId,
  HumanActivity,
  InternetId,
  JobTemplate,
  MessageTone,
  ModelId,
  MonthStatement,
  Offer,
  PlanId,
  Project,
  Tier,
} from './types';
import {
  BACKGROUNDS,
  BATCHES,
  CLIENTS,
  COURSES,
  CREDIT_PACK,
  DAY_OFF_ACTIVITIES,
  GEAR,
  INTERNET,
  JOBS,
  MODELS,
  PLANS,
  REVIEW_TEXT,
  SURPRISES,
  TIER_INFO,
  TITLES,
} from './Content';

export const STEP = 5;
export const HOUR = 60;
export const DAY = 1440;
export const WEEK = DAY * 7;
export const MONTH = DAY * 28;
export const SESSION_MINUTES = 5 * HOUR;
export const MAX_PROJECTS = 4;
export const MAX_RETAINERS = 3;
export const OVERDRAFT_LIMIT = 3000;
export const INTEREST_RATE = 0.05;
export const CANCEL_AFTER_DAYS = 7;
export const MIN_WORK_ENERGY = 10;
export const FOOD_BILL = 60;
export const UTILITIES_BILL = 25;

const BASE_BUG_RATE = 0.22;
const HAND_BUG_RATE = 0.12;
const PROMPT_MINUTES = 20;
const WORK_KINDS: ActivityKind[] = ['prompt', 'plan', 'test', 'handcode', 'handfix', 'study', 'meeting'];

// Energy change per hour while doing each activity
const ENERGY_RATE: Record<ActivityKind, number> = {
  prompt: -8,
  plan: -10,
  test: -10,
  handcode: -14,
  handfix: -14,
  study: -9,
  meeting: -8,
  eat: 0,
  coffee: 0,
  break: 0,
  nap: 50 / 3,
  sleep: 13,
  dayoff: 8,
  wait: -1,
  sick: 4,
};

// --- Random numbers (seeded, so a career can be replayed in the simulator) ---
function rand(g: GameState) {
  g.rng = (g.rng + 0x6d2b79f5) | 0;
  let t = g.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const between = (g: GameState, a: number, b: number) => a + rand(g) * (b - a);
const pick = <T,>(g: GameState, list: T[]) => list[Math.floor(rand(g) * list.length)];
export const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const ceilStep = (m: number) => Math.max(STEP, Math.ceil(m / STEP) * STEP);
function binomial(g: GameState, n: number, p: number) {
  let hits = 0;
  for (let i = 0; i < n; i++) if (rand(g) < p) hits++;
  return hits;
}

// --- Calendar ---
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function calendar(minute: number) {
  const dayIndex = Math.floor(minute / DAY);
  const inDay = minute % DAY;
  return {
    day: dayIndex + 1,
    weekday: WEEKDAYS[dayIndex % 7],
    weekdayShort: WEEKDAYS[dayIndex % 7].slice(0, 3),
    isWeekend: dayIndex % 7 >= 5,
    week: Math.floor(dayIndex / 7) + 1,
    weekOfMonth: Math.floor((dayIndex % 28) / 7) + 1,
    month: Math.floor(dayIndex / 28) + 1,
    hour: Math.floor(inDay / HOUR),
    minuteOfDay: inDay,
    daysToMonday: 7 - (dayIndex % 7),
  };
}

// --- Modifiers ---
const has = (g: GameState, id: GearId) => g.gear.includes(id);
const knows = (g: GameState, id: string) => g.coursesDone.includes(id);
export const energyMax = (g: GameState) => 100 - g.burnout * 0.4;
export const isWorkKind = (k: ActivityKind) => WORK_KINDS.includes(k);

function tokenMultiplier(g: GameState) {
  const bgMult = g.background === 'student' ? 1.2 : 1;
  return bgMult * (knows(g, 'gpu_kernel_tuning') ? 0.85 : 1);
}

function agentSpeedMultiplier(g: GameState) {
  return (has(g, 'workstation') ? 0.85 : 1) * (g.background === 'student' ? 1.25 : 1);
}

export function detectChance(g: GameState) {
  return clamp(0.65 + (has(g, 'monitor') ? 0.1 : 0) + (g.background === 'developer' ? 0.1 : 0) - (g.energy < 30 ? 0.2 : 0), 0.2, 0.95);
}

const tiredBugs = (g: GameState) => (g.energy < 30 ? 1.25 : 1) * (g.burnout >= 60 ? 1.3 : 1);
export const burnoutDrag = (g: GameState) => (g.burnout >= 85 ? 1.5 : g.burnout >= 60 ? 1.25 : 1);

// --- Tokens ---
export function tokenStatus(g: GameState) {
  const plan = PLANS[g.plan];
  const sessionLeft = Math.max(0, plan.session - g.sessionUsed);
  const weeklyLeft = Math.max(0, plan.weekly - g.weeklyUsed);
  const quota = Math.min(sessionLeft, weeklyLeft);
  return {
    plan,
    sessionLeft,
    weeklyLeft,
    quota,
    usable: quota + g.credits,
    sessionResetIn: g.sessionStart === null ? null : Math.max(0, g.sessionStart + SESSION_MINUTES - g.minute),
    weeklyResetIn: WEEK - (g.minute % WEEK),
  };
}

function spendTokens(g: GameState, amount: number) {
  const { quota } = tokenStatus(g);
  const fromQuota = Math.min(quota, amount);
  if (fromQuota > 0 && g.sessionStart === null) g.sessionStart = g.minute;
  g.sessionUsed += fromQuota;
  g.weeklyUsed += fromQuota;
  g.credits = Math.max(0, g.credits - (amount - fromQuota));
  g.week.tokensUsed += amount;
  g.monthTokens += amount;
  g.tally.tokens += amount;
}

// --- Messages ---
function log(g: GameState, text: string, tone: MessageTone = 'info') {
  g.inbox.unshift({ id: g.nextId++, minute: g.minute, text, tone });
  if (g.inbox.length > 80) g.inbox.pop();
  if (tone === 'warn' || tone === 'bad') g.unread = Math.min(99, g.unread + 1);
}

const clientName = (id: string) => CLIENTS[id]?.name ?? id;
const projectById = (g: GameState, id?: string) => g.projects.find((p) => p.id === id);

function ensureClient(g: GameState, id: string): ClientState {
  if (!g.clients[id]) g.clients[id] = { jobs: 0, starsTotal: 0, lastStars: 0, retainerFee: null, ticketOpen: false, retainersCompleted: 0 };
  return g.clients[id];
}

// --- Reputation & Rating ---
export function backgroundSalaryMultiplier(g: GameState): number {
  if (g.background === 'student') return 0.85;
  if (g.background === 'marketer') return 0.9;
  return 1;
}

export function rating(g: GameState) {
  if (g.reviews.length === 0) return 0;
  const recent = g.reviews.slice(0, 8);
  return recent.reduce((a, r) => a + r.stars, 0) / recent.length;
}

export function trustRating(g: GameState) {
  return rating(g);
}

export const ratingFeeMultiplier = (g: GameState) => {
  if (g.reviews.length === 0) return 1;
  return 1 + (rating(g) - 4) * 0.15;
};

function addReputation(g: GameState, delta: number) {
  g.reputation = Math.max(0, g.reputation + delta);
  if (g.title !== 'Chief AI Architect') g.title = TITLES.find((t) => g.reputation >= t.rep)!.title;
}

export const nextMonday = (minute: number) => (Math.floor(minute / WEEK) + 1) * WEEK;

export function tierUnlocked(g: GameState, tier: Tier) {
  for (let t = 1; t <= tier; t++) {
    const info = TIER_INFO[t as Tier];
    if (g.reputation < info.rep) return false;
    if (info.course && !knows(g, info.course)) return false;
  }
  return true;
}

export function highestTier(g: GameState): Tier {
  let best: Tier = 1;
  for (const t of [2, 3, 4, 5] as Tier[]) if (tierUnlocked(g, t)) best = t;
  return best;
}

function retainerRepBonus(g: GameState) {
  const cur = highestTier(g);
  const next = Math.min(5, cur + 1) as Tier;
  const step = Math.max(260, TIER_INFO[next].rep - TIER_INFO[cur].rep);
  return Math.round(step * 0.02);
}

// --- Market ---
function makeOffer(g: GameState, template: JobTemplate, rush = false): Offer {
  const tasks = Math.max(4, Math.round(template.tasks * between(g, 0.9, 1.1)));
  const repeat = (g.clients[template.clientId]?.jobs ?? 0) >= 2 ? 1.1 : 1;
  const salaryMod = backgroundSalaryMultiplier(g);
  const fee = Math.round((template.fee * between(g, 0.9, 1.15) * ratingFeeMultiplier(g) * repeat * salaryMod * (rush ? 1.5 : 1)) / 10) * 10;
  const workDays = (tasks * TIER_INFO[template.tier].taskMinutes) / HOUR / 8;
  return {
    id: `offer-${g.nextId++}`,
    templateId: template.id,
    tier: template.tier,
    title: template.title,
    clientId: template.clientId,
    description: template.description,
    complexity: template.complexity,
    fee,
    tasks,
    deadlineDays: rush ? Math.max(1, Math.ceil(workDays)) : Math.max(2, Math.ceil(workDays * 1.15) + 1),
    qualityBar: TIER_INFO[template.tier].qualityBar,
    approaches: template.approaches.map((a) => ({ ...a })),
    expiresAt: g.minute + Math.round(between(g, 6, 10)) * DAY,
    rush,
  };
}

function pickTemplate(g: GameState, tier: Tier) {
  const taken = new Set([...g.offers.map((o) => o.templateId)]);
  const open = JOBS.filter((j) => j.tier === tier);
  const fresh = open.filter((j) => !taken.has(j.id));
  return fresh.length ? pick(g, fresh) : null;
}

function rollOfferTier(g: GameState): Tier {
  const top = highestTier(g);
  const r = rand(g);
  if (r < 0.55 || top === 1) return top;
  if (r < 0.85) return (top - 1) as Tier;
  return Math.max(1, top - 2) as Tier;
}

function refillMarket(g: GameState) {
  const r = g.reviews.length === 0 ? 4 : rating(g);
  const MAX_OFFERS = r < 2 ? 1 : r < 3 ? 2 : 4;
  // Next-tier teaser (requires Academy course & rep) when rating is healthy
  const next = (highestTier(g) + 1) as Tier;
  if (r >= 3 && next <= 5 && !g.offers.some((o) => o.tier === next) && g.offers.length < MAX_OFFERS) {
    const teaser = JOBS.filter((j) => j.tier === next);
    if (teaser.length > 0) {
      g.offers.push(makeOffer(g, pick(g, teaser)));
    }
  }

  let guard = 0;
  while (g.offers.length < MAX_OFFERS && guard++ < 30) {
    const template = pickTemplate(g, rollOfferTier(g));
    if (template) {
      g.offers.push(makeOffer(g, template));
    } else {
      break;
    }
  }

  if (g.offers.length > MAX_OFFERS) {
    g.offers = g.offers.slice(0, MAX_OFFERS);
  }
}

export function acceptOffer(g: GameState, offerId: string, approachIndex: number): ActionResult {
  const offer = g.offers.find((o) => o.id === offerId);
  if (!offer) return { ok: false, reason: 'That offer is gone.' };
  if (!tierUnlocked(g, offer.tier)) {
    const info = TIER_INFO[offer.tier];
    const course = COURSES.find((c) => c.id === info.course);
    if (course && !knows(g, course.id)) {
      return { ok: false, reason: `Requires course "${course.title}" and ${info.rep} reputation.` };
    }
    return { ok: false, reason: `Requires ${info.rep} reputation (you have ${g.reputation}).` };
  }
  if (g.projects.filter((p) => p.kind === 'contract').length >= MAX_PROJECTS) {
    return { ok: false, reason: `You can only juggle ${MAX_PROJECTS} contracts at once.` };
  }
  const approach = offer.approaches[approachIndex];
  if (!approach) {
    return { ok: false, reason: 'That approach is no longer available.' };
  }
  g.projects.push({
    id: `job-${g.nextId++}`,
    offerId: offer.id,
    approachIndex,
    title: `${offer.title} (${approach.label})`,
    clientId: offer.clientId,
    tier: offer.tier,
    kind: 'contract',
    fee: offer.fee,
    complexity: offer.complexity,
    approach,
    tasksTotal: Math.max(3, Math.round(offer.tasks * approach.scope)),
    tasksDone: 0,
    tasksInFlight: 0,
    specTasks: 0,
    hiddenBugs: 0,
    estHidden: 0,
    knownBugs: 0,
    fixing: 0,
    lastTestFound: null,
    testedSinceChange: false,
    deadlineAt: g.minute + offer.deadlineDays * DAY,
    qualityBar: offer.qualityBar,
    revisions: 0,
    acceptedAt: g.minute,
  });

  // Remove the accepted approach from the offer so it cannot be accepted again
  offer.approaches.splice(approachIndex, 1);

  // If no approaches remain on this listing, remove the listing completely from market
  if (offer.approaches.length === 0) {
    g.offers = g.offers.filter((o) => o.id !== offerId);
  }

  ensureClient(g, offer.clientId);
  log(g, `Accepted "${offer.title}" (${approach.label}) for ${clientName(offer.clientId)}.`);
  g.fx.push('accept');
  return { ok: true };
}

export function offerEstimate(g: GameState, offer: Offer, approachIndex: number) {
  const info = TIER_INFO[offer.tier];
  const approach = offer.approaches[approachIndex];
  if (!approach) return { tasks: 0, agentHours: 0, tokens: 0 };
  const tasks = Math.max(3, Math.round(offer.tasks * approach.scope));
  return {
    tasks,
    agentHours: Math.round((tasks * info.taskMinutes * agentSpeedMultiplier(g)) / HOUR),
    tokens: Math.round(tasks * info.tokensPerTask * tokenMultiplier(g) * 1.2),
  };
}

// --- Previews: every action shows its price before you commit ---
export interface RunPreview {
  ok: boolean;
  reason?: string;
  amount: number;
  tokens: number;
  aiMinutes: number;
  humanMinutes: number;
  expectedBugs: number;
  bugRate: number;
  specUsed: number;
  shortBy: number;
}

function slotsUsed(g: GameState) {
  return g.agents.length + (g.human?.kind === 'prompt' ? 1 : 0);
}

function launchBlock(g: GameState, tokens: number): { reason?: string; shortBy: number } {
  const status = tokenStatus(g);
  const shortBy = Math.max(0, tokens - status.usable);
  if (g.human) return { reason: `You are busy: ${g.human.label}.`, shortBy };
  if (g.energy < MIN_WORK_ENERGY) return { reason: 'Too tired to work. Eat, rest or sleep first.', shortBy };
  if (g.outageUntil !== null) return { reason: 'The internet is down. AI runs are impossible until it returns.', shortBy };
  if (slotsUsed(g) >= status.plan.agents) return { reason: 'Your plan allows only one agent at a time.', shortBy };
  if (status.usable <= 0) return { reason: 'No tokens left.', shortBy };
  return { shortBy };
}

export function previewBuild(g: GameState, p: Project, modelId: ModelId, batchId: BatchId): RunPreview {
  const model = MODELS[modelId];
  const batch = BATCHES[batchId];
  const info = TIER_INFO[p.tier];
  const remaining = p.tasksTotal - p.tasksDone - p.tasksInFlight;
  const amount = Math.min(remaining, Math.max(1, Math.round((batch.hours * HOUR) / (info.taskMinutes * model.time))));
  const specUsed = Math.min(p.specTasks, amount);
  const specShare = amount > 0 ? specUsed / amount : 0;
  const courseBugs = knows(g, 'prompt_101') ? 0.85 : 1;
  const bugRate = clamp(
    BASE_BUG_RATE * model.bugs * batch.bugs * p.approach.bugs * (1 + 0.1 * (p.complexity - 1)) * courseBugs * (1 - 0.4 * specShare) * tiredBugs(g),
    0.01,
    0.9,
  );
  const tokens = Math.round(amount * info.tokensPerTask * model.tokens * tokenMultiplier(g) * (1 - 0.15 * specShare) * 10) / 10;
  const speed = agentSpeedMultiplier(g);
  const aiMinutes = ceilStep(amount * info.taskMinutes * model.time * speed);
  const block = amount <= 0 ? { reason: 'All tasks are built or in progress.', shortBy: 0 } : launchBlock(g, tokens);
  return { ok: !block.reason, reason: block.reason, amount, tokens, aiMinutes, humanMinutes: PROMPT_MINUTES, expectedBugs: amount * bugRate, bugRate, specUsed, shortBy: block.shortBy };
}

export function previewFix(g: GameState, p: Project, modelId: ModelId): RunPreview {
  const model = MODELS[modelId];
  const info = TIER_INFO[p.tier];
  const amount = p.knownBugs;
  const tokens = Math.round(amount * info.tokensPerTask * 0.6 * model.tokens * tokenMultiplier(g) * 10) / 10;
  const speed = agentSpeedMultiplier(g);
  const aiMinutes = ceilStep(amount * info.taskMinutes * 0.5 * model.time * speed);
  const block = amount <= 0 ? { reason: 'No known bugs to fix.', shortBy: 0 } : launchBlock(g, tokens);
  return { ok: !block.reason, reason: block.reason, amount, tokens, aiMinutes, humanMinutes: PROMPT_MINUTES, expectedBugs: amount * model.regress, bugRate: model.regress, specUsed: 0, shortBy: block.shortBy };
}

function startHuman(g: GameState, kind: ActivityKind, minutes: number, label: string, extra: Partial<HumanActivity> = {}) {
  const m = ceilStep(isWorkKind(kind) ? minutes * burnoutDrag(g) : minutes);
  g.human = { kind, label, minutesTotal: m, minutesLeft: m, ...extra };
}

function launchRun(g: GameState, p: Project, type: 'build' | 'fix', modelId: ModelId, preview: RunPreview) {
  const run: AgentRun = {
    id: `run-${g.nextId++}`,
    projectId: p.id,
    type,
    model: modelId,
    amount: preview.amount,
    bugRate: preview.bugRate,
    specTasksUsed: preview.specUsed,
    minutesTotal: preview.aiMinutes,
    minutesLeft: preview.aiMinutes,
    tokens: preview.tokens,
    stalled: false,
  };
  const noun = count(preview.amount, type === 'build' ? 'task' : 'bug');
  startHuman(g, 'prompt', preview.humanMinutes, `Writing a prompt for ${noun}`, { run, projectId: p.id });
  g.tally.runs += 1;
  g.fx.push('typing');
}

export function startBuild(g: GameState, projectId: string, model: ModelId, batch: BatchId): ActionResult {
  const p = projectById(g, projectId);
  if (!p) return { ok: false, reason: 'Unknown project.' };
  const preview = previewBuild(g, p, model, batch);
  if (!preview.ok) return { ok: false, reason: preview.reason! };
  p.tasksInFlight += preview.amount;
  p.specTasks -= preview.specUsed;
  launchRun(g, p, 'build', model, preview);
  return { ok: true };
}

export function startFix(g: GameState, projectId: string, model: ModelId): ActionResult {
  const p = projectById(g, projectId);
  if (!p) return { ok: false, reason: 'Unknown project.' };
  const preview = previewFix(g, p, model);
  if (!preview.ok) return { ok: false, reason: preview.reason! };
  p.fixing += preview.amount;
  p.knownBugs -= preview.amount;
  launchRun(g, p, 'fix', model, preview);
  return { ok: true };
}

function workBlock(g: GameState): string | null {
  if (g.human) return `You are busy: ${g.human.label}.`;
  if (g.energy < MIN_WORK_ENERGY) return 'Too tired to work. Eat, rest or sleep first.';
  return null;
}

// Spec and test use AI when tokens and internet allow, otherwise they fall back to doing it by hand
const canUseAi = (g: GameState, tokens: number) => g.outageUntil === null && tokenStatus(g).usable >= tokens;

export function specPlan(g: GameState, p: Project) {
  const tasks = Math.ceil(p.tasksTotal * 0.35);
  const tokens = Math.round(tasks * TIER_INFO[p.tier].tokensPerTask * 0.15 * tokenMultiplier(g) * 10) / 10;
  const ai = canUseAi(g, tokens);
  return { ai, tokens: ai ? tokens : 0, minutes: ai ? 30 : HOUR };
}

export function startPlan(g: GameState, projectId: string): ActionResult {
  const p = projectById(g, projectId);
  if (!p) return { ok: false, reason: 'Unknown project.' };
  const blocked = workBlock(g);
  if (blocked) return { ok: false, reason: blocked };
  const remaining = p.tasksTotal - p.tasksDone - p.tasksInFlight;
  if (p.specTasks >= remaining) return { ok: false, reason: 'The plan already covers everything left to build.' };
  const plan = specPlan(g, p);
  if (plan.ai) spendTokens(g, plan.tokens);
  startHuman(g, 'plan', plan.minutes, `Writing a plan for ${p.title}`, { projectId: p.id, hand: !plan.ai });
  return { ok: true };
}

export function testPlan(g: GameState, p: Project) {
  const tokens = Math.round(p.tasksDone * TIER_INFO[p.tier].tokensPerTask * 0.1 * tokenMultiplier(g) * 10) / 10;
  const ai = canUseAi(g, tokens);
  const base = Math.max(30, p.tasksDone * 5) * (has(g, 'monitor') ? 0.75 : 1) * (has(g, 'workstation') ? 0.75 : 1);
  return { ai, tokens: ai ? tokens : 0, minutes: ceilStep(base * (ai ? 1 : 1.5)) };
}

export function testBlock(g: GameState, p: Project): string | null {
  if (p.tasksDone <= 0) return 'Nothing built yet.';
  if (p.tasksInFlight > 0 || p.fixing > 0) return 'Wait for the running work on this project first.';
  return workBlock(g);
}

export function startTest(g: GameState, projectId: string): ActionResult {
  const p = projectById(g, projectId);
  if (!p) return { ok: false, reason: 'Unknown project.' };
  const blocked = testBlock(g, p);
  if (blocked) return { ok: false, reason: blocked };
  const plan = testPlan(g, p);
  if (plan.ai) spendTokens(g, plan.tokens);
  startHuman(g, 'test', plan.minutes, `Testing ${p.title}`, { projectId: p.id, hand: !plan.ai });
  return { ok: true };
}

export function handTasks(g: GameState, p: Project) {
  // Subtract only non-stalled in-flight tasks so a stalled agent doesn't block manual work
  const stalledInFlight = g.agents
    .filter((r) => r.stalled && r.projectId === p.id)
    .reduce((sum, r) => sum + r.amount, 0);
  const effectiveInFlight = Math.max(0, p.tasksInFlight - stalledInFlight);
  const remaining = p.tasksTotal - p.tasksDone - effectiveInFlight;
  return Math.min(remaining, 2);
}

export function handFixableBugs(g: GameState, p: Project) {
  const stalledFixing = g.agents
    .filter((r) => r.stalled && r.projectId === p.id && r.type === 'fix')
    .reduce((sum, r) => sum + r.amount, 0);
  return p.knownBugs + stalledFixing;
}

export function handMinutes(g: GameState, tasks: number) {
  const skill = g.background === 'developer' ? 0.7 : g.background === 'marketer' ? 1.3 : 1;
  return ceilStep(tasks * 1.5 * HOUR * skill * (has(g, 'workstation') ? 0.75 : 1));
}

export function startHandcode(g: GameState, projectId: string): ActionResult {
  const p = projectById(g, projectId);
  if (!p) return { ok: false, reason: 'Unknown project.' };
  const blocked = workBlock(g);
  if (blocked) return { ok: false, reason: blocked };
  for (const run of [...g.agents]) {
    if (run.projectId === p.id && run.stalled && run.type === 'build') removeStalledRun(g, run);
  }
  const tasks = handTasks(g, p);
  if (tasks <= 0) {
    return { ok: false, reason: 'All tasks are built or in progress.' };
  }
  p.tasksInFlight += tasks;
  startHuman(g, 'handcode', handMinutes(g, tasks), `Hand-coding ${count(tasks, 'task')}`, { projectId: p.id, amount: tasks });
  return { ok: true };
}

export function startHandfix(g: GameState, projectId: string): ActionResult {
  const p = projectById(g, projectId);
  if (!p) return { ok: false, reason: 'Unknown project.' };
  const blocked = workBlock(g);
  if (blocked) return { ok: false, reason: blocked };
  for (const run of [...g.agents]) {
    if (run.projectId === p.id && run.stalled && run.type === 'fix') removeStalledRun(g, run);
  }
  if (p.knownBugs <= 0) return { ok: false, reason: 'No known bugs to fix.' };
  p.knownBugs -= 1;
  p.fixing += 1;
  startHuman(g, 'handfix', handMinutes(g, 1) * 0.75, `Fixing a bug by hand`, { projectId: p.id, amount: 1 });
  return { ok: true };
}

// --- Life ---
function restBlock(g: GameState): string | null {
  return g.human ? `You are busy: ${g.human.label}.` : null;
}

const MEALS = [25, 20, 10];
export function nextMealEnergy(g: GameState) {
  return MEALS[Math.min(g.mealsToday, MEALS.length - 1)];
}

export function eatCooldownLeft(g: GameState) {
  return g.fullUntil && g.fullUntil > g.minute ? g.fullUntil - g.minute : 0;
}

export function startEat(g: GameState): ActionResult {
  const blocked = restBlock(g);
  if (blocked) return { ok: false, reason: blocked };
  const wait = eatCooldownLeft(g);
  if (wait > 0) return { ok: false, reason: 'You already had 3 meals. Wait 8 hours before eating again.' };
  startHuman(g, 'eat', 40, 'Cooking and eating');
  g.fx.push('coffee');
  return { ok: true };
}

export function coffeeEnergy(g: GameState) {
  return has(g, 'espresso') ? 25 : 15;
}

export function startCoffee(g: GameState): ActionResult {
  const blocked = restBlock(g);
  if (blocked) return { ok: false, reason: blocked };
  startHuman(g, 'coffee', 10, 'Making coffee');
  g.fx.push('coffee');
  return { ok: true };
}

export function startBreak(g: GameState): ActionResult {
  const blocked = restBlock(g);
  if (blocked) return { ok: false, reason: blocked };
  startHuman(g, 'break', 30, 'Taking a break at the window');
  return { ok: true };
}

export function startNap(g: GameState): ActionResult {
  const blocked = restBlock(g);
  if (blocked) return { ok: false, reason: blocked };
  startHuman(g, 'nap', 90, 'Napping');
  return { ok: true };
}

export function sleepMinutes(g: GameState) {
  const { hour, minuteOfDay } = calendar(g.minute);
  if (hour >= 20 || hour < 5) return (8 * HOUR - minuteOfDay + DAY) % DAY;
  return 8 * HOUR;
}

export function startSleep(g: GameState): ActionResult {
  const blocked = restBlock(g);
  if (blocked) return { ok: false, reason: blocked };
  startHuman(g, 'sleep', sleepMinutes(g), 'Sleeping');
  return { ok: true };
}

export function dayOffMinutes(g: GameState) {
  const until = (9 * HOUR - calendar(g.minute).minuteOfDay + DAY) % DAY;
  return until >= 12 * HOUR ? until : until + DAY;
}

export function startDayOff(g: GameState, activityId: string = 'park'): ActionResult {
  const blocked = restBlock(g);
  if (blocked) return { ok: false, reason: blocked };
  const activity = DAY_OFF_ACTIVITIES.find((a) => a.id === activityId) ?? DAY_OFF_ACTIVITIES[0];
  if (g.cash < activity.price) {
    return { ok: false, reason: `Need $${activity.price} for "${activity.label}".` };
  }
  if (activity.price > 0) {
    g.cash -= activity.price;
    g.ledger.purchases += activity.price;
  }
  const mins = dayOffMinutes(g);
  startHuman(g, 'dayoff', mins, activity.label);
  let left = mins;
  while (left > 0 && g.human?.kind === 'dayoff' && !g.ending) {
    step(g);
    left -= STEP;
  }
  g.burnout = Math.max(0, g.burnout - activity.burnoutRelief);
  g.energy = energyMax(g);
  log(g, `Day off (${activity.label}): Burnout -${activity.burnoutRelief}%, Energy fully restored.`, 'good');
  return { ok: true };
}

export function startWait(g: GameState): ActionResult {
  const blocked = restBlock(g);
  if (blocked) return { ok: false, reason: blocked };
  const reset = tokenStatus(g).sessionResetIn;
  if (reset === null || reset <= 0) return { ok: false, reason: 'There is no token window to wait for.' };
  startHuman(g, 'wait', reset, 'Waiting for the token window to reset');
  return { ok: true };
}

// --- Academy and shop ---
function pay(g: GameState, amount: number, ledger: 'credits' | 'purchases'): ActionResult {
  if (g.cash < amount) return { ok: false, reason: `You need $${amount.toLocaleString()}.` };
  g.cash -= amount;
  g.ledger[ledger] += amount;
  g.fx.push('buy');
  return { ok: true };
}

export function enroll(g: GameState, courseId: string): ActionResult {
  const course = COURSES.find((c) => c.id === courseId);
  if (!course || g.coursesEnrolled.includes(courseId) || knows(g, courseId)) return { ok: false, reason: 'Already enrolled.' };
  const paid = pay(g, course.cost, 'purchases');
  if (!paid.ok) return paid;
  g.coursesEnrolled.push(courseId);
  g.courseMinutes[courseId] = 0;
  return { ok: true };
}

export const courseMinutesNeeded = (g: GameState, hours: number) =>
  Math.round(hours * HOUR * (g.background === 'student' ? 0.85 : g.background === 'marketer' ? 1.2 : 1));

export function startStudy(g: GameState, courseId: string): ActionResult {
  const course = COURSES.find((c) => c.id === courseId);
  if (!course || !g.coursesEnrolled.includes(courseId)) return { ok: false, reason: 'Enroll first.' };
  const blocked = workBlock(g);
  if (blocked) return { ok: false, reason: blocked };
  const left = courseMinutesNeeded(g, course.hours) - (g.courseMinutes[courseId] ?? 0);
  startHuman(g, 'study', Math.min(2 * HOUR, left), `Studying ${course.title}`, { courseId });
  return { ok: true };
}

export function buyGear(g: GameState, id: GearId): ActionResult {
  if (has(g, id)) return { ok: false, reason: 'You already own this.' };
  const paid = pay(g, GEAR[id].price, 'purchases');
  if (!paid.ok) return paid;
  g.gear.push(id);
  log(g, `${GEAR[id].label} installed. ${GEAR[id].blurb}`, 'good');
  return { ok: true };
}

export function creditPackPrice(g: GameState) {
  return g.background === 'marketer' && !g.promoUsedThisWeek ? Math.round(CREDIT_PACK.price * 0.5) : CREDIT_PACK.price;
}

export function buyCredits(g: GameState): ActionResult {
  const price = creditPackPrice(g);
  const paid = pay(g, price, 'credits');
  if (!paid.ok) return paid;
  if (g.background === 'marketer' && !g.promoUsedThisWeek) g.promoUsedThisWeek = true;
  g.credits += CREDIT_PACK.tokens;
  g.tally.creditsBought += CREDIT_PACK.tokens;
  return { ok: true };
}

export function setPlan(g: GameState, id: PlanId): ActionResult {
  if (g.plan === id) return { ok: false, reason: 'You are already on this plan.' };
  const paid = pay(g, PLANS[id].price, 'purchases');
  if (!paid.ok) return paid;
  g.plan = id;
  log(g, `Switched to the ${PLANS[id].label} plan. First week paid.`, 'good');
  return { ok: true };
}

export function setInternet(g: GameState, id: InternetId): ActionResult {
  if (g.internet === id) return { ok: false, reason: 'You already have this connection.' };
  const net = INTERNET[id];
  const paid = pay(g, net.price, 'purchases');
  if (!paid.ok) return { ok: false, reason: `Cannot upgrade: you need ${net.price} for the first week.` };
  g.internet = id;
  log(g, `Internet upgraded to ${net.label}. First week (${net.price}) paid.`, 'good');
  return { ok: true };
}

export function repayDebt(g: GameState): ActionResult {
  const amount = Math.min(g.cash, g.debt);
  if (amount <= 0) return { ok: false, reason: g.debt <= 0 ? 'You have no debt.' : 'You have no cash.' };
  g.cash -= amount;
  g.debt -= amount;
  log(g, `Repaid $${amount.toLocaleString()} of debt.`, 'good');
  return { ok: true };
}

// --- Delivery ---
export const qualityOf = (bugs: number, tasks: number) => clamp(Math.round(100 - (200 * bugs) / tasks), 0, 100);
export const expectedQuality = (p: Project) => qualityOf(p.knownBugs + p.estHidden, p.tasksTotal);

export function deliverBlock(p: Project): string | null {
  if (p.tasksDone < p.tasksTotal) return 'Finish building every task first.';
  if (p.tasksInFlight > 0 || p.fixing > 0) return 'Wait for the running work on this project.';
  return null;
}

function starsFor(quality: number, late: boolean, revised: boolean) {
  let stars = quality >= 92 ? 5 : quality >= 80 ? 4 : quality >= 65 ? 3 : quality >= 45 ? 2 : 1;
  if (revised) stars = Math.min(stars, 3);
  if (late) stars -= 1;
  return Math.max(1, stars);
}

function addReview(g: GameState, p: Project, stars: number, quality: number, late: boolean) {
  const pool = REVIEW_TEXT[stars];
  g.reviews.unshift({ id: `rev-${g.nextId++}`, minute: g.minute, clientId: p.clientId, title: p.title, stars, quality, late, text: pool[Math.floor(rand(g) * pool.length)] });
  if (g.reviews.length > 30) g.reviews.pop();
  const client = ensureClient(g, p.clientId);
  client.jobs += 1;
  client.starsTotal += stars;
  client.lastStars = stars;
  g.tally.starsTotal += stars;
  g.tally.reviews += 1;
}

export function deliver(g: GameState, projectId: string): ActionResult {
  const p = projectById(g, projectId);
  if (!p) return { ok: false, reason: 'Unknown project.' };
  const blocked = deliverBlock(p);
  if (blocked) return { ok: false, reason: blocked };
  if (g.human?.projectId === p.id) return { ok: false, reason: 'Finish what you are doing on this project.' };

  const info = TIER_INFO[p.tier];
  const quality = qualityOf(p.hiddenBugs + p.knownBugs, p.tasksTotal);
  const late = g.minute > p.deadlineAt;

  if (quality < p.qualityBar && p.revisions < 2 && p.kind === 'contract') {
    p.revisions += 1;
    const listed = Math.max(1, binomial(g, p.hiddenBugs, 0.6));
    const fromHidden = Math.min(listed, p.hiddenBugs);
    p.hiddenBugs -= fromHidden;
    p.knownBugs += fromHidden;
    p.estHidden = Math.max(p.hiddenBugs * 0.5, p.estHidden - fromHidden);
    p.testedSinceChange = false;
    addReputation(g, -Math.round(info.repWeight * 0.5));
    g.tally.revisions += 1;
    log(g, `${clientName(p.clientId)} rejected the delivery (quality ${quality}, they need ${p.qualityBar}). They listed ${count(fromHidden, 'bug')}, there may be more. No payment until it is fixed.`, 'bad');
    g.fx.push('error');
    return { ok: true };
  }

  const rawStars = starsFor(quality, late, p.revisions > 0);
  const stars = quality < p.qualityBar ? 1 : rawStars;
  const starPay = stars >= 4 ? 1 : stars === 3 ? 0.75 : stars === 2 ? 0.4 : 0;
  const tip = stars === 5 && quality >= 95 ? 1.05 : 1;
  const paid = Math.round(p.fee * starPay * tip);

  const prevTop = highestTier(g);
  addReview(g, p, stars, quality, late);
  const cvBonus = p.kind === 'retainer' && stars >= 4 ? retainerRepBonus(g) : 0;
  addReputation(g, Math.max(-info.repWeight, info.repWeight * (stars - 2) + cvBonus));
  if (highestTier(g) > prevTop) refillMarket(g);
  g.projects = g.projects.filter((x) => x.id !== p.id);
  g.agents = g.agents.filter((a) => a.projectId !== p.id);
  g.shipped += 1;
  g.week.shipped += 1;
  g.monthShipped += 1;

  if (p.kind === 'retainer') {
    const c = ensureClient(g, p.clientId);
    const retainerPaid = Math.round((c.retainerFee ?? 0) * starPay);
    g.tally.fees += retainerPaid;
    if (retainerPaid > 0) {
      g.invoices.push({ id: `inv-${g.nextId++}`, label: `${clientName(p.clientId)} retainer`, amount: retainerPaid, dueAt: nextMonday(g.minute), kind: 'retainer' });
    }
    c.ticketOpen = false;
    c.retainersCompleted += 1;
    if (c.retainersCompleted >= 3) {
      c.retainerFee = null;
      c.retainersCompleted = 0; // contract expired, reset so they can offer again later
      log(g, `${clientName(p.clientId)} retainer expired after 3 months (${stars} stars, paid ${retainerPaid.toLocaleString()} on Monday). Slot freed up.`, 'warn');
    } else {
      log(g, `Monthly ticket for ${clientName(p.clientId)} done (${stars} stars). They pay ${retainerPaid.toLocaleString()} on Monday.`, stars >= 4 ? 'good' : 'warn');
    }
  } else {
    g.tally.fees += paid;
    if (paid > 0) {
      g.invoices.push({ id: `inv-${g.nextId++}`, label: p.title, amount: paid, dueAt: nextMonday(g.minute), kind: 'contract' });
      log(g, `Delivered "${p.title}": quality ${quality}, ${stars} stars (${Math.round(starPay * 100)}% pay). They pay ${paid.toLocaleString()} on Monday.`, stars >= 4 ? 'good' : 'warn');
    } else {
      log(g, `Delivered "${p.title}": quality ${quality}, 1 star. Unusable output after revisions — client refused payment ($0).`, 'bad');
    }
    maybeOfferRetainer(g, p, stars);
  }

  if (p.tier === 5 && quality >= p.qualityBar && !g.ending) {
    g.ending = 'architect';
    g.title = 'Chief AI Architect';
  }
  g.fx.push('success');
  return { ok: true };
}

function maybeOfferRetainer(g: GameState, p: Project, stars: number) {
  const client = ensureClient(g, p.clientId);
  const active = Object.values(g.clients).filter((c) => c.retainerFee !== null).length;
  if (client.retainerFee !== null || client.retainersCompleted >= 3 || active >= MAX_RETAINERS) return;
  if (client.jobs >= 2 && stars >= 4 && rand(g) < 0.5) {
    g.eventQueue.push({ kind: 'retainer', clientId: p.clientId, fee: Math.round((p.fee * 0.7) / 10) * 10 });
  }
}

// A stalled run has no usable token budget to make progress. When cancelled or
// replaced by manual hand-coding, bank any partial work completed so far.
function removeStalledRun(g: GameState, run: AgentRun) {
  const p = projectById(g, run.projectId);
  if (p) {
    const total = run.minutesTotal;
    const left = run.minutesLeft;
    const progress = total > 0 ? Math.max(0, Math.min(1, (total - left) / total)) : 0;
    if (run.type === 'build') {
      const completed = Math.floor(run.amount * progress);
      if (completed > 0) {
        p.tasksDone += completed;
        p.tasksInFlight = Math.max(0, p.tasksInFlight - completed);
        const bugs = binomial(g, completed, run.bugRate);
        p.hiddenBugs += bugs;
        p.estHidden += completed * run.bugRate;
        p.testedSinceChange = false;
        g.tally.bugsMade += bugs;
        log(g, `Banked ${completed} of ${count(run.amount, 'task')} completed by agent before stalling.`, 'info');
      }
      p.tasksInFlight = Math.max(0, p.tasksInFlight - (run.amount - completed));
    } else {
      const model = MODELS[run.model];
      const fixed = Math.floor(run.amount * progress * model.fixRate);
      if (fixed > 0) {
        const regress = binomial(g, fixed, model.regress);
        p.hiddenBugs += regress;
        p.estHidden += fixed * model.regress;
        p.testedSinceChange = false;
        log(g, `Banked ${fixed} bug fixes completed by agent before stalling.`, 'info');
      }
      p.fixing = Math.max(0, p.fixing - run.amount);
      p.knownBugs += Math.max(0, run.amount - fixed);
    }
  }
  g.agents = g.agents.filter((agent) => agent.id !== run.id);
  return p;
}

export function cancelStalledAgent(g: GameState, runId: string): ActionResult {
  const run = g.agents.find((agent) => agent.id === runId);
  if (!run) return { ok: false, reason: 'That agent run is no longer active.' };
  if (!run.stalled) return { ok: false, reason: 'Only an agent stalled for lack of tokens can be cancelled here.' };

  const p = removeStalledRun(g, run);
  log(g, `Cancelled the stalled agent run on \"${p?.title ?? 'the project'}\". Its reserved work was released.`, 'warn');
  return { ok: true };
}

export function dropProject(g: GameState, projectId: string): ActionResult {
  const p = projectById(g, projectId);
  if (!p) return { ok: false, reason: 'Unknown project.' };
  if (p.tasksInFlight > 0 || p.fixing > 0) return { ok: false, reason: 'Work is still running on this project.' };
  cancelProject(g, p, `You pulled out of "${p.title}".`, 1);
  return { ok: true };
}

function cancelProject(g: GameState, p: Project, text: string, repMultiplier: number) {
  const info = TIER_INFO[p.tier];
  addReputation(g, -Math.round(info.repWeight * repMultiplier));
  g.projects = g.projects.filter((x) => x.id !== p.id);
  g.agents = g.agents.filter((a) => a.projectId !== p.id);
  addReview(g, p, 1, 0, true);
  const client = ensureClient(g, p.clientId);
  if (p.kind === 'retainer') {
    client.retainerFee = null;
    client.ticketOpen = false;
  }
  g.tally.cancelled += 1;
  log(g, `${text} Reputation down, a one-star review was posted.`, 'bad');
  g.fx.push('error');
}

// --- Events ---
export function answerEvent(g: GameState, accept: boolean) {
  const e = g.pendingEvent;
  if (!e) return;
  g.pendingEvent = null;
  if (e.kind === 'scope') {
    const p = projectById(g, e.projectId);
    if (p && accept) {
      p.tasksTotal += e.addTasks;
      p.fee += e.addFee;
      p.deadlineAt += DAY;
      log(g, `Scope extended on "${p.title}": +${count(e.addTasks, 'task')}, +$${e.addFee.toLocaleString()}, one extra day.`);
    }
  } else if (e.kind === 'call') {
    const p = projectById(g, e.projectId);
    if (p && accept) {
      startHuman(g, 'meeting', HOUR, `Call with ${clientName(p.clientId)}`, { projectId: p.id });
    } else if (p) {
      addReputation(g, -3);
    }
  } else {
    if (accept) {
      ensureClient(g, e.clientId).retainerFee = e.fee;
      const repGain = retainerRepBonus(g);
      const prevTop = highestTier(g);
      addReputation(g, repGain);
      if (highestTier(g) > prevTop) refillMarket(g);
      log(g, `${clientName(e.clientId)} is now on a $${e.fee.toLocaleString()} monthly retainer (+${repGain} reputation). A maintenance ticket arrives each month.`, 'good');
    }
  }
}

function rollDailyEvents(g: GameState) {
  const active = g.projects.filter((p) => p.kind === 'contract');
  if (active.length && rand(g) < 0.1) {
    const p = pick(g, active);
    if (p.tasksDone < p.tasksTotal && rand(g) < 0.5) {
      const addTasks = Math.max(1, Math.ceil(p.tasksTotal * 0.2));
      g.eventQueue.push({ kind: 'scope', projectId: p.id, addTasks, addFee: Math.round((p.fee * 0.25) / 10) * 10 });
    } else {
      g.eventQueue.push({ kind: 'call', projectId: p.id });
    }
  }
  if (rand(g) < 0.06) {
    const s = pick(g, SURPRISES);
    charge(g, s.amount);
    g.ledger.surprises += s.amount;
    log(g, `Unexpected expense: ${s.label}, $${s.amount}.`, 'warn');
  }
  if (rand(g) < 0.06) {
    const template = pickTemplate(g, highestTier(g));
    if (template) {
      if (g.offers.length >= 4) {
        const dropIdx = g.offers.findIndex((o) => !o.rush);
        if (dropIdx !== -1) g.offers.splice(dropIdx, 1);
        else g.offers.pop();
      }
      g.offers.push(makeOffer(g, template, true));
      log(g, `Rush job on the market: "${template.title}" pays 50% more, short deadline.`);
    }
  }
  const net = INTERNET[g.internet];
  if (g.outageAt === null && g.outageUntil === null && rand(g) < net.outageChance) {
    g.outageAt = g.minute + Math.round(between(g, 8, 20)) * HOUR;
  }
}

function charge(g: GameState, amount: number) {
  const fromCash = Math.min(g.cash, amount);
  g.cash -= fromCash;
  g.debt += amount - fromCash;
}

// --- Completing work ---
function finishRun(g: GameState, run: AgentRun) {
  g.agents = g.agents.filter((a) => a.id !== run.id);
  const p = projectById(g, run.projectId);
  if (!p) return;
  const model = MODELS[run.model];
  if (run.type === 'build') {
    const bugs = binomial(g, run.amount, run.bugRate);
    p.tasksInFlight -= run.amount;
    p.tasksDone += run.amount;
    p.hiddenBugs += bugs;
    p.estHidden += run.amount * run.bugRate;
    p.testedSinceChange = false;
    g.tally.bugsMade += bugs;
    log(g, `Agent finished ${count(run.amount, 'task')} on "${p.title}". Run tests before you trust it.`);
  } else {
    p.fixing -= run.amount;
    const fixed = binomial(g, run.amount, model.fixRate);
    const regress = binomial(g, fixed, model.regress);
    p.knownBugs += run.amount - fixed;
    p.hiddenBugs += regress;
    p.estHidden += fixed * model.regress;
    p.testedSinceChange = false;
    log(g, `Agent fixed ${fixed} of ${count(run.amount, 'bug')} on "${p.title}".`, fixed === run.amount ? 'info' : 'warn');
  }
  g.fx.push('done');
}

function finishHuman(g: GameState) {
  const h = g.human!;
  g.human = null;
  const p = projectById(g, h.projectId);
  switch (h.kind) {
    case 'prompt':
      if (h.run) g.agents.push(h.run);
      break;
    case 'plan':
      if (p) {
        const remaining = p.tasksTotal - p.tasksDone - p.tasksInFlight;
        p.specTasks = Math.min(remaining, p.specTasks + Math.ceil(p.tasksTotal * 0.35));
        log(g, `Plan written. ${count(p.specTasks, 'task')} now covered: fewer bugs and fewer tokens on those.`);
      }
      break;
    case 'meeting':
      if (p) {
        const remaining = p.tasksTotal - p.tasksDone - p.tasksInFlight;
        p.specTasks = Math.min(remaining, p.specTasks + Math.ceil(p.tasksTotal * 0.2));
        addReputation(g, 3);
        log(g, `Good call with ${clientName(p.clientId)}. Clearer requirements added to the plan.`, 'good');
      }
      break;
    case 'test':
      if (p) {
        const chance = Math.max(0.2, detectChance(g) - (h.hand ? 0.15 : 0));
        const found = binomial(g, p.hiddenBugs, chance);
        p.hiddenBugs -= found;
        p.knownBugs += found;
        p.estHidden *= 1 - chance;
        p.lastTestFound = found;
        p.testedSinceChange = true;
        log(g, found ? `Tests found ${count(found, 'bug')} in "${p.title}".` : `Tests found nothing new in "${p.title}".`, found ? 'warn' : 'good');
      }
      break;
    case 'handcode':
      if (p) {
        const amount = h.amount ?? 0;
        const rate = clamp(HAND_BUG_RATE * (g.background === 'marketer' ? 1.6 : 1) * tiredBugs(g) * p.approach.bugs, 0.01, 0.9);
        const bugs = binomial(g, amount, rate);
        p.tasksInFlight -= amount;
        p.tasksDone += amount;
        p.hiddenBugs += bugs;
        p.estHidden += amount * rate;
        p.testedSinceChange = false;
        g.tally.bugsMade += bugs;
        // Handcoding replaces blocked AI work: cancel stalled runs and release
        // the correct reservation for either build or fix runs.
        for (const run of [...g.agents]) {
          if (run.projectId === p.id && run.stalled) removeStalledRun(g, run);
        }
      }
      break;
    case 'handfix':
      if (p) {
        p.fixing -= 1;
        for (const run of [...g.agents]) {
          if (run.projectId === p.id && run.stalled) removeStalledRun(g, run);
        }
      }
      break;
    case 'study':
      if (h.courseId) {
        g.courseMinutes[h.courseId] = (g.courseMinutes[h.courseId] ?? 0) + h.minutesTotal;
        const course = COURSES.find((c) => c.id === h.courseId)!;
        if (g.courseMinutes[h.courseId] >= courseMinutesNeeded(g, course.hours)) {
          g.coursesEnrolled = g.coursesEnrolled.filter((c) => c !== course.id);
          g.coursesDone.push(course.id);
          addReputation(g, course.repBonus);
          log(g, `Course complete: ${course.title}. ${course.perk}.`, 'good');
          g.fx.push('buy');
          refillMarket(g);
        }
      }
      break;
    case 'eat':
      g.energy = Math.min(energyMax(g), g.energy + nextMealEnergy(g));
      g.mealsToday += 1;
      if (g.mealsToday >= 3) {
        g.fullUntil = g.minute + 8 * HOUR;
      }
      break;
    case 'coffee':
      g.energy = Math.min(energyMax(g), g.energy + coffeeEnergy(g));
      g.coffeesToday += 1;
      if (g.coffeesToday > 1) {
        g.burnout = Math.min(100, g.burnout + 3);
        log(g, 'Too much coffee today. Jittery, burnout +3.', 'warn');
      }
      break;
    case 'break':
      g.energy = Math.min(energyMax(g), g.energy + 8);
      break;
    default:
      break;
  }
}

function abortHuman(g: GameState) {
  const h = g.human;
  if (!h) return;
  const p = projectById(g, h.projectId);
  if (h.kind === 'prompt' && h.run) g.agents.push(h.run);
  if (h.kind === 'handcode' && p) {
    const total = h.minutesTotal;
    const left = h.minutesLeft;
    const progress = total > 0 ? Math.max(0, Math.min(1, (total - left) / total)) : 0;
    const amount = h.amount ?? 0;
    const completed = Math.floor(amount * progress);
    if (completed > 0) {
      p.tasksDone += completed;
      p.tasksInFlight = Math.max(0, p.tasksInFlight - completed);
      const rate = clamp(HAND_BUG_RATE * (g.background === 'marketer' ? 1.6 : 1) * tiredBugs(g) * p.approach.bugs, 0.01, 0.9);
      const bugs = binomial(g, completed, rate);
      p.hiddenBugs += bugs;
      p.estHidden += completed * rate;
      p.testedSinceChange = false;
      g.tally.bugsMade += bugs;
      log(g, `Banked ${completed} of ${count(amount, 'task')} finished by hand before stopping.`, 'info');
    }
    p.tasksInFlight = Math.max(0, p.tasksInFlight - (amount - completed));
  }
  if (h.kind === 'handfix' && p) {
    p.fixing = Math.max(0, p.fixing - 1);
    p.knownBugs += 1;
  }
  g.human = null;
}

// --- Time ---
export function isTimeRunning(g: GameState) {
  if (g.pendingEvent || g.pendingStatement) return false;
  if (g.ending && g.ending !== 'architect') return false;
  if (g.ending === 'architect' && !g.endingSeen) return false;
  const usable = tokenStatus(g).usable;
  return !!g.human || (g.outageUntil === null && g.agents.some((run) => usable >= runBurn(run)));
}

// Tokens burn while the agent works, so one step costs a slice of the run
function runBurn(run: AgentRun) {
  return (run.tokens * STEP) / run.minutesTotal;
}

function stepHuman(g: GameState) {
  const hours = STEP / HOUR;
  const h = g.human;
  if (!h) {
    g.energy = Math.max(0, g.energy - 2 * hours);
    return;
  }
  const work = isWorkKind(h.kind);
  let rate = ENERGY_RATE[h.kind];
  if (work && has(g, 'chair')) rate *= 0.8;
  if ((h.kind === 'sleep' || h.kind === 'nap') && has(g, 'mattress')) rate *= 1.25;
  g.energy = clamp(g.energy + rate * hours, 0, energyMax(g));

  if (work) {
    g.workToday += STEP;
    g.week.workMinutes += STEP;
    g.monthWork += STEP;
    g.tally.workMinutes += STEP;
    let burn = 0;
    if (g.workToday > 8 * HOUR) burn += 3;
    const hour = calendar(g.minute).hour;
    if (hour >= 22 || hour < 6) burn += 3;
    g.burnout = Math.min(100, g.burnout + burn * hours);
  } else if (h.kind === 'break' || h.kind === 'nap' || h.kind === 'sleep') {
    g.burnout = Math.max(0, g.burnout - 0.5 * hours);
  }

  h.minutesLeft -= STEP;
  if (h.minutesLeft <= 0) finishHuman(g);
}

function stepAgents(g: GameState) {
  if (g.outageUntil !== null) return;
  for (const run of [...g.agents]) {
    const burn = runBurn(run);
    if (tokenStatus(g).usable < burn) continue;
    run.stalled = false;
    spendTokens(g, burn);
    run.minutesLeft -= STEP;
    if (run.minutesLeft <= 0) finishRun(g, run);
  }
  // Flag here, because the clock can stop before the next step runs
  for (const run of g.agents) {
    if (!run.stalled && tokenStatus(g).usable < runBurn(run)) {
      run.stalled = true;
      g.tally.stalls += 1;
      log(g, 'Agent paused: out of tokens. It continues when your quota refills or you buy credits.', 'warn');
      g.fx.push('error');
    }
  }
}

function collapse(g: GameState) {
  if (g.energy <= 0 && g.human && isWorkKind(g.human.kind)) {
    abortHuman(g);
    startHuman(g, 'sleep', 10 * HOUR, 'Passed out from exhaustion');
    g.burnout = Math.min(100, g.burnout + 5);
    g.tally.passouts += 1;
    log(g, 'You passed out at the desk and slept for 10 hours. Burnout +5.', 'bad');
    g.fx.push('error');
  }
  if (g.burnout >= 100) {
    g.burnoutStrikes += 1;
    g.tally.burnouts += 1;
    abortHuman(g);
    g.burnout = 55;
    if (g.burnoutStrikes >= 2) {
      g.ending = 'burnout';
      return;
    }
    startHuman(g, 'sick', 3 * DAY, 'Sick leave: burned out');
    log(g, 'Full burnout. The doctor signed you off for 3 days. A second one will end your career.', 'bad');
    g.fx.push('error');
  }
}

const emptyLedger = () => ({ contracts: 0, retainers: 0, credits: 0, purchases: 0, surprises: 0, rent: 0, food: 0, utilities: 0, internet: 0, plan: 0, unpaid: 0 });

export function weeklyBills(g: GameState) {
  return BACKGROUNDS[g.background].rent + FOOD_BILL + UTILITIES_BILL + INTERNET[g.internet].price + PLANS[g.plan].price;
}

function payWeeklyBills(g: GameState) {
  const total = weeklyBills(g);
  const paid = Math.min(g.cash, total);
  g.cash -= paid;
  g.debt += total - paid;
  const l = g.ledger;
  l.rent = (l.rent ?? 0) + BACKGROUNDS[g.background].rent;
  l.food = (l.food ?? 0) + FOOD_BILL;
  l.utilities = (l.utilities ?? 0) + UTILITIES_BILL;
  l.internet = (l.internet ?? 0) + INTERNET[g.internet].price;
  l.plan = (l.plan ?? 0) + PLANS[g.plan].price;
  l.unpaid = (l.unpaid ?? 0) + total - paid;
  log(g, paid < total ? `Monday bills: $${total.toLocaleString()}. You were $${(total - paid).toLocaleString()} short, added to debt.` : `Monday bills paid: $${total.toLocaleString()}.`, paid < total ? 'bad' : 'info');
}

function closeMonth(g: GameState) {
  const month = Math.floor(g.minute / MONTH);
  const interest = Math.round(g.debt * INTEREST_RATE);
  g.debt += interest;
  const debtRepaid = Math.min(g.cash, g.debt);
  g.cash -= debtRepaid;
  g.debt -= debtRepaid;

  const statement: MonthStatement = {
    ...g.ledger,
    month,
    interest,
    debtRepaid,
    closingCash: g.cash,
    debt: g.debt,
    pendingInvoices: g.invoices.reduce((a, i) => a + i.amount, 0),
    workHours: Math.round(g.monthWork / HOUR),
    tokensUsed: Math.round(g.monthTokens),
    shipped: g.monthShipped,
  };
  g.statements.unshift(statement);
  if (g.statements.length > 24) g.statements.pop();
  g.pendingStatement = statement;
  g.ledger = emptyLedger();
  g.monthWork = 0;
  g.monthTokens = 0;
  g.monthShipped = 0;
  if (g.debt > OVERDRAFT_LIMIT) g.ending = 'bankrupt';
}

function openRetainerTickets(g: GameState) {
  for (const [clientId, client] of Object.entries(g.clients)) {
    if (client.retainerFee === null) continue;
    if (client.ticketOpen) {
      client.retainerFee = null;
      client.ticketOpen = false;
      log(g, `${clientName(clientId)} ended their retainer after last month's ticket was not delivered.`, 'bad');
      continue;
    }
    const tier = JOBS.find((j) => j.clientId === clientId)?.tier ?? 1;
    client.ticketOpen = true;
    g.projects.push({
      id: `job-${g.nextId++}`,
      title: `Monthly maintenance for ${clientName(clientId)}`,
      clientId,
      tier,
      kind: 'retainer',
      fee: 0,
      complexity: 1,
      approach: { label: 'Standard maintenance', description: '', scope: 1, bugs: 0.8 },
      tasksTotal: 5,
      tasksDone: 0,
      tasksInFlight: 0,
      specTasks: 0,
      hiddenBugs: 0,
      estHidden: 0,
      knownBugs: 0,
      fixing: 0,
      lastTestFound: null,
      testedSinceChange: false,
      deadlineAt: g.minute + 14 * DAY,
      qualityBar: 60,
      revisions: 0,
      acceptedAt: g.minute,
    });
  }
}

function rollDay(g: GameState) {
  if (g.minute % WEEK === 0) payWeeklyBills(g);
  g.workToday = 0;
  if (!g.fullUntil || g.minute >= g.fullUntil) g.mealsToday = 0;
  g.coffeesToday = 0;

  const before = g.offers.length;
  g.offers = g.offers.filter((o) => o.expiresAt > g.minute);
  if (g.offers.length !== before) refillMarket(g);

  if (g.minute % MONTH === 0) {
    closeMonth(g);
    openRetainerTickets(g);
  }
  if (g.minute % WEEK === 0) {
    const w = g.week;
    log(g, `Week ${Math.floor(g.minute / WEEK)} done: ${(w.workMinutes / HOUR).toFixed(1)}h worked, ${Math.round(w.tokensUsed)}k tokens used, ${w.shipped} shipped.`);
    g.week = { workMinutes: 0, tokensUsed: 0, shipped: 0 };
    if (g.weeklyUsed >= PLANS[g.plan].weekly * 0.85) g.tally.weeksCapped += 1;
    g.tally.weeks += 1;
    g.weeklyUsed = 0;
    g.promoUsedThisWeek = false;
    refillMarket(g);
  }
  
  rollDailyEvents(g);
}

function step(g: GameState) {
  g.minute += STEP;
  if (g.fullUntil && g.minute >= g.fullUntil) {
    g.fullUntil = null;
    g.mealsToday = 0;
  }

  if (g.sessionStart !== null && g.minute >= g.sessionStart + SESSION_MINUTES) {
    g.sessionStart = null;
    g.sessionUsed = 0;
    g.fx.push('window');
  }

  stepHuman(g);
  stepAgents(g);

  if (g.outageAt !== null && g.minute >= g.outageAt) {
    const [lo, hi] = INTERNET[g.internet].outageHours;
    g.outageAt = null;
    g.outageUntil = g.minute + Math.round(between(g, lo, hi)) * HOUR;
    g.tally.outages += 1;
    log(g, 'Internet outage. AI runs are paused. Plan, tests, hand-coding and study still work.', 'warn');
    g.fx.push('error');
  }
  if (g.outageUntil !== null && g.minute >= g.outageUntil) {
    g.outageUntil = null;
    log(g, 'The internet is back. Paused AI runs continue.', 'good');
  }

  if (g.minute % HOUR === 0) {
    for (const inv of g.invoices.filter((i) => i.dueAt <= g.minute)) {
      g.cash += inv.amount;
      g.ledger[inv.kind === 'retainer' ? 'retainers' : 'contracts'] += inv.amount;
      log(g, `Payment received: $${inv.amount.toLocaleString()} for ${inv.label}.`, 'good');
      g.fx.push('cash');
    }
    g.invoices = g.invoices.filter((i) => i.dueAt > g.minute);
    for (const p of [...g.projects]) {
      if (g.minute > p.deadlineAt + CANCEL_AFTER_DAYS * DAY) {
        cancelProject(g, p, `${clientName(p.clientId)} cancelled "${p.title}" for being a week overdue.`, 2);
      }
    }
  }

  if (g.minute % DAY === 0) rollDay(g);
  collapse(g);

  if (!g.human && !g.pendingEvent && g.eventQueue.length) {
    const e = g.eventQueue.shift() as GameEventData;
    if (e.kind === 'retainer' || projectById(g, e.projectId)) g.pendingEvent = e;
  }
}

export function advance(g: GameState, minutes: number) {
  let left = minutes;
  while (left > 0 && isTimeRunning(g)) {
    step(g);
    left -= STEP;
  }
}

export function closeStatement(g: GameState) {
  g.pendingStatement = null;
}

// --- Guidance for new players ---
export function nextHint(g: GameState): string | null {
  if (g.shipped >= 3) return null;
  if (g.outageUntil !== null) return 'The internet is down. Use the time for a plan, tests, study or a break.';
  const p = g.projects.find((x) => x.kind === 'contract');
  if (!p) {
    if (g.human || g.agents.length) return null;
    return 'Take a job from the Market. Compare each contract’s payout, deadline, and approach before accepting.';
  }
  if (p.tasksDone === 0 && p.tasksInFlight === 0 && p.specTasks === 0) return 'Write the plan first. It cuts bugs and tokens on the tasks it covers.';
  if (p.tasksDone + p.tasksInFlight < p.tasksTotal) return 'Launch an AI run, then use the waiting time: eat, write the next plan, or start another job.';
  if (p.tasksInFlight > 0 || p.fixing > 0) return 'The agent is working. You are free to do something else.';
  if (!p.testedSinceChange) return 'Agents leave hidden bugs. Test before you deliver.';
  if (p.knownBugs > 0) return 'Fix the known bugs with an AI run, or by hand if tokens are short.';
  return 'If the last test was clean, deliver. Clients pay on Monday.';
}

// --- New game ---
export function createGame(name: string, background: BackgroundId, seed: number): GameState {
  const g: GameState = {
    version: 1,
    rng: seed | 0,
    name: name.trim() || 'Freelancer',
    background,
    minute: 9 * HOUR,
    paused: false,
    speed: 1,
    energy: 90,
    burnout: 0,
    burnoutStrikes: 0,
    workToday: 0,
    mealsToday: 0,
    coffeesToday: 0,
    plan: 'free',
    sessionUsed: 0,
    sessionStart: null,
    weeklyUsed: 0,
    credits: 0,
    promoUsedThisWeek: false,
    cash: BACKGROUNDS[background].cash,
    debt: 0,
    invoices: [],
    ledger: emptyLedger(),
    statements: [],
    monthWork: 0,
    monthTokens: 0,
    monthShipped: 0,
    week: { workMinutes: 0, tokensUsed: 0, shipped: 0 },
    reputation: 0,
    reviews: [],
    shipped: 0,
    title: TITLES[TITLES.length - 1].title,
    coursesDone: [],
    coursesEnrolled: [],
    courseMinutes: {},
    gear: [],
    internet: 'basic',
    projects: [],
    offers: [],
    clients: {},
    human: null,
    agents: [],
    outageAt: null,
    outageUntil: null,
    inbox: [],
    nextId: 1,
    unread: 0,
    eventQueue: [],
    pendingEvent: null,
    pendingStatement: null,
    ending: null,
    endingSeen: false,
    fx: [],
    tally: {
      tokens: 0, runs: 0, fees: 0, workMinutes: 0, revisions: 0, cancelled: 0, passouts: 0, burnouts: 0,
      creditsBought: 0, weeks: 0, weeksCapped: 0, tokenBlocks: 0, stalls: 0, outages: 0, starsTotal: 0, reviews: 0, bugsMade: 0,
    },
  };
  refillMarket(g);
  log(g, `Welcome, ${g.name}. Every Monday clients pay and bills come out. You have a free AI plan and no clients. Time only moves when you do something.`, 'good');
  return g;
}

export const SAVE_KEY = 'vibecoder-simulator-save-v1';
