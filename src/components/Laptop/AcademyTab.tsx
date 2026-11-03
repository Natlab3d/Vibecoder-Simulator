import React from 'react';
import { GameState, Tier } from '../../game/types';
import { COURSES, TIER_INFO } from '../../game/Content';
import { courseMinutesNeeded, enroll, startStudy, tierUnlocked } from '../../game/Engine';
import { duration, money } from '../../game/Format';
import { Act, ActionButton, Meter, Section } from '../Ui';

export const AcademyTab: React.FC<{ g: GameState; act: Act }> = ({ g, act }) => (
  <div className="space-y-4">
    <div className="pb-2 border-b border-zinc-800">
      <h2 className="text-lg font-bold text-white">AI Academy</h2>
      <p className="text-sm text-zinc-400">Courses cost money and your own hours. Studying works during internet outages and while an agent runs.</p>
    </div>

    <Section title="Career ladder">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
        {([2, 3, 4, 5] as Tier[]).map((t) => {
          const info = TIER_INFO[t];
          const open = tierUnlocked(g, t);
          const course = COURSES.find((c) => c.id === info.course);
          const done = course ? g.coursesDone.includes(course.id) : true;
          return (
            <div key={t} className={`rounded-lg border p-2 text-sm ${open ? 'border-emerald-700 bg-emerald-950/20' : 'border-zinc-800 bg-zinc-900/60'}`}>
              <div className="font-bold text-white">
                Tier {t}: {info.name}
              </div>
              <div className={g.reputation >= info.rep ? 'text-emerald-400' : 'text-zinc-400'}>
                {g.reputation}/{info.rep} reputation
              </div>
              <div className={done ? 'text-emerald-400' : 'text-zinc-400'}>{done ? 'Course done' : `Needs: ${course?.title}`}</div>
            </div>
          );
        })}
      </div>
    </Section>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {COURSES.map((c) => {
        const done = g.coursesDone.includes(c.id);
        const enrolled = g.coursesEnrolled.includes(c.id);
        const needed = courseMinutesNeeded(g, c.hours);
        const studied = g.courseMinutes[c.id] ?? 0;
        return (
          <div key={c.id} className={`p-3 rounded-lg border ${done ? 'bg-emerald-950/20 border-emerald-800/50' : 'bg-zinc-900/80 border-zinc-800'}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-bold text-white text-sm">
                  {c.icon} {c.title}
                </h3>
                <div className="text-sm text-cyan-400">{c.provider}</div>
              </div>
              <div className="text-right shrink-0 text-sm font-mono">
                <div className="text-amber-300 font-bold">{done ? 'Done' : money(c.cost)}</div>
                <div className="text-zinc-500">{duration(needed)} of study</div>
              </div>
            </div>
            <p className="text-sm text-zinc-300 mt-1">{c.description}</p>
            <p className="text-sm text-emerald-300 mt-1">{c.perk}</p>
            {!done && (
              <div className="mt-2">
                {enrolled ? (
                  <div className="space-y-2">
                    <Meter label="Progress" value={`${duration(studied)} of ${duration(needed)}`} percent={(studied / needed) * 100} tone="bg-cyan-400" />
                    <ActionButton
                      label="Study"
                      detail={`${duration(Math.min(120, needed - studied))} of your time`}
                      tone="primary"
                      disabled={!!g.human}
                      reason={g.human ? `You are busy: ${g.human.label}.` : null}
                      onClick={() => act((x) => startStudy(x, c.id))}
                    />
                  </div>
                ) : (
                  <ActionButton
                    label={g.cash >= c.cost ? `Enroll for ${money(c.cost)}` : `Need ${money(c.cost - g.cash)} more`}
                    disabled={g.cash < c.cost}
                    onClick={() => act((x) => enroll(x, c.id))}
                  />
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  </div>
);
