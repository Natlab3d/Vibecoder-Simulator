import React from 'react';
import { GameState } from '../../game/types';
import { BACKGROUNDS, INTERNET, PLANS } from '../../game/Content';
import { calendar, count, FOOD_BILL, OVERDRAFT_LIMIT, repayDebt, UTILITIES_BILL, weeklyBills } from '../../game/Engine';
import { duration, money, moment, tokens } from '../../game/Format';
import { Act, ActionButton, Row, Section } from '../Ui';

export const FinanceTab: React.FC<{ g: GameState; act: Act }> = ({ g, act }) => {
  const c = calendar(g.minute);
  const rent = BACKGROUNDS[g.background].rent;
  const net = INTERNET[g.internet].price;
  const plan = PLANS[g.plan].price;
  const bills = weeklyBills(g);
  const incoming = g.invoices.reduce((a, i) => a + i.amount, 0);

  return (
    <div className="space-y-4">
      <div className="pb-2 border-b border-zinc-800">
        <h2 className="text-lg font-bold text-white">Finance</h2>
        <p className="text-sm text-zinc-400">
          Every Monday clients pay for what you delivered and bills come out. Bills you cannot cover become debt at 5% a month. Debt above {money(OVERDRAFT_LIMIT)} at month end means bankruptcy.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section title={`Weekly bills due in ${count(c.daysToMonday, 'day')}`}>
          <div className="border border-zinc-800 rounded-lg overflow-hidden divide-y divide-zinc-800">
            <Row label="Rent" value={money(rent)} />
            <Row label="Food" value={money(FOOD_BILL)} />
            <Row label="Utilities" value={money(UTILITIES_BILL)} />
            <Row label={INTERNET[g.internet].label} value={money(net)} />
            <Row label={`AI plan: ${PLANS[g.plan].label}`} value={money(plan)} />
            <Row label="Total" value={money(bills)} tone="text-white font-bold" />
            <Row label="Cash now" value={money(g.cash)} tone={g.cash >= bills ? 'text-emerald-400' : 'text-amber-300'} />
            <Row label="Client payments on Monday" value={money(incoming)} />
          </div>
        </Section>

        <Section title="This month so far">
          <div className="border border-zinc-800 rounded-lg overflow-hidden divide-y divide-zinc-800">
            <Row label="Contract payments" value={money(g.ledger.contracts)} tone="text-emerald-400" />
            <Row label="Retainers" value={money(g.ledger.retainers)} tone="text-emerald-400" />
            <Row label="Token credits" value={money(-g.ledger.credits)} />
            <Row label="Courses, gear, plans & days off" value={money(-g.ledger.purchases)} />
            <Row label="Unexpected expenses" value={money(-g.ledger.surprises)} />
            <Row label="Hours worked" value={duration(g.monthWork)} />
            <Row label="Tokens used" value={tokens(g.monthTokens)} />
            <Row label="Jobs shipped" value={String(g.monthShipped)} />
          </div>
          {g.debt > 0 && (
            <div className="mt-2 max-w-xs">
              <ActionButton label={`Repay debt: ${money(g.debt)}`} detail="Pays as much as your cash allows" disabled={g.cash <= 0} tone="warn" onClick={() => act(repayDebt)} />
            </div>
          )}
        </Section>
      </div>

      <Section title="Client payments">
        {g.invoices.length === 0 ? (
          <p className="text-sm text-zinc-500">Nothing outstanding.</p>
        ) : (
          <div className="border border-zinc-800 rounded-lg overflow-hidden divide-y divide-zinc-800">
            {g.invoices.map((i) => (
              <Row key={i.id} label={`${i.label}, pays ${moment(i.dueAt)}`} value={money(i.amount)} tone="text-emerald-400" />
            ))}
          </div>
        )}
      </Section>

      <Section title="Past statements">
        {g.statements.length === 0 ? (
          <p className="text-sm text-zinc-500">Your first statement arrives after 4 weeks.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-mono text-zinc-300">
              <thead className="text-zinc-500 text-left">
                <tr>
                  {['Month', 'Income', 'Bills', 'Other', 'Closing', 'Debt', 'Hours', 'Tokens', 'Shipped'].map((h) => (
                    <th key={h} className="pr-3 pb-1 font-normal">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {g.statements.map((s) => (
                  <tr key={s.month} className="border-t border-zinc-800">
                    <td className="pr-3 py-1">{s.month}</td>
                    <td className="pr-3">{money(s.contracts + s.retainers)}</td>
                    <td className="pr-3">{money(s.rent + s.food + s.utilities + s.internet + s.plan)}</td>
                    <td className="pr-3">{money(s.credits + s.purchases + s.surprises)}</td>
                    <td className="pr-3">{money(s.closingCash)}</td>
                    <td className="pr-3">{money(s.debt)}</td>
                    <td className="pr-3">{s.workHours}</td>
                    <td className="pr-3">{tokens(s.tokensUsed)}</td>
                    <td className="pr-3">{s.shipped}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
};
