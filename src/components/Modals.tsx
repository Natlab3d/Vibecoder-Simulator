import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { RotateCcw, Sparkles, X } from 'lucide-react';
import { BackgroundId, GameEventData, GameState, MonthStatement } from '../game/types';
import { BACKGROUNDS, CLIENTS, DAY_OFF_ACTIVITIES, DayOffActivity } from '../game/Content';
import { calendar, dayOffMinutes, OVERDRAFT_LIMIT, rating } from '../game/Engine';
import { money, tokens } from '../game/Format';
import { sound } from '../game/audio';
import { Row } from './Ui';

const Backdrop: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="absolute inset-0 z-40 bg-black/75 flex items-center justify-center p-3 md:p-6 select-none interactive-ui">
    <div className="bg-zinc-950 border border-zinc-800 rounded-xl max-w-lg w-full max-h-full overflow-y-auto p-5 text-zinc-200 shadow-2xl">{children}</div>
  </div>
);

export const TitleScreen: React.FC<{ canContinue: boolean; onContinue: () => void; onNew: () => void; onHelp: () => void }> = ({ canContinue, onContinue, onNew, onHelp }) => (
  <div className="absolute inset-0 z-30 bg-gradient-to-t from-zinc-950/95 via-zinc-950/60 to-zinc-950/85 flex flex-col justify-center p-6 md:p-14 select-none interactive-ui">
    <div className="max-w-xl">
      <h1 className="text-5xl md:text-6xl font-extrabold text-white tracking-tight">
VIBE<span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">CODER SIMULATOR</span>
      </h1>
      <p className="text-lg text-zinc-200 mt-2">A solo freelancer, one AI agent, and never enough tokens.</p>
      <p className="text-sm text-zinc-400 mt-3 leading-relaxed">
        Take jobs, direct your agent, test what it builds and deliver before the deadline. Tokens run out, rent comes due, and your own energy is limited. Climb from micro-gigs to the frontier lab contract and
        become <strong className="text-white">Chief AI Architect</strong>.
      </p>
      <div className="flex flex-wrap gap-3 mt-6">
        {canContinue && (
          <button onClick={onContinue} className="px-6 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-xl">
            Continue career
          </button>
        )}
        <button onClick={onNew} className={`px-6 py-3 font-bold rounded-xl ${canContinue ? 'bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700' : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white'}`}>
          New career
        </button>
        <button onClick={onHelp} className="px-5 py-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 rounded-xl">
          How it works
        </button>
      </div>
    </div>
  </div>
);

export const CreateCareer: React.FC<{ onStart: (name: string, background: BackgroundId) => void; onBack: () => void }> = ({ onStart, onBack }) => {
  const [name, setName] = useState('');
  const [step, setStep] = useState<'name' | 'difficulty'>('name');
  const [background, setBackground] = useState<BackgroundId>('developer');

  if (step === 'name') {
    return (
      <Backdrop>
        <h2 className="text-xl font-bold text-white mb-1">Who are you?</h2>
        <p className="text-sm text-zinc-400 mb-3">Enter your name to begin a new career.</p>
        <label className="text-sm text-zinc-400 block">
          Your name
          <input
            autoFocus
            value={name}
            maxLength={24}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setStep('difficulty');
            }}
            placeholder="Freelancer"
            className="mt-1 mb-3 w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-white text-sm outline-none focus:border-cyan-500"
          />
        </label>
        <div className="flex gap-2 mt-2">
          <button onClick={() => setStep('difficulty')} className="flex-1 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg">
            Continue
          </button>
          <button onClick={onBack} className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg">
            Back
          </button>
        </div>
      </Backdrop>
    );
  }

  return (
    <Backdrop>
      <h2 className="text-xl font-bold text-white">Choose your career</h2>
      <p className="text-sm text-zinc-400 mb-3">This changes how your whole career plays.</p>
      <div className="space-y-2">
        {(Object.keys(BACKGROUNDS) as BackgroundId[]).map((id) => {
          const b = BACKGROUNDS[id];
          return (
            <button
              key={id}
              onClick={() => setBackground(id)}
              className={`w-full text-left p-3 rounded-lg border ${background === id ? 'border-cyan-500 bg-cyan-950/40' : 'border-zinc-800 bg-zinc-900 hover:border-zinc-600'}`}
            >
              <div className="flex justify-between gap-2">
                <span className="font-bold text-white text-sm">{b.label}</span>
                <span className="font-mono text-amber-300 text-sm">{money(b.rent)}/wk rent</span>
              </div>
              <div className="text-sm text-zinc-400">{b.blurb}</div>
              <div className="text-sm text-cyan-300 mt-1">{b.perks.join(' · ')}</div>
            </button>
          );
        })}
      </div>
      <div className="flex gap-2 mt-4">
        <button onClick={() => onStart(name, background)} className="flex-1 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg">
          Start on Monday morning
        </button>
        <button onClick={() => setStep('name')} className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg">
          Back
        </button>
      </div>
    </Backdrop>
  );
};

export const HelpModal: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <Backdrop>
    <div className="flex items-center justify-between pb-2 border-b border-zinc-800 mb-3">
      <h3 className="text-base font-bold text-white">How it works</h3>
      <button onClick={onClose} className="text-zinc-400 hover:text-white" aria-label="Close">
        <X size={18} />
      </button>
    </div>
    <div className="space-y-2.5 text-sm leading-relaxed text-zinc-300">
      <p>
        <strong className="text-white">Time</strong> moves only while something runs. Walk around your apartment or read and plan on your laptop as long as you like. Every action shows its cost in clock time before you commit. Use 1x, 3x, or 8x to change speed.
      </p>
      <p>
        <strong className="text-white">A job</strong>: pick a contract and an approach in the Market (fewer tasks with higher bug risk, or more tasks with lower bug risk). Write the plan, send the agent to build tasks, test its work, fix the bugs, and deliver before the deadline.
      </p>
      <p>
        <strong className="text-white">Your agent</strong> works in the background while you eat, study, or sleep. You only spend 20 minutes writing the prompt. Choose a model and a run size: Spark (cheap and sloppy), Core (balanced), or Apex (careful and expensive).
      </p>
      <p>
        <strong className="text-white">Tokens</strong>: a 5-hour window starts on your first run, plus a weekly quota. When they run out you can wait for the window to reset, buy a credit pack, upgrade your AI plan, or code by hand.
      </p>
      <p>
        <strong className="text-white">You</strong>: energy drains as you work. Food, coffee, breaks, naps, and sleep restore it. Working past 8 hours a day, working late at night (22:00–06:00), or drinking extra coffee builds burnout. Resting reduces burnout at 0.5% per hour, or you can take a Day Off (via the bottom bar or the Front Door) for a bigger reset.
      </p>
      <p>
        <strong className="text-white">Money & Career</strong>: every Monday clients pay for delivered jobs and weekly bills are charged. Unlock higher contract tiers by earning reputation and completing Academy courses. Debt above {money(OVERDRAFT_LIMIT)} at month end means bankruptcy.
      </p>
      <p className="font-mono text-sm text-zinc-400">WASD walk · mouse drag look · E interact · Tab or Space laptop · 1 2 3 speed</p>
    </div>
    <button onClick={onClose} className="mt-4 w-full py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-lg">
      Got it
    </button>
  </Backdrop>
);

function StatementRows({ s }: { s: MonthStatement }) {
  const bills = s.rent + s.food + s.utilities + s.internet + s.plan;
  const income = s.contracts + s.retainers;
  const profit = income - bills - s.interest - s.surprises - s.credits;
  return (
    <div className="border border-zinc-800 rounded-lg overflow-hidden divide-y divide-zinc-800">
      <Row label="Contract payments" value={`+${money(s.contracts)}`} tone="text-emerald-400" />
      <Row label="Retainers" value={`+${money(s.retainers)}`} tone="text-emerald-400" />
      <Row label="Rent" value={money(-s.rent)} />
      <Row label="Food and utilities" value={money(-(s.food + s.utilities))} />
      <Row label="Internet and AI plan" value={money(-(s.internet + s.plan))} />
      <Row label="Token credits" value={money(-s.credits)} />
      <Row label="Unexpected expenses" value={money(-s.surprises)} />
      <Row label="Debt interest" value={money(-s.interest)} />
      <Row label="Operating profit" value={money(profit)} tone={profit >= 0 ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'} />
      <Row label="Courses, gear, plans & days off" value={money(-s.purchases)} />
      {s.debtRepaid > 0 && <Row label="Debt repaid" value={money(-s.debtRepaid)} tone="text-amber-300" />}
      <Row label="Closing cash" value={money(s.closingCash)} tone="text-white font-bold" />
      <Row label="Still to be paid to you" value={money(s.pendingInvoices)} />
      <Row label="Debt" value={money(s.debt)} tone={s.debt > 0 ? 'text-red-400 font-bold' : undefined} />
      <Row label="Worked, shipped, tokens" value={`${s.workHours}h, ${s.shipped} jobs, ${tokens(s.tokensUsed)}`} />
    </div>
  );
}

export const StatementModal: React.FC<{ statement: MonthStatement; onClose: () => void }> = ({ statement, onClose }) => (
  <Backdrop>
    <h3 className="text-base font-bold text-white">Month {statement.month} statement</h3>
    <p className="text-sm text-zinc-400 mb-3">Your last four weeks.</p>
    <StatementRows s={statement} />
    {statement.debt > 0 && <p className="mt-2 text-sm text-amber-300">Debt grows 5% a month. Above {money(OVERDRAFT_LIMIT)} you go bankrupt.</p>}
    <button onClick={onClose} className="mt-4 w-full py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-lg">
      Start month {statement.month + 1}
    </button>
  </Backdrop>
);

function eventText(e: GameEventData, g: GameState) {
  if (e.kind === 'retainer') {
    return {
      title: `${CLIENTS[e.clientId]?.name} wants a retainer`,
      body: `They offer ${money(e.fee)} a month. In exchange you deliver one maintenance ticket each month. Miss one and they leave.`,
      yes: 'Sign the retainer',
      no: 'No thanks',
    };
  }
  const p = g.projects.find((x) => x.id === e.projectId);
  if (e.kind === 'scope') {
    return {
      title: 'Scope creep',
      body: `${CLIENTS[p?.clientId ?? '']?.name} wants ${e.addTasks} more tasks on "${p?.title}". They offer ${money(e.addFee)} more and one extra day.`,
      yes: 'Accept the extra work',
      no: 'Stick to the original scope',
    };
  }
  return {
    title: 'Client call',
    body: `${CLIENTS[p?.clientId ?? '']?.name} wants a one-hour call about "${p?.title}". It clarifies requirements and adds to your plan. Refusing looks bad.`,
    yes: 'Take the call',
    no: 'Decline',
  };
}

export const EventModal: React.FC<{ g: GameState; onAnswer: (accept: boolean) => void }> = ({ g, onAnswer }) => {
  const text = eventText(g.pendingEvent!, g);
  return (
    <Backdrop>
      <h3 className="text-base font-bold text-white mb-1">{text.title}</h3>
      <p className="text-sm text-zinc-300">{text.body}</p>
      <div className="flex flex-wrap gap-2 mt-4">
        <button onClick={() => onAnswer(true)} className="flex-1 py-2.5 px-3 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-lg text-sm">
          {text.yes}
        </button>
        <button onClick={() => onAnswer(false)} className="flex-1 py-2.5 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-sm">
          {text.no}
        </button>
      </div>
    </Backdrop>
  );
};

export const EndingModal: React.FC<{ g: GameState; onContinue: () => void; onRestart: () => void }> = ({ g, onContinue, onRestart }) => {
  const won = g.ending === 'architect';
  useEffect(() => {
    if (won) {
      sound.playVictory();
      confetti({ particleCount: 180, spread: 90, origin: { y: 0.6 } });
    }
  }, [won]);
  const days = Math.floor(g.minute / 1440);
  const copy = {
    architect: { title: 'Chief AI Architect', tone: 'text-emerald-400', body: 'You shipped the frontier contract. From a free plan and a rented room to the top of the field.' },
    bankrupt: { title: 'Bankrupt', tone: 'text-red-400', body: `Your debt passed ${money(OVERDRAFT_LIMIT)}. The bank closed your account.` },
    burnout: { title: 'Burned out', tone: 'text-red-400', body: 'A second collapse. The doctor ordered you to leave the industry for good.' },
  }[g.ending!];
  return (
    <Backdrop>
      <h3 className={`text-2xl font-extrabold ${copy.tone}`}>{copy.title}</h3>
      <p className="text-sm text-zinc-300 mt-1">{copy.body}</p>
      <div className="border border-zinc-800 rounded-lg overflow-hidden divide-y divide-zinc-800 mt-3">
        <Row label="Days survived" value={String(days)} />
        <Row label="Jobs shipped" value={String(g.shipped)} />
        <Row label="Rating" value={g.reviews.length > 0 ? rating(g).toFixed(1) : '—'} />
        <Row label="Reputation" value={String(g.reputation)} />
        <Row label="Cash" value={money(g.cash)} />
      </div>
      <div className="flex gap-2 mt-4">
        {won && (
          <button onClick={onContinue} className="flex-1 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-bold rounded-lg flex items-center justify-center gap-2">
            <Sparkles size={16} /> Keep freelancing
          </button>
        )}
        <button onClick={onRestart} className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700 rounded-lg flex items-center justify-center gap-2">
          <RotateCcw size={16} /> New career
        </button>
      </div>
    </Backdrop>
  );
};

export const DayOffModal: React.FC<{ g: GameState; onSelect: (activity: DayOffActivity) => void; onClose: () => void }> = ({ g, onSelect, onClose }) => {
  const returnAt = g.minute + dayOffMinutes(g);
  const ret = calendar(returnAt);
  return (
    <Backdrop>
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-lg font-bold text-white">Take a Day Off</h3>
        <button onClick={onClose} className="p-1 text-zinc-400 hover:text-white">
          <X size={18} />
        </button>
      </div>
      <p className="text-sm text-zinc-400 mb-3">Step away from the screen and recharge. How would you like to spend your time off?</p>
      <div className="space-y-2">
        {DAY_OFF_ACTIVITIES.map((act) => {
          const canAfford = g.cash >= act.price;
          return (
            <button
              key={act.id}
              disabled={!canAfford}
              onClick={() => onSelect(act)}
              className={`w-full text-left p-3 rounded-lg border transition flex items-center justify-between gap-3 ${
                canAfford
                  ? 'bg-zinc-900/90 border-zinc-700 hover:border-cyan-500 hover:bg-zinc-900'
                  : 'bg-zinc-900/40 border-zinc-800/80 opacity-50 cursor-not-allowed'
              }`}
            >
              <div className="min-w-0">
                <div className="text-sm font-bold text-white">{act.label}</div>
                <div className="text-xs text-zinc-400 mt-0.5">{act.blurb}</div>
                <div className="text-xs font-mono text-emerald-400 mt-1">
                  -{act.burnoutRelief}% Burnout · Full Energy
                </div>
              </div>
              <div className="shrink-0 text-right">
                <span className={`text-sm font-mono font-bold px-2.5 py-1 rounded-md border ${
                  act.price === 0
                    ? 'bg-zinc-800 border-zinc-700 text-zinc-200'
                    : canAfford
                      ? 'bg-cyan-950/80 border-cyan-700 text-cyan-200'
                      : 'bg-red-950/60 border-red-800 text-red-300'
                }`}>
                  {act.price === 0 ? 'Free' : money(act.price)}
                </span>
              </div>
            </button>
          );
        })}
      </div>
      <div className="mt-3 px-3 py-2 rounded-lg bg-zinc-900/80 border border-zinc-800 text-xs font-mono text-cyan-200 text-center">
        You will come back at 09:00 on {ret.weekday}, Month {ret.month}, Week {ret.weekOfMonth} (Day {ret.day}).
      </div>
    </Backdrop>
  );
};
