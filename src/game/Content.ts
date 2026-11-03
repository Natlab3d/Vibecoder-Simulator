import { Approach, BackgroundId, BatchId, GearId, InternetId, JobTemplate, ModelId, PlanId, Tier } from './types';

export const BACKGROUNDS: Record<BackgroundId, { label: string; blurb: string; perks: string[]; cash: number; rent: number }> = {
  developer: {
    label: 'Laid-off developer',
    blurb: 'Ten years of real code, one surprise layoff. You trust your hands more than the model.',
    perks: ['Hand-coding is 30% faster', 'Tests find more bugs', 'Standard contract pay (Easy)'],
    cash: 0,
    rent: 225,
  },
  marketer: {
    label: 'Marketer turned prompter',
    blurb: 'You never learned to code, but you can talk a model into anything.',
    perks: ['1st token pack each week is half price ($25)', 'Client pay -10% (Medium)', 'Hand-coding is slower & buggier · Courses take 20% longer'],
    cash: 0,
    rent: 225,
  },
  student: {
    label: 'Broke student',
    blurb: 'A shared flat, instant noodles, and a lot of free evenings to learn.',
    perks: ['Courses take 15% less time', 'Client pay -15% (Hard)', 'AI runs are 25% slower and use 20% more tokens'],
    cash: 0,
    rent: 225,
  },
};

export const MODELS: Record<ModelId, { label: string; blurb: string; tokens: number; time: number; bugs: number; fixRate: number; regress: number }> = {
  spark: { label: 'Spark', blurb: 'Cheap and fast, sloppy', tokens: 0.4, time: 0.6, bugs: 1.7, fixRate: 0.65, regress: 0.25 },
  core: { label: 'Core', blurb: 'The balanced default', tokens: 1, time: 1, bugs: 1, fixRate: 0.85, regress: 0.1 },
  apex: { label: 'Apex', blurb: 'Careful, slow, expensive', tokens: 2.5, time: 1.5, bugs: 0.45, fixRate: 0.97, regress: 0.03 },
};

export const BATCHES: Record<BatchId, { label: string; blurb: string; hours: number; bugs: number }> = {
  small: { label: 'Small', blurb: 'About 1 hour of agent work, tight control', hours: 1, bugs: 0.8 },
  medium: { label: 'Medium', blurb: 'About 2 hours of agent work', hours: 2, bugs: 1 },
  large: { label: 'Large', blurb: 'About 4 hours unattended, more bugs', hours: 4, bugs: 1.4 },
};

export const PLANS: Record<PlanId, { label: string; price: number; session: number; weekly: number; agents: number; blurb: string }> = {
  free: { label: 'Free', price: 0, session: 20, weekly: 80, agents: 1, blurb: 'Enough to learn on.' },
  pro: { label: 'Pro', price: 30, session: 50, weekly: 250, agents: 1, blurb: 'A working freelancer.' },
  max: { label: 'Max', price: 110, session: 120, weekly: 700, agents: 2, blurb: 'Run two agents at once.' },
  ultra: { label: 'Ultra', price: 375, session: 350, weekly: 2000, agents: 3, blurb: 'Three agents, huge quotas.' },
};

export const CREDIT_PACK = { tokens: 25, price: 50 };

export const INTERNET: Record<InternetId, { label: string; price: number; blurb: string; outageChance: number; outageHours: [number, number] }> = {
  basic: { label: 'Basic broadband', price: 15, blurb: 'Budget Wi-Fi. Drops out about once a week for several hours.', outageChance: 0.15, outageHours: [3, 8] },
  fiber: { label: 'Fiber with 5G backup', price: 35, blurb: 'High-speed fiber. Outages are rare and short (1-2h).', outageChance: 0.02, outageHours: [1, 2] },
};

export const GEAR: Record<GearId, { label: string; price: number; blurb: string; icon: string }> = {
  monitor: { label: 'Second Monitor', price: 450, icon: '', blurb: 'Testing is 25% faster and finds more bugs.' },
  chair: { label: 'Ergonomic Chair', price: 700, icon: '', blurb: 'Work costs 20% less energy.' },
  espresso: { label: 'Espresso Machine', price: 900, icon: '', blurb: 'Coffee restores 25 energy instead of 15.' },
  mattress: { label: 'Memory Foam Mattress', price: 1100, icon: '', blurb: 'Sleep restores 25% more energy.' },
  workstation: { label: 'Silicon Pro Workstation', price: 3200, icon: '', blurb: 'Hand-coding and testing are 25% faster. Agent runs are 15% faster.' },
};

export interface DayOffActivity {
  id: string;
  label: string;
  price: number;
  burnoutRelief: number;
  blurb: string;
}

export const DAY_OFF_ACTIVITIES: DayOffActivity[] = [
  { id: 'park', label: 'Walk in the park & read', price: 0, burnoutRelief: 12, blurb: 'Fresh air, a bench in the shade, and no screens.' },
  { id: 'hike', label: 'Go for a hike', price: 25, burnoutRelief: 18, blurb: 'Train ticket out to the hills and a trail lunch.' },
  { id: 'sport', label: 'Do some sport & sauna', price: 55, burnoutRelief: 25, blurb: 'Full workout session followed by a long steam.' },
  { id: 'cinema', label: 'Cinema & dinner with friends', price: 95, burnoutRelief: 35, blurb: 'Good food, a movie, and catching up offline.' },
  { id: 'city', label: 'Visit another city', price: 180, burnoutRelief: 50, blurb: 'Day trip by fast train, museums, and local cafés.' },
  { id: 'spa', label: 'Spa & thermal resort', price: 320, burnoutRelief: 70, blurb: 'Hot springs, massage, and total disconnection.' },
];

export interface Course {
  id: string;
  title: string;
  provider: string;
  cost: number;
  hours: number;
  icon: string;
  perk: string;
  description: string;
  unlocksTier: Tier | null;
  repBonus: number;
}

export const COURSES: Course[] = [
  {
    id: 'prompt_101',
    title: 'Prompt Engineering & System Personas',
    provider: 'DeepLearning.academy',
    cost: 160,
    hours: 6,
    icon: '',
    perk: 'AI runs create 15% fewer bugs, +25 reputation',
    description: 'Few-shot prompting, delimiters, persona framing and structured output.',
    unlocksTier: null,
    repBonus: 25,
  },
  {
    id: 'rag_basics',
    title: 'Vector Databases & Production RAG',
    provider: 'VectorCamp',
    cost: 580,
    hours: 12,
    icon: '',
    perk: 'Unlocks Tier 2 startup jobs, +52 reputation',
    description: 'Embeddings, chunking strategies, index tuning and re-ranking.',
    unlocksTier: 2,
    repBonus: 52,
  },
  {
    id: 'agents_orchestration',
    title: 'Autonomous Multi-Agent Systems',
    provider: 'Swarm Intelligence Lab',
    cost: 2400,
    hours: 24,
    icon: '',
    perk: 'Unlocks Tier 3 scale-up jobs, +208 reputation',
    description: 'Agent graphs with memory, tool-calling loops and human checkpoints.',
    unlocksTier: 3,
    repBonus: 208,
  },
  {
    id: 'gpu_kernel_tuning',
    title: 'Kernel Tuning & Model Quantization',
    provider: 'Silicon Valley Compute Institute',
    cost: 8500,
    hours: 40,
    icon: '',
    perk: 'Unlocks Tier 4 enterprise jobs, AI runs use 15% fewer tokens, +440 reputation',
    description: 'Custom kernels, attention optimisation and 4-bit quantization.',
    unlocksTier: 4,
    repBonus: 440,
  },
  {
    id: 'frontier_safety',
    title: 'Frontier AI Reasoning & Superalignment',
    provider: 'International Institute of AGI Safety',
    cost: 28000,
    hours: 60,
    icon: '',
    perk: 'Unlocks the Frontier Lab contract, +550 reputation',
    description: 'Scalable oversight, interpretability and provable safety.',
    unlocksTier: 5,
    repBonus: 550,
  },
];

export const TIER_INFO: Record<Tier, { name: string; rep: number; course: string | null; tokensPerTask: number; taskMinutes: number; qualityBar: number; repWeight: number }> = {
  1: { name: 'Micro-Gig', rep: 0, course: null, tokensPerTask: 3, taskMinutes: 30, qualityBar: 60, repWeight: 10 },
  2: { name: 'Startup MVP', rep: 260, course: 'rag_basics', tokensPerTask: 6, taskMinutes: 40, qualityBar: 70, repWeight: 25 },
  3: { name: 'Scale-Up', rep: 1300, course: 'agents_orchestration', tokensPerTask: 12, taskMinutes: 50, qualityBar: 75, repWeight: 50 },
  4: { name: 'Enterprise', rep: 3500, course: 'gpu_kernel_tuning', tokensPerTask: 20, taskMinutes: 60, qualityBar: 80, repWeight: 90 },
  5: { name: 'Frontier Lab', rep: 6250, course: 'frontier_safety', tokensPerTask: 30, taskMinutes: 60, qualityBar: 90, repWeight: 200 },
};

export const CLIENTS: Record<string, { name: string; avatar: string }> = {
  buzztech: { name: 'BuzzTech Media', avatar: '' },
  ledgerleaf: { name: 'LedgerLeaf Bookkeeping', avatar: '' },
  indieapp: { name: 'IndieApp Co', avatar: '' },
  petpals: { name: 'PetPals Vet Clinics', avatar: '' },
  bistro: { name: 'Bistro Nine Group', avatar: '' },
  hyperflow: { name: 'HyperFlow SaaS', avatar: '' },
  devzen: { name: 'DevZen Code Studio', avatar: '' },
  medibook: { name: 'MediBook Health', avatar: '' },
  venturescale: { name: 'VentureScale AI', avatar: '' },
  cloudscale: { name: 'CloudScale Logistics', avatar: '' },
  northbank: { name: 'Northbank Fintech', avatar: '' },
  sterling: { name: 'Sterling & Croft Global Law', avatar: '' },
  aerospace: { name: 'AeroSpace Dynamics', avatar: '' },
  omnimind: { name: 'OmniMind Frontier Labs', avatar: '' },
};

const pair = (quick: string, quickDesc: string, safe: string, safeDesc: string, bugsQuick = 1.3, bugsSafe = 0.75): [Approach, Approach] => [
  { label: quick, description: quickDesc, scope: 0.85, bugs: bugsQuick },
  { label: safe, description: safeDesc, scope: 1.1, bugs: bugsSafe },
];

export const JOBS: JobTemplate[] = [
  {
    id: 'seo', tier: 1, title: 'Generate 20 SEO Tech Articles', clientId: 'buzztech', complexity: 1, fee: 120, tasks: 8,
    description: 'Generate 20 technical summaries on AI tooling without hallucinations or repeated buzzwords.',
    approaches: pair('Zero-Shot Prompts', 'Fewer steps, prone to generic slop.', 'Few-Shot Structured Output', 'More setup, schemas keep the facts clean.'),
  },
  {
    id: 'invoices', tier: 1, title: 'Clean & Parse Messy Invoice PDFs', clientId: 'ledgerleaf', complexity: 1, fee: 170, tasks: 11,
    description: 'Extract structured tables from scrambled scanned receipts.',
    approaches: pair('Regex + Raw LLM Dump', 'Quick to wire up, occasional format glitches.', 'JSON Schema Validation', 'More work, strict types catch bad rows.'),
  },
  {
    id: 'discord', tier: 1, title: 'Fix Leaky Discord Support Bot', clientId: 'indieapp', complexity: 2, fee: 210, tasks: 12,
    description: 'The bot leaks company secrets when told to ignore its instructions. Add real guardrails.',
    approaches: pair('Heuristic Blacklist Filter', 'String matching for known jailbreaks.', 'Dual-Model Validator', 'A second model screens inputs and outputs.'),
  },
  {
    id: 'faqbot', tier: 1, title: 'Appointment FAQ Chatbot', clientId: 'petpals', complexity: 1, fee: 140, tasks: 9,
    description: 'A friendly assistant that answers opening hours, prices and vaccination questions.',
    approaches: pair('Prompt-Stuffed FAQ', 'Paste everything into the system prompt.', 'Small Retrieval Layer', 'Look answers up before responding.'),
  },
  {
    id: 'menu', tier: 1, title: 'Menu Translation Pipeline', clientId: 'bistro', complexity: 1, fee: 130, tasks: 8,
    description: 'Translate seasonal menus into four languages while keeping dish names intact.',
    approaches: pair('Bulk Translate', 'One prompt per menu, hope for the best.', 'Glossary-Locked Translate', 'Enforced glossary per language.'),
  },
  {
    id: 'emails', tier: 1, title: 'Support Inbox Triage Script', clientId: 'indieapp', complexity: 2, fee: 190, tasks: 11,
    description: 'Tag and route incoming support emails with a confidence score.',
    approaches: pair('Keyword Router', 'Fast rules with an LLM fallback.', 'Few-Shot Classifier', 'Labelled examples and a review queue.'),
  },
  {
    id: 'rag', tier: 2, title: 'Vector Search FAQ with RAG', clientId: 'hyperflow', complexity: 2, fee: 380, tasks: 18,
    description: 'Answer customer questions from their knowledge base with zero made-up answers.',
    approaches: pair('Naive Cosine Chunking', 'Quick retrieval, may slice sentences midway.', 'Hierarchical Chunking', 'Stores summaries alongside granular chunks.'),
  },
  {
    id: 'copilot', tier: 2, title: 'Streaming React AI Copilot', clientId: 'devzen', complexity: 3, fee: 520, tasks: 24,
    description: 'Server-sent streaming with live markdown and code highlighting in the browser.',
    approaches: pair('Fast Token Stream Pipe', 'Raw chunks with minimal backpressure.', 'Buffering AST Formatter', 'Code blocks close cleanly on hiccups.'),
  },
  {
    id: 'clinic', tier: 2, title: 'Patient Intake Summariser', clientId: 'medibook', complexity: 2, fee: 430, tasks: 20,
    description: 'Summarise long intake forms for doctors, with PII redaction.',
    approaches: pair('Regex Redaction', 'Quick, misses unusual formats.', 'Named Entity Pipeline', 'Slower, far more thorough redaction.'),
  },
  {
    id: 'dashboards', tier: 2, title: 'Natural-Language Dashboards', clientId: 'hyperflow', complexity: 3, fee: 480, tasks: 22,
    description: 'Let customers ask questions of their analytics in plain English.',
    approaches: pair('Direct Text-to-SQL', 'Works on the demo, risky in the wild.', 'Semantic Layer + Validation', 'Queries pass through a checked schema.'),
  },
  {
    id: 'swarm', tier: 3, title: 'Multi-Agent Market Analyst', clientId: 'venturescale', complexity: 3, fee: 1000, tasks: 32,
    description: 'A four-agent swarm that drafts 30-page due diligence reports.',
    approaches: pair('Linear Round-Robin', 'Sequential agents, moderate verification.', 'Self-Reflecting Swarm', 'Agents debate and cross-check citations.'),
  },
  {
    id: 'cache', tier: 3, title: 'Vector Cache & Token Optimisation', clientId: 'cloudscale', complexity: 4, fee: 1350, tasks: 38,
    description: 'Their LLM bill is exploding. Slash repeated queries with semantic caching.',
    approaches: pair('Redis Distance Cache', 'Fast lookup on similarity score.', 'Adaptive Model Routing', 'Routes queries and compresses history.'),
  },
  {
    id: 'kyc', tier: 3, title: 'KYC Document Review Agent', clientId: 'northbank', complexity: 3, fee: 1100, tasks: 34,
    description: 'Check identity documents against policy with a full audit trail.',
    approaches: pair('Single-Pass Extraction', 'One model, one pass.', 'Two-Step Human Review', 'Flagged cases route to staff with evidence.'),
  },
  {
    id: 'routing', tier: 3, title: 'Fleet Routing Copilot', clientId: 'cloudscale', complexity: 4, fee: 1250, tasks: 36,
    description: 'Dispatchers ask for re-routes in plain language and get checked plans.',
    approaches: pair('LLM Plans Directly', 'Quick, occasionally impossible routes.', 'Solver-Verified Plans', 'A solver validates every suggestion.'),
  },
  {
    id: 'legal', tier: 4, title: 'Private Fine-Tuned Legal Model', clientId: 'sterling', complexity: 4, fee: 2400, tasks: 52,
    description: 'Fine-tune an open-weights model on merger documents with zero data leaving the VPC.',
    approaches: pair('4-bit Quantized Tuning', 'Fits on cheaper GPUs, slight quality loss.', 'Full Precision + Alignment', 'State-of-the-art legal reasoning.'),
  },
  {
    id: 'codereview', tier: 4, title: 'Autonomous Code Review Pipeline', clientId: 'aerospace', complexity: 5, fee: 3700, tasks: 68,
    description: 'Scan 500 PRs a day for memory leaks, race conditions and weak crypto.',
    approaches: pair('Multi-Pass Static Analysis', 'High throughput, catches the common cases.', 'Formal Verification Engine', 'Proves invariants and writes regression suites.'),
  },
  {
    id: 'fraud', tier: 4, title: 'Real-Time Fraud Explainer', clientId: 'northbank', complexity: 4, fee: 3000, tasks: 58,
    description: 'Explain every blocked payment to regulators in seconds.',
    approaches: pair('Post-Hoc Explanations', 'Bolted on after the model decides.', 'Traceable Decision Graph', 'Every decision is reconstructable.'),
  },
  {
    id: 'frontier', tier: 5, title: 'Frontier Lab: Next-Gen Reasoning Engine', clientId: 'omnimind', complexity: 5, fee: 30000, tasks: 110,
    description: 'The holy grail. A self-improving reasoning system. Ship it at their quality bar to become Chief AI Architect.',
    approaches: pair('Iterative Self-Play', 'Scales test-time compute with theorem checkers.', 'Formal Bounds Search', 'Deep reasoning tree with provable guarantees.', 1.2, 0.7),
  },
];

export const TITLES: { rep: number; title: string }[] = [
  { rep: 6000, title: 'Principal Frontier Architect' },
  { rep: 3500, title: 'Enterprise AI Consultant' },
  { rep: 1300, title: 'Full-Stack Agent Dev' },
  { rep: 260, title: 'Freelance AI Tinkerer' },
  { rep: 0, title: 'Junior Prompt Novice' },
];

export const SURPRISES: { label: string; amount: number }[] = [
  { label: 'Laptop repair', amount: 140 },
  { label: 'Accounting software renewal', amount: 60 },
  { label: 'Tax filing fee', amount: 110 },
  { label: 'Dentist appointment', amount: 180 },
  { label: 'Replacement charger', amount: 45 },
];

export const REVIEW_TEXT: Record<number, string[]> = {
  5: ['Flawless delivery, will hire again.', 'Exactly what we needed.', 'Solid engineering, no drama.'],
  4: ['Good work, minor polish needed.', 'Reliable, clear communication.', 'Happy overall, a small bug or two.'],
  3: ['Acceptable, but it needed revisions.', 'Average output. Met the brief, barely.'],
  2: ['Too many errors. Required heavy rework.', 'Disappointing quality.'],
  1: ['Unusable deliverable. Avoid.', 'Wasted our budget.'],
};
