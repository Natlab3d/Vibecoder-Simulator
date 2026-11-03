import React from 'react';
import { GameState, GearId, InternetId, PlanId } from '../../game/types';
import { CREDIT_PACK, GEAR, INTERNET, PLANS } from '../../game/Content';
import { buyCredits, buyGear, creditPackPrice, setInternet, setPlan } from '../../game/Engine';
import { money, tokens } from '../../game/Format';
import { Act, ActionButton, Section } from '../Ui';

export const ShopTab: React.FC<{ g: GameState; act: Act }> = ({ g, act }) => {
  const packPrice = creditPackPrice(g);
  return (
    <div className="space-y-4">
      <div className="pb-2 border-b border-zinc-800">
        <h2 className="text-lg font-bold text-white">Shop</h2>
        <p className="text-sm text-zinc-400">Everything here does exactly what it says.</p>
      </div>

      <Section title="AI plan" note="Billed every Monday. Switching pays the new plan's first week right away.">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
          {(Object.keys(PLANS) as PlanId[]).map((id) => {
            const plan = PLANS[id];
            const current = g.plan === id;
            return (
              <div key={id} className={`rounded-lg border p-2.5 ${current ? 'border-cyan-500 bg-cyan-950/30' : 'border-zinc-800 bg-zinc-900/70'}`}>
                <div className="flex justify-between font-bold text-white text-sm">
                  <span>{plan.label}</span>
                  <span className="font-mono text-amber-300">{money(plan.price)}/week</span>
                </div>
                <div className="text-sm text-zinc-400">{plan.blurb}</div>
                <div className="text-sm font-mono text-zinc-300 mt-1">{tokens(plan.session)} per 5 hours</div>
                <div className="text-sm font-mono text-zinc-300">{tokens(plan.weekly)} per week</div>
                <div className="text-sm font-mono text-zinc-300 mb-2">{plan.agents} agent{plan.agents > 1 ? 's' : ''} at once</div>
                <ActionButton label={current ? 'Current plan' : 'Switch'} disabled={current || g.cash < plan.price} onClick={() => act((x) => setPlan(x, id))} />
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Token credits" note="Used only after your quota runs out. Far more expensive than a plan, but they never expire.">
        <div className="max-w-xs">
          <ActionButton
            label={`Buy ${tokens(CREDIT_PACK.tokens)} for ${money(packPrice)}${packPrice < CREDIT_PACK.price ? ' (50% off)' : ''}`}
            detail={`You have ${tokens(g.credits)} credits`}
            disabled={g.cash < packPrice}
            onClick={() => act(buyCredits)}
          />
        </div>
      </Section>

      <Section title="Internet" note="During an outage agents stop. Your own offline work continues.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {(Object.keys(INTERNET) as InternetId[]).map((id) => {
            const net = INTERNET[id];
            const current = g.internet === id;
            return (
              <div key={id} className={`rounded-lg border p-2.5 ${current ? 'border-cyan-500 bg-cyan-950/30' : 'border-zinc-800 bg-zinc-900/70'}`}>
                <div className="flex justify-between font-bold text-white text-sm">
                  <span>{net.label}</span>
                  <span className="font-mono text-amber-300">{money(net.price)}/week</span>
                </div>
                <div className="text-sm text-zinc-400 mb-2">{net.blurb}</div>
                <ActionButton label={current ? 'Current' : `Switch (${money(net.price)})`} disabled={current || g.cash < net.price} onClick={() => act((x) => setInternet(x, id))} />
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Gear" note="One-time purchases.">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
          {(Object.keys(GEAR) as GearId[]).map((id) => {
            const item = GEAR[id];
            const owned = g.gear.includes(id);
            return (
              <div key={id} className={`rounded-lg border p-2.5 ${owned ? 'border-emerald-800 bg-emerald-950/20' : 'border-zinc-800 bg-zinc-900/70'}`}>
                <div className="font-bold text-white text-sm">
                  {item.icon} {item.label}
                </div>
                <div className="text-sm text-zinc-400 mb-2">{item.blurb}</div>
                <ActionButton label={owned ? 'Owned' : `Buy for ${money(item.price)}`} disabled={owned || g.cash < item.price} onClick={() => act((x) => buyGear(x, id))} />
              </div>
            );
          })}
        </div>
      </Section>
    </div>
  );
};
