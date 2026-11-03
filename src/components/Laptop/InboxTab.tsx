import React from 'react';
import { GameState } from '../../game/types';
import { moment } from '../../game/Format';

const TONES = { info: 'border-zinc-800 text-zinc-300', good: 'border-emerald-800 text-emerald-200', warn: 'border-amber-800 text-amber-200', bad: 'border-red-800 text-red-200' };

export const InboxTab: React.FC<{ g: GameState }> = ({ g }) => (
  <div className="space-y-1.5">
    <h2 className="text-lg font-bold text-white pb-2 border-b border-zinc-800">Inbox</h2>
    {g.inbox.map((m) => (
      <div key={m.id} className={`bg-zinc-900/70 border rounded-lg px-3 py-1.5 text-sm ${TONES[m.tone]}`}>
        <span className="font-mono text-sm text-zinc-500 mr-2">{moment(m.minute)}</span>
        {m.text}
      </div>
    ))}
  </div>
);
