export type BackgroundId = 'developer' | 'marketer' | 'student';
export type ModelId = 'spark' | 'core' | 'apex';
export type BatchId = 'small' | 'medium' | 'large';
export type PlanId = 'free' | 'pro' | 'max' | 'ultra';
export type InternetId = 'basic' | 'fiber';
export type GearId = 'monitor' | 'chair' | 'espresso' | 'mattress' | 'workstation';
export type EndingId = 'bankrupt' | 'burnout' | 'architect';
export type Tier = 1 | 2 | 3 | 4 | 5;

export type ActivityKind =
  | 'prompt'
  | 'plan'
  | 'test'
  | 'handcode'
  | 'handfix'
  | 'study'
  | 'meeting'
  | 'eat'
  | 'coffee'
  | 'break'
  | 'nap'
  | 'sleep'
  | 'dayoff'
  | 'wait'
  | 'sick';

export interface Approach {
  label: string;
  description: string;
  scope: number; // multiplier on task count
  bugs: number; // multiplier on bug rate
}

export interface JobTemplate {
  id: string;
  tier: Tier;
  title: string;
  clientId: string;
  description: string;
  complexity: number; // 1 to 5
  fee: number;
  tasks: number;
  approaches: [Approach, Approach];
}

export interface Offer {
  id: string;
  templateId: string;
  tier: Tier;
  title: string;
  clientId: string;
  description: string;
  complexity: number;
  fee: number;
  tasks: number;
  deadlineDays: number;
  qualityBar: number;
  approaches: Approach[];
  acceptedApproaches?: number[];
  expiresAt: number;
  rush: boolean;
}

export interface Project {
  id: string;
  offerId?: string;
  approachIndex?: number;
  title: string;
  clientId: string;
  tier: Tier;
  kind: 'contract' | 'retainer';
  fee: number;
  complexity: number;
  approach: Approach;
  tasksTotal: number;
  tasksDone: number;
  tasksInFlight: number;
  specTasks: number; // remaining tasks covered by a written spec
  hiddenBugs: number; // never shown to the player
  estHidden: number; // the estimate the player sees
  knownBugs: number;
  fixing: number;
  lastTestFound: number | null;
  testedSinceChange: boolean;
  deadlineAt: number;
  qualityBar: number;
  revisions: number;
  acceptedAt: number;
}

export interface AgentRun {
  id: string;
  projectId: string;
  type: 'build' | 'fix';
  model: ModelId;
  amount: number; // tasks or bugs
  bugRate: number;
  specTasksUsed: number;
  minutesTotal: number;
  minutesLeft: number;
  tokens: number;
  stalled: boolean;
}

export interface HumanActivity {
  kind: ActivityKind;
  label: string;
  minutesTotal: number;
  minutesLeft: number;
  projectId?: string;
  courseId?: string;
  run?: AgentRun;
  amount?: number;
  hand?: boolean;
}

export interface ClientState {
  jobs: number;
  starsTotal: number;
  lastStars: number;
  retainerFee: number | null;
  ticketOpen: boolean;
  retainersCompleted: number; // how many monthly tickets delivered for this client
}

export interface Review {
  id: string;
  minute: number;
  clientId: string;
  title: string;
  stars: number;
  quality: number;
  late: boolean;
  text: string;
}

export interface Invoice {
  id: string;
  label: string;
  amount: number;
  dueAt: number;
  kind: 'contract' | 'retainer';
}

export type MessageTone = 'info' | 'good' | 'warn' | 'bad';

export interface Message {
  id: number;
  minute: number;
  text: string;
  tone: MessageTone;
}

export type GameEventData =
  | { kind: 'scope'; projectId: string; addTasks: number; addFee: number }
  | { kind: 'call'; projectId: string }
  | { kind: 'retainer'; clientId: string; fee: number };

export interface MonthLedger {
  contracts: number;
  retainers: number;
  credits: number;
  purchases: number;
  surprises: number;
  rent: number;
  food: number;
  utilities: number;
  internet: number;
  plan: number;
  unpaid: number;
}

export interface MonthStatement extends MonthLedger {
  month: number;
  interest: number;
  debtRepaid: number;
  closingCash: number;
  debt: number;
  pendingInvoices: number;
  workHours: number;
  tokensUsed: number;
  shipped: number;
}

export interface WeekLog {
  workMinutes: number;
  tokensUsed: number;
  shipped: number;
}

export interface GameState {
  version: number;
  rng: number;
  name: string;
  background: BackgroundId;
  minute: number;
  paused: boolean;
  speed: 1 | 3 | 8;

  energy: number;
  burnout: number;
  burnoutStrikes: number;
  workToday: number;
  mealsToday: number;
  fullUntil?: number | null;
  coffeesToday: number;

  plan: PlanId;
  sessionUsed: number;
  sessionStart: number | null;
  weeklyUsed: number;
  credits: number;
  promoUsedThisWeek?: boolean;

  cash: number;
  debt: number;
  invoices: Invoice[];
  ledger: MonthLedger;
  statements: MonthStatement[];
  monthWork: number;
  monthTokens: number;
  monthShipped: number;
  week: WeekLog;

  reputation: number;
  reviews: Review[];
  shipped: number;
  title: string;
  coursesDone: string[];
  coursesEnrolled: string[];
  courseMinutes: Record<string, number>;
  gear: GearId[];
  internet: InternetId;

  projects: Project[];
  offers: Offer[];
  clients: Record<string, ClientState>;
  human: HumanActivity | null;
  agents: AgentRun[];
  outageAt: number | null;
  outageUntil: number | null;

  inbox: Message[];
  nextId: number;
  unread: number;
  eventQueue: GameEventData[];
  pendingEvent: GameEventData | null;
  pendingStatement: MonthStatement | null;
  ending: EndingId | null;
  endingSeen: boolean;
  fx: string[];

  // telemetry for balance, shown nowhere in the game
  tally: Record<string, number>;
}

export type ActionResult = { ok: true } | { ok: false; reason: string };
