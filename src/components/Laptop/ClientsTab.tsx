import React from 'react';
import { GameState } from '../../game/types';
import { CLIENTS } from '../../game/Content';
import { backgroundSalaryMultiplier, MAX_RETAINERS, rating } from '../../game/Engine';
import { dated, money } from '../../game/Format';
import { Section, Stars } from '../Ui';

export const ClientsTab: React.FC<{ g: GameState }> = ({ g }) => {
  const known = Object.entries(g.clients).filter(([, c]) => c.jobs > 0 || c.retainerFee !== null);
  const retainers = known.filter(([, c]) => c.retainerFee !== null);
  const r = rating(g);
  const starFeeDelta = g.reviews.length === 0 ? 0 : Math.round((r - 4) * 15);
  const salaryMod = backgroundSalaryMultiplier(g);
  const salaryDelta = Math.round((salaryMod - 1) * 100);

  return (
    <div className="space-y-4">
      <div className="pb-2 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-white">Clients and Reputation</h2>
          <p className="text-sm text-zinc-400">Your rating sets what clients pay you. Reputation unlocks bigger tiers.</p>
        </div>
        <div className="text-right">
          <div className="text-lg">
            <Stars value={r} /> <span className="font-mono text-amber-300">{r > 0 ? r.toFixed(1) : '—'}</span>
          </div>
          <div className="text-sm font-mono text-zinc-400">
            fees {starFeeDelta >= 0 ? '+' : ''}{starFeeDelta}%{salaryDelta !== 0 ? ` (${salaryDelta}% diff)` : ''} · {g.reputation} reputation
          </div>
        </div>
      </div>

      <Section title={`Retainers ${retainers.length}/${MAX_RETAINERS}`} note="Good repeat clients may offer a monthly retainer: steady pay, and one maintenance ticket a month you must deliver.">
        {retainers.length === 0 ? (
          <p className="text-sm text-zinc-500">None yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {retainers.map(([id, c]) => (
              <div key={id} className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm flex justify-between">
                <span className="font-semibold text-zinc-100">
                  {CLIENTS[id]?.avatar} {CLIENTS[id]?.name}
                </span>
                <span className="font-mono text-emerald-400">{money(c.retainerFee ?? 0)}/month</span>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Clients you worked for">
        {known.length === 0 ? (
          <p className="text-sm text-zinc-500">Nobody yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {known.map(([id, c]) => (
              <div key={id} className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm flex justify-between gap-2">
                <span className="text-zinc-100">
                  {CLIENTS[id]?.avatar} {CLIENTS[id]?.name}
                </span>
                <span className="font-mono text-zinc-400 whitespace-nowrap">
                  {c.jobs} jobs · ★ {c.jobs ? (c.starsTotal / c.jobs).toFixed(1) : '0'}
                </span>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Reviews">
        {g.reviews.length === 0 ? (
          <p className="text-sm text-zinc-500">Deliver a job to get your first review.</p>
        ) : (
          <div className="space-y-1.5">
            {g.reviews.slice(0, 12).map((r2) => (
              <div key={r2.id} className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-sm">
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="font-semibold text-zinc-200">{CLIENTS[r2.clientId]?.name}</span>
                  <Stars value={r2.stars} />
                </div>
                <div className="text-zinc-400">{r2.text}</div>
                <div className="text-sm font-mono text-zinc-600">
                  {dated(r2.minute)} · quality {r2.quality}
                  {r2.late ? ' · late' : ''}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
};
