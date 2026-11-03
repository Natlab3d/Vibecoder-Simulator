import React from 'react';
import { GameState } from '../../game/types';
import { CLIENTS, COURSES, TIER_INFO } from '../../game/Content';
import { acceptOffer, MAX_PROJECTS, offerEstimate, tierUnlocked, tokenStatus } from '../../game/Engine';
import { duration, money, tokens } from '../../game/Format';
import { Act } from '../Ui';
import { TabId } from '../LaptopOS';

export const MarketTab: React.FC<{ g: GameState; act: Act; goTo: (t: TabId) => void }> = ({ g, act, goTo }) => {
  const status = tokenStatus(g);
  const active = g.projects.filter((p) => p.kind === 'contract').length;
  const offers = [...g.offers].sort((a, b) => a.tier - b.tier || b.fee - a.fee);

  return (
    <div className="space-y-3">
      <div className="pb-2 border-b border-zinc-800">
        <h2 className="text-lg font-bold text-white">UpGig Market</h2>
        <p className="text-sm text-zinc-400">
          <span className="text-cyan-300 font-semibold">{active}/{MAX_PROJECTS}</span> active contracts running · <span className="text-zinc-200 font-semibold">{offers.length}</span> listings available · {tokens(status.weeklyLeft)} weekly tokens left.
        </p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {offers.map((o) => {
          const locked = !tierUnlocked(g, o.tier);
          const info = TIER_INFO[o.tier];
          const course = COURSES.find((c) => c.id === info.course);
          const client = CLIENTS[o.clientId];
          return (
            <div key={o.id} className={`p-3 rounded-lg border ${locked ? 'bg-zinc-900/30 border-zinc-800/60' : o.rush ? 'bg-amber-950/20 border-amber-800/60' : 'bg-zinc-900/80 border-zinc-800'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-mono uppercase text-cyan-300">
                    Tier {o.tier} {info.name}
                    {o.rush && <span className="text-amber-300"> · rush</span>}
                  </div>
                  <h3 className="font-bold text-white text-sm leading-snug">{o.title}</h3>
                  <div className="text-sm text-zinc-400">
                    {client?.avatar} {client?.name}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-emerald-400 font-bold">{money(o.fee)}</div>
                  <div className="text-sm font-mono text-zinc-500">due in {o.deadlineDays} days</div>
                </div>
              </div>
              <p className="text-sm text-zinc-300 mt-1.5">{o.description}</p>
              <div className="text-sm font-mono text-zinc-500 mt-1">
                Client needs quality {o.qualityBar} · offer ends in {duration(o.expiresAt - g.minute)}
              </div>
              {locked ? (
                <div className="mt-2 p-2 rounded border border-amber-800/50 text-sm text-amber-200">
                  Requires {info.rep} reputation (you have {g.reputation}){course && !g.coursesDone.includes(course.id) ? ` and the course ${course.title}` : ''}.{' '}
                  <button onClick={() => goTo('academy')} className="underline text-cyan-300">
                    Academy
                  </button>
                </div>
              ) : (
                <div className="mt-2.5 flex flex-col gap-2">
                  {o.approaches.map((a, i) => {
                    const est = offerEstimate(g, o, i);
                    return (
                      <button
                        key={a.label}
                        disabled={active >= MAX_PROJECTS}
                        onClick={() => {
                          act((x) => acceptOffer(x, o.id, i));
                          goTo('projects');
                        }}
                        className="w-full text-left p-2.5 rounded-lg border border-zinc-700 bg-zinc-950/70 hover:border-cyan-500 hover:bg-zinc-900 transition disabled:opacity-50"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-bold text-white">{a.label}</span>
                          <span className="text-xs font-mono text-zinc-400">Click to start</span>
                        </div>
                        <div className="text-xs text-zinc-300 mt-1 leading-snug">{a.description}</div>
                        <div className="grid grid-cols-2 divide-x divide-zinc-800 border border-zinc-800/80 rounded-md bg-zinc-900/60 mt-2 text-xs font-mono text-center">
                          <span className="py-1 px-2 text-cyan-300">{est.tasks} tasks</span>
                          <span className={`py-1 px-2 ${a.bugs > 1 ? 'text-amber-300' : 'text-emerald-300'}`}>
                            {a.bugs > 1 ? 'Higher bug risk' : 'Lower bug risk'}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
