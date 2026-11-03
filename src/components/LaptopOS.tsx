import React, { useEffect, useState } from 'react';
import { BookOpen, Briefcase, FolderKanban, Inbox, ShoppingBag, Users, Wallet, X } from 'lucide-react';
import { GameState } from '../game/types';
import { Act } from './Ui';
import { ProjectsTab } from './Laptop/ProjectsTab';
import { MarketTab } from './Laptop/MarketTab';
import { ClientsTab } from './Laptop/ClientsTab';
import { AcademyTab } from './Laptop/AcademyTab';
import { ShopTab } from './Laptop/ShopTab';
import { FinanceTab } from './Laptop/FinanceTab';
import { InboxTab } from './Laptop/InboxTab';

export type TabId = 'projects' | 'market' | 'clients' | 'academy' | 'shop' | 'finance' | 'inbox';

export const TAB_BRIEFS: Record<TabId, string> = {
  projects: 'Direct your AI agent, write specs, run tests, fix bugs, and deliver your active jobs.',
  market: 'Take a job from the Market. Compare each contract’s payout, deadline, and approach before accepting.',
  clients: 'Track your client relationships, star ratings, and recurring monthly retainers.',
  academy: 'Study courses to unlock higher-tier contracts, gain reputation, and cut AI bugs.',
  shop: 'Upgrade your AI plan, buy token credit packs, upgrade internet, and buy room gear.',
  finance: 'Check your cash balance, pending Monday invoices, weekly bills, debt, and statements.',
  inbox: 'Read client messages, delivery feedback, and weekly activity summaries.',
};

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'projects', label: 'Projects', icon: <FolderKanban size={15} /> },
  { id: 'market', label: 'Market', icon: <Briefcase size={15} /> },
  { id: 'clients', label: 'Clients', icon: <Users size={15} /> },
  { id: 'academy', label: 'Academy', icon: <BookOpen size={15} /> },
  { id: 'shop', label: 'Shop', icon: <ShoppingBag size={15} /> },
  { id: 'finance', label: 'Finance', icon: <Wallet size={15} /> },
  { id: 'inbox', label: 'Inbox', icon: <Inbox size={15} /> },
];

export const LaptopOS: React.FC<{ g: GameState; act: Act; onClose: () => void; onTabChange?: (t: TabId) => void }> = ({ g, act, onClose, onTabChange }) => {
  const [tab, setTab] = useState<TabId>(g.projects.length ? 'projects' : 'market');

  useEffect(() => {
    onTabChange?.(tab);
  }, [tab, onTabChange]);

  useEffect(() => {
    if (tab === 'inbox' && g.unread > 0) act((x) => void (x.unread = 0));
  }, [tab, g.unread, act]);

  return (
    <div className="absolute inset-0 bg-zinc-950/95 border border-zinc-700/80 rounded-xl shadow-2xl flex flex-col overflow-hidden text-zinc-100">
      <div className="flex flex-wrap items-center gap-1 px-2 py-1.5 bg-zinc-900 border-b border-zinc-800">
        {TABS.map((t) => {
          const badge = t.id === 'inbox' ? g.unread : t.id === 'projects' ? g.projects.length : 0;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[13px] font-medium whitespace-nowrap ${
                tab === t.id ? 'bg-zinc-800 text-cyan-300 border border-zinc-700' : 'text-zinc-400 hover:text-zinc-100 border border-transparent'
              }`}
            >
              {t.icon}
              {t.label}
              {badge > 0 && <span className="px-1.5 rounded-full bg-cyan-500 text-zinc-950 text-sm font-bold">{badge}</span>}
            </button>
          );
        })}
        <button onClick={onClose} title="Leave the desk [Tab]" className="ml-auto p-1 text-zinc-400 hover:text-white">
          <X size={16} />
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-3 md:p-4">
        {tab === 'projects' && <ProjectsTab g={g} act={act} goTo={setTab} />}
        {tab === 'market' && <MarketTab g={g} act={act} goTo={setTab} />}
        {tab === 'clients' && <ClientsTab g={g} />}
        {tab === 'academy' && <AcademyTab g={g} act={act} />}
        {tab === 'shop' && <ShopTab g={g} act={act} />}
        {tab === 'finance' && <FinanceTab g={g} act={act} />}
        {tab === 'inbox' && <InboxTab g={g} />}
      </div>
    </div>
  );
};
