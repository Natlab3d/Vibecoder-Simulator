import React from 'react';
import { HelpCircle, Home, Laptop, Volume2, VolumeX } from 'lucide-react';
import { GameState } from '../game/types';
import { InteractiveTarget } from '../game/threeScene';
import {
  calendar,
  coffeeEnergy,
  dayOffMinutes,
  DAY,
  energyMax,
  HOUR,
  isTimeRunning,
  eatCooldownLeft,
  nextMealEnergy,
  rating,
  sleepMinutes,
  startBreak,
  startCoffee,
  startDayOff,
  startEat,
  startNap,
  startSleep,
  startWait,
  tokenStatus,
} from '../game/Engine';
import { clock, duration, money, tokens } from '../game/Format';
import { Act, Meter, usageTone } from './Ui';
import { TAB_BRIEFS, TabId } from './LaptopOS';

interface HUDProps {
  g: GameState;
  nearest: InteractiveTarget | null;
  laptopOpen: boolean;
  laptopTab: TabId;
  onToggleLaptop: () => void;
  onInteract: (id: InteractiveTarget['id']) => void;
  onDayOff: () => void;
  act: Act;
  onHelp: () => void;
  onMainMenu: () => void;
  muted: boolean;
  onMute: () => void;
  notice: string | null;
  children?: React.ReactNode;
}

function DayBar({ minute }: { minute: number }) {
  const at = ((minute % DAY) / DAY) * 100;
  const span = (from: number, to: number, cls: string) => (
    <div className={`absolute inset-y-0 ${cls}`} style={{ left: `${(from / 24) * 100}%`, width: `${((to - from) / 24) * 100}%` }} />
  );
  return (
    <div>
      <div className="relative h-2.5 bg-zinc-800 rounded overflow-hidden">
        {span(0, 7, 'bg-indigo-950')}
        {span(22, 24, 'bg-indigo-950')}
        {span(9, 17, 'bg-cyan-800')}
        <div className="absolute inset-y-0 w-[3px] bg-white" style={{ left: `calc(${at}% - 1px)` }} />
      </div>
      <div className="relative h-3 text-[10px] font-mono text-zinc-500">
        {[6, 9, 12, 17, 22].map((h) => (
          <span key={h} className="absolute -translate-x-1/2" style={{ left: `${(h / 24) * 100}%` }}>
            {h}
          </span>
        ))}
      </div>
    </div>
  );
}

function TimeLine({ g }: { g: GameState }) {
  const running = isTimeRunning(g);
  let text = 'Time is stopped. It only moves when something runs.';
  if (g.human) text = `${g.human.label}, ${duration(g.human.minutesLeft)} left`;
  else if (g.agents.length) {
    const left = Math.max(...g.agents.map((a) => a.minutesLeft));
    if (g.outageUntil !== null) text = 'Agent paused: no internet. Time is stopped until you act.';
    else if (!running) text = 'Agent paused: out of tokens. Time is stopped until you act.';
    else text = `Agent working, ${duration(left)} left. You are free.`;
  }
  return (
    <div className={`text-sm leading-tight mt-0.5 ${running ? 'text-cyan-200' : 'text-zinc-400'}`}>
      <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle ${running ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'}`} />
      {text}
    </div>
  );
}

function Dock({ g, act, onDayOff }: { g: GameState; act: Act; onDayOff: () => void }) {
  const sleepFor = sleepMinutes(g);
  const dayOffFor = dayOffMinutes(g);
  const eatWait = eatCooldownLeft(g);
  const hasMattress = g.gear.includes('mattress');
  const napEnergy = Math.round(25 * (hasMattress ? 1.25 : 1));
  const sleepEnergy = Math.round((sleepFor / 60) * 13 * (hasMattress ? 1.25 : 1));
  const sleepBurnout = Number(((sleepFor / 60) * 0.5).toFixed(2));

  const items = [
    {
      label: 'Eat',
      detail: eatWait > 0 ? `in ${duration(eatWait)}` : '40m',
      stats: eatWait > 0 ? 'Cooldown active (3/3 meals today)' : `+${nextMealEnergy(g)} Energy · 0% Burnout`,
      tip: eatWait > 0
        ? 'You already had 3 meals today. Wait 8 hours before cooking again.'
        : `Cook and eat a meal (40m). Meals restore +25, +20, then +10 Energy per day (${g.mealsToday}/3 eaten today).`,
      run: startEat,
      disabled: eatWait > 0,
    },
    {
      label: 'Coffee',
      detail: '10m',
      stats: `+${coffeeEnergy(g)} Energy · ${g.coffeesToday >= 1 ? '+3% Burnout (extra cup)' : '0% Burnout (1st cup free)'}`,
      tip: `Quick caffeine boost (10m). Restores +${coffeeEnergy(g)} Energy. Your first coffee each day has no side effects; every extra cup adds +3% Burnout.`,
      run: startCoffee,
    },
    {
      label: 'Break',
      detail: '30m',
      stats: '+8 Energy · -0.25% Burnout (-0.5%/h)',
      tip: 'Step away to look out the window for 30 minutes. Restores +8 Energy and reduces Burnout at the standard -0.5%/h rest rate.',
      run: startBreak,
    },
    {
      label: 'Nap',
      detail: '1h 30m',
      stats: `+${napEnergy} Energy · -0.75% Burnout (-0.5%/h)`,
      tip: 'Rest on the sofa for 1h 30m. Restores Energy and reduces Burnout at -0.5%/h while your AI agents keep working.',
      run: startNap,
    },
    {
      label: 'Sleep',
      detail: `until ${clock(g.minute + sleepFor)}`,
      stats: `+${sleepEnergy} Energy · -${sleepBurnout}% Burnout (-0.5%/h)`,
      tip: `Sleep for ${duration(sleepFor)} until ${clock(g.minute + sleepFor)}. Restores Energy and reduces Burnout at -0.5%/h. Running AI agents continue working.`,
      run: startSleep,
    },
    {
      label: 'Day off',
      detail: `until 09:00 (${duration(dayOffFor)})`,
      stats: 'Full Energy · -12% to -70% Burnout',
      tip: 'Choose an activity to unwind and disconnect. Returns you at 09:00 tomorrow morning with full Energy and reduced Burnout.',
      run: startDayOff,
      customClick: onDayOff,
    },
  ];
  const status = tokenStatus(g);
  const blocked = !!g.human;
  return (
    <div className="flex flex-wrap items-stretch gap-1.5">
      {items.map((item) => {
        const isDisabled = blocked || !!item.disabled;
        return (
          <div key={item.label} className="relative group">
            <div className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2.5 rounded-lg bg-zinc-950/95 border border-zinc-700 shadow-xl z-30 text-left">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-xs font-bold text-white">{item.label}</span>
                <span className="text-[11px] font-mono text-cyan-300">{item.detail}</span>
              </div>
              <div className="text-xs font-mono text-emerald-400 mb-1">{item.stats}</div>
              <div className="text-xs text-zinc-300 leading-snug">{item.tip}</div>
            </div>
            <button
              disabled={isDisabled}
              onClick={() => (item.customClick ? item.customClick() : act(item.run))}
              className={`px-3.5 py-2 rounded-lg border text-center transition ${
                isDisabled ? 'bg-zinc-900/60 border-zinc-800 text-zinc-600 cursor-not-allowed' : 'bg-zinc-900 border-zinc-700 text-zinc-100 hover:bg-zinc-800'
              }`}
            >
              <div className="text-sm font-semibold leading-tight whitespace-nowrap">{item.label}</div>
            </button>
          </div>
        );
      })}
      {status.sessionResetIn !== null && status.sessionLeft < status.plan.session * 0.25 && (
        <div className="relative group">
          <div className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-60 p-2.5 rounded-lg bg-zinc-950/95 border border-amber-700 shadow-xl z-30 text-left">
            <div className="text-xs font-bold text-amber-200 mb-1">Wait for tokens ({duration(status.sessionResetIn)})</div>
            <div className="text-xs text-zinc-300 leading-snug">Skip ahead until your 5-hour token window refills.</div>
          </div>
          <button
            disabled={blocked}
            onClick={() => act(startWait)}
            className={`px-3.5 py-2 rounded-lg border text-center ${blocked ? 'bg-zinc-900/60 border-zinc-800 text-zinc-600' : 'bg-amber-950 border-amber-700 text-amber-100 hover:bg-amber-900'}`}
          >
            <div className="text-sm font-semibold leading-tight whitespace-nowrap">Wait for tokens</div>
          </button>
        </div>
      )}
    </div>
  );
}

export const HUD: React.FC<HUDProps> = ({ g, nearest, laptopOpen, laptopTab, onToggleLaptop, onInteract, onDayOff, act, onHelp, onMainMenu, muted, onMute, notice, children }) => {
  const c = calendar(g.minute);
  const status = tokenStatus(g);
  const pending = g.invoices.reduce((a, i) => a + i.amount, 0);
  const max = energyMax(g);
  const burnoutTone = g.burnout >= 60 ? 'bg-red-500' : 'bg-violet-400';
  const overtime = g.workToday > 8 * HOUR;
  const sessionShare = g.sessionUsed / status.plan.session;
  const weeklyShare = g.weeklyUsed / status.plan.weekly;

  return (
    <div className="absolute inset-0 z-10 flex flex-col gap-2 p-2 md:p-3 pointer-events-none select-none">
      {/* Top: who you are, what time it is, what you have left */}
      <div className="flex flex-wrap items-stretch gap-2 pointer-events-auto interactive-ui">
        <div className="bg-zinc-950/90 border border-zinc-800 rounded-xl px-3 py-2 flex flex-col justify-center min-w-[170px]">
          <div className="text-sm font-bold text-white leading-tight whitespace-nowrap">{g.name}</div>
          <div className="text-sm text-zinc-400 whitespace-nowrap">{g.title}</div>
          <div className="text-sm font-mono text-zinc-400 whitespace-nowrap">
            <span className="text-amber-300">★ {g.reviews.length > 0 ? rating(g).toFixed(1) : '—'}</span> · {g.reputation} rep
          </div>
          <div className="text-lg font-bold font-mono text-emerald-400 leading-tight mt-0.5">{money(g.cash)}</div>
          <div className="text-sm font-mono text-zinc-500 whitespace-nowrap">
            {pending > 0 && <span className="text-emerald-300/80">{money(pending)} invoiced </span>}
            {g.debt > 0 && <span className="text-red-400">{money(g.debt)} debt</span>}
          </div>
        </div>

        <div className="bg-zinc-950/90 border border-zinc-800 rounded-xl px-3 py-2 flex-1 min-w-[260px]">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-white leading-none">{clock(g.minute)}</span>
              <span className="text-sm font-semibold text-zinc-200">{c.weekday}</span>
            </div>
            <div className="text-sm font-mono text-zinc-400 whitespace-nowrap">
              Month {c.month}, Week {c.weekOfMonth} · bills in {c.daysToMonday}d
            </div>
          </div>
          <div className="mt-1">
            <DayBar minute={g.minute} />
          </div>
          <div className="flex items-center justify-between gap-2">
            <TimeLine g={g} />
            <div className="flex items-center gap-1 shrink-0">
              <span className={`text-sm font-mono mr-1 ${overtime ? 'text-amber-300' : 'text-zinc-500'}`}>worked {duration(g.workToday)}</span>
              {([1, 3, 8] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => act((x) => void (x.speed = s))}
                  title={`Clock speed ${s}x`}
                  className={`px-1.5 py-0.5 rounded text-sm font-mono border ${g.speed === s ? 'bg-cyan-700 border-cyan-500 text-white' : 'bg-zinc-900 border-zinc-700 text-zinc-300'}`}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-zinc-950/90 border border-zinc-800 rounded-xl px-3 py-2 grid grid-cols-2 gap-x-3 gap-y-1 flex-1 min-w-[280px] max-w-[440px]">
          <Meter
            label="Energy"
            value={`${Math.round(g.energy)}/${Math.round(max)}`}
            percent={g.energy}
            tone={g.energy < 30 ? 'bg-amber-400' : 'bg-emerald-400'}
            lost={100 - max}
            lostTone={burnoutTone}
          />
          <Meter label="Burnout" value={`${Number(g.burnout.toFixed(1))}%`} percent={g.burnout} tone={burnoutTone} />
          <Meter
            label="5-hour tokens"
            value={`${tokens(g.sessionUsed)}/${tokens(status.plan.session)}`}
            percent={sessionShare * 100}
            tone={usageTone(sessionShare)}
            right={status.sessionResetIn === null ? 'window starts on first use' : `resets in ${duration(status.sessionResetIn)}`}
          />
          <Meter
            label="Weekly tokens"
            value={
              <>
                {tokens(g.weeklyUsed)}/{tokens(status.plan.weekly)}
                {g.credits > 0 && <span className="ml-1 font-bold text-amber-400">+{tokens(g.credits)}</span>}
              </>
            }
            percent={weeklyShare * 100}
            tone={usageTone(weeklyShare)}
            right={`resets in ${duration(status.weeklyResetIn)}`}
          />
        </div>
      </div>

      {/* Middle: laptop panel, or the room */}
      <div className="relative flex-1 min-h-0">
        {laptopOpen ? (
          <div className="absolute inset-0 pointer-events-auto interactive-ui">{children}</div>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="w-2 h-2 rounded-full border border-cyan-400/60 bg-cyan-400/20" />
            {nearest && !g.human && (
              <button
                onClick={() => onInteract(nearest.id)}
                className="mt-6 px-3 py-1.5 bg-zinc-950/90 border border-cyan-500/80 rounded-xl flex items-center gap-2 text-sm text-white pointer-events-auto interactive-ui"
              >
                <span className="px-1.5 bg-cyan-500 text-zinc-950 font-bold rounded font-mono">E</span>
                <span className="font-semibold">{nearest.actionText}</span>
                <span className="text-zinc-400">{nearest.name}</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Alerts that need attention */}
      <div className="flex flex-col items-center gap-1 pointer-events-none empty:hidden">
        {notice && <div className="px-3 py-1 bg-amber-950/95 border border-amber-600 rounded-lg text-amber-100 text-sm max-w-full">{notice}</div>}
        {g.outageUntil !== null && (
          <div className="px-3 py-1 bg-red-950/95 border border-red-700 rounded-lg text-red-100 text-sm max-w-full">
            Internet down for about {duration(g.outageUntil - g.minute)}. Agents are paused. Plan, tests, hand-coding and study still work.
          </div>
        )}
        {g.burnout >= 60 && (
          <div className="px-3 py-1 bg-red-950/95 border border-red-700 rounded-lg text-red-100 text-sm max-w-full">
            Burned out: work is slower and buggier. Take a day off, or you will collapse at 100%.
          </div>
        )}
        {g.energy < 30 && !g.human && (
          <div className="px-3 py-1 bg-amber-950/95 border border-amber-700 rounded-lg text-amber-100 text-sm max-w-full">Low energy: you make more mistakes. Eat or sleep. At 0 you pass out.</div>
        )}
        {laptopOpen && !notice && <div className="px-3 py-1 bg-zinc-950/90 border border-cyan-800 rounded-lg text-cyan-100 text-sm max-w-full">{TAB_BRIEFS[laptopTab]}</div>}
      </div>

      {/* Bottom: your own actions */}
      <div className="flex flex-wrap items-center justify-between gap-2 pointer-events-auto interactive-ui">
        <button
          onClick={onToggleLaptop}
          className="flex items-center gap-2 px-3 py-2 bg-cyan-700 hover:bg-cyan-600 border border-cyan-500 text-white text-sm font-semibold rounded-lg whitespace-nowrap"
        >
          <Laptop size={15} />
          {laptopOpen ? 'Leave the desk [Tab]' : 'Open laptop [Tab]'}
          {g.unread > 0 && !laptopOpen && <span className="px-1.5 rounded-full bg-white text-zinc-900 text-sm font-bold">{g.unread}</span>}
        </button>
        <Dock g={g} act={act} onDayOff={onDayOff} />
        <div className="flex items-center gap-1">
          <button onClick={onMute} title="Sound" className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300">
            {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </button>
          <button onClick={onHelp} title="How to play" className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300">
            <HelpCircle size={14} />
          </button>
          <button
            onClick={onMainMenu}
            title="Save and return to Main Menu"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm font-semibold whitespace-nowrap"
          >
            <Home size={14} />
            Main menu
          </button>
        </div>
      </div>
    </div>
  );
};
