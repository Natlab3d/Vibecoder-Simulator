import React from 'react';
import { ActionResult, GameState } from '../game/types';

export type Act = (fn: (g: GameState) => ActionResult | void) => void;

export function Meter({ label, value, right, percent, tone, lost = 0, lostTone }: { label: string; value?: React.ReactNode; right?: string; percent: number; tone: string; lost?: number; lostTone?: string }) {
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2 text-xs font-mono leading-tight">
        <span className="text-zinc-400 whitespace-nowrap overflow-hidden text-ellipsis">{label}</span>
        {value && <span className="text-zinc-100 whitespace-nowrap font-semibold">{value}</span>}
      </div>
      <div className="relative mt-1 h-1.5 bg-zinc-800 rounded overflow-hidden">
        <div className={`h-full rounded transition-all duration-300 ${tone}`} style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} />
        {lost > 0 && <div className={`absolute inset-y-0 right-0 transition-all duration-300 ${lostTone}`} style={{ width: `${lost}%` }} />}
      </div>
      {right && <div className="text-xs font-mono text-zinc-500 leading-tight mt-0.5 whitespace-nowrap">{right}</div>}
    </div>
  );
}

export const usageTone = (share: number) => (share >= 0.85 ? 'bg-red-500' : share >= 0.6 ? 'bg-amber-400' : 'bg-cyan-400');

export function ActionButton({
  label,
  detail,
  onClick,
  disabled,
  tone = 'plain',
  reason,
}: {
  label: string;
  detail?: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: 'plain' | 'primary' | 'good' | 'warn';
  reason?: string | null;
}) {
  const tones = {
    plain: 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-100',
    primary: 'bg-cyan-700 hover:bg-cyan-600 border-cyan-500 text-white',
    good: 'bg-emerald-700 hover:bg-emerald-600 border-emerald-500 text-white',
    warn: 'bg-amber-800 hover:bg-amber-700 border-amber-600 text-white',
  };
  return (
    <div className="min-w-0">
      <button
        onClick={onClick}
        disabled={disabled}
        title={reason ?? undefined}
        className={`w-full text-left px-3 py-2 rounded-lg border text-sm font-semibold transition ${
          disabled ? 'bg-zinc-900 border-zinc-800 text-zinc-500 cursor-not-allowed' : tones[tone]
        }`}
      >
        <div>{label}</div>
        {detail && <div className={`text-xs font-mono font-normal mt-0.5 ${disabled ? 'text-zinc-600' : 'opacity-90'}`}>{detail}</div>}
      </button>
      {disabled && reason && <div className="text-xs text-amber-300/90 mt-1">{reason}</div>}
    </div>
  );
}

export function Chip({ active, onClick, label, detail }: { active: boolean; onClick: () => void; label: string; detail: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 min-w-[92px] text-left px-2.5 py-1.5 rounded-lg border transition ${
        active ? 'bg-cyan-950/70 border-cyan-500 text-white' : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-600'
      }`}
    >
      <div className="text-sm font-bold">{label}</div>
      <div className="text-xs text-zinc-400 leading-tight">{detail}</div>
    </button>
  );
}

export function Stars({ value }: { value: number }) {
  return (
    <span className="text-amber-300 whitespace-nowrap" aria-label={`${value.toFixed(1)} stars`}>
      {'★'.repeat(Math.round(value))}
      <span className="text-zinc-700">{'★'.repeat(5 - Math.round(value))}</span>
    </span>
  );
}

export function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-300">{title}</h3>
      {note && <p className="text-xs text-zinc-400 mb-2 mt-0.5">{note}</p>}
      <div className={note ? '' : 'mt-1.5'}>{children}</div>
    </section>
  );
}

export function Row({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex justify-between gap-3 px-3 py-1.5 text-xs font-mono bg-zinc-900/60">
      <span className="text-zinc-400">{label}</span>
      <span className={tone ?? 'text-zinc-200'}>{value}</span>
    </div>
  );
}
