import React, { useState } from 'react';
import { BatchId, GameState, ModelId, Project } from '../../game/types';
import { BATCHES, CLIENTS, CREDIT_PACK, MODELS, TIER_INFO } from '../../game/Content';
import {
  buyCredits,
  cancelStalledAgent,
  count,
  creditPackPrice,
  deliver,
  deliverBlock,
  dropProject,
  expectedQuality,
  handFixableBugs,
  handMinutes,
  handTasks,
  previewBuild,
  previewFix,
  RunPreview,
  specPlan,
  startBuild,
  startFix,
  startHandcode,
  startHandfix,
  startPlan,
  startTest,
  startWait,
  testBlock,
  testPlan,
  tokenStatus,
} from '../../game/Engine';
import { duration, moment, money, tokens } from '../../game/Format';
import { Act, ActionButton, Chip, Meter, Section } from '../Ui';
import { TabId } from '../LaptopOS';

function ShortOfTokens({ g, act, preview, model, batch }: { g: GameState; act: Act; preview?: RunPreview; model?: ModelId; batch?: BatchId }) {
  const status = tokenStatus(g);
  const sessionIsLimit = status.sessionLeft <= status.weeklyLeft;
  const alternatives: string[] = [];
  if (preview) {
    if (model && model !== 'spark') alternatives.push('Spark');
    if (batch && batch !== 'small') alternatives.push('a smaller run');
    alternatives.push(batch ? 'hand-coding' : 'fixing by hand');
  }
  const altText =
    alternatives.length === 1
      ? `Or switch to ${alternatives[0]}.`
      : alternatives.length === 2
        ? `Or try ${alternatives[0]} or ${alternatives[1]}.`
        : alternatives.length === 3
          ? `Or try ${alternatives[0]}, ${alternatives[1]}, or ${alternatives[2]}.`
          : '';
  return (
    <div className="p-2 rounded-lg border border-amber-700 bg-amber-950/40 text-sm space-y-1.5">
      <div className="text-amber-100">
        {!preview ? 'Your agent is paused, out of tokens.' : preview.ok ? `You are ${tokens(preview.shortBy)} short for this run, so the agent will pause partway.` : `Short by ${tokens(preview.shortBy)} tokens.`}{' '}
        {sessionIsLimit
          ? status.sessionResetIn !== null
            ? `Your 5-hour window refills in ${duration(status.sessionResetIn)}.`
            : `Your 5-hour window holds ${tokens(status.plan.session)} tokens (refills 5h after launch).`
          : `Your weekly quota refills in ${duration(status.weeklyResetIn)}.`}{' '}
        {altText}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <button onClick={() => act(buyCredits)} className="px-2 py-1 rounded bg-amber-700 hover:bg-amber-600 text-white font-semibold">
          Buy {tokens(CREDIT_PACK.tokens)} credits for {money(creditPackPrice(g))}
        </button>
        {sessionIsLimit && status.sessionResetIn !== null && (
          <button onClick={() => act(startWait)} className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-100">
            Wait {duration(status.sessionResetIn)}
          </button>
        )}
      </div>
    </div>
  );
}

function runDetail(p: RunPreview, noun: string) {
  return `${duration(p.humanMinutes)} prompt + ${duration(p.aiMinutes)} agent · ${tokens(p.tokens)} tokens${noun === 'tasks' ? ` · about ${p.expectedBugs.toFixed(1)} bugs` : ''}`;
}

function ProjectPanel({ g, act, p }: { g: GameState; act: Act; p: Project }) {
  const [model, setModel] = useState<ModelId>('core');
  const [fixModel, setFixModel] = useState<ModelId>('core');
  const [batch, setBatch] = useState<BatchId>('medium');
  const client = CLIENTS[p.clientId];
  const left = p.deadlineAt - g.minute;
  const remaining = p.tasksTotal - p.tasksDone - p.tasksInFlight;
  const build = previewBuild(g, p, model, batch);
  const fix = previewFix(g, p, fixModel);
  const test = testBlock(g, p);
  const delivery = deliverBlock(p);
  const quality = expectedQuality(p);
  const busyHere = g.human?.projectId === p.id;
  const hand = handTasks(g, p);
  const fixableBugs = handFixableBugs(g, p);
  const spec = specPlan(g, p);
  const testing = testPlan(g, p);

  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
      <div className="md:col-span-2 space-y-3 order-2 md:order-none">
        <div className="bg-zinc-900/70 border border-zinc-800 rounded-lg p-3">
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-base font-bold text-white leading-snug">{p.title}</h2>
            <div className="text-right shrink-0">
              <div className="text-emerald-400 font-bold">{p.kind === 'retainer' ? 'Retainer' : money(p.fee)}</div>
              <div className="text-sm font-mono text-zinc-500">{TIER_INFO[p.tier].name}</div>
            </div>
          </div>
          <div className="text-sm text-zinc-400 mt-0.5">
            {client?.avatar} {client?.name}
          </div>
          <div className="text-sm text-zinc-500 mt-0.5">{p.approach.label}</div>
          <div className={`mt-2 text-sm font-mono ${left < 0 ? 'text-red-400' : left < 1440 ? 'text-amber-300' : 'text-zinc-200'}`}>
            Due {moment(p.deadlineAt)} · {left < 0 ? `${duration(-left)} late` : `${duration(left)} left`}
          </div>
        </div>

        <div className="bg-zinc-900/70 border border-zinc-800 rounded-lg p-3 space-y-2">
          <Meter label="Tasks built" value={`${p.tasksDone}/${p.tasksTotal}${p.tasksInFlight ? ` (+${p.tasksInFlight} running)` : ''}`} percent={(p.tasksDone / p.tasksTotal) * 100} tone="bg-cyan-400" />
          <Meter label="Planned tasks" value={count(p.specTasks, 'task')} percent={remaining > 0 ? (p.specTasks / remaining) * 100 : 0} tone="bg-indigo-400" />
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded border border-zinc-800 p-2">
              <div className="text-zinc-400 text-sm uppercase">Known bugs</div>
              <div className={`font-mono font-bold ${p.knownBugs ? 'text-red-400' : 'text-zinc-200'}`}>
                {p.knownBugs}
                {p.fixing ? ` (+${p.fixing} fixing)` : ''}
              </div>
            </div>
            <div className="rounded border border-zinc-800 p-2">
              <div className="text-zinc-400 text-sm uppercase">Estimated hidden bugs</div>
              <div className={`font-mono font-bold ${p.estHidden >= 1 ? 'text-amber-300' : 'text-zinc-200'}`}>about {p.estHidden.toFixed(1)}</div>
            </div>
            <div className="rounded border border-zinc-800 p-2">
              <div className="text-zinc-400 text-sm uppercase">Last test</div>
              <div className="font-mono font-bold text-zinc-200">
                {p.lastTestFound === null ? 'not run' : p.testedSinceChange ? `${p.lastTestFound} found` : 'out of date'}
              </div>
            </div>
            <div className="rounded border border-zinc-800 p-2">
              <div className="text-zinc-400 text-sm uppercase">Expected quality</div>
              <div className={`font-mono font-bold ${p.tasksDone === 0 ? 'text-zinc-400' : quality >= p.qualityBar ? 'text-emerald-400' : 'text-red-400'}`}>
                {p.tasksDone === 0 ? 'none yet' : quality} (needs {p.qualityBar})
              </div>
            </div>
          </div>
        </div>
        <button onClick={() => act((x) => dropProject(x, p.id))} className="text-sm text-zinc-500 hover:text-red-400 underline">
          Pull out of this job (reputation hit, one-star review)
        </button>
      </div>

      <div className="md:col-span-3 space-y-3 order-1 md:order-none">
        {remaining > 0 && (
          <Section title="Direct the agent" note="It works in the background, even while you sleep. One run lasts a few hours, then it needs you again.">
            <div className="flex flex-wrap gap-1.5 mb-1.5">
              {(Object.keys(MODELS) as ModelId[]).map((id) => (
                <Chip key={id} active={model === id} onClick={() => setModel(id)} label={MODELS[id].label} detail={MODELS[id].blurb} />
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {(Object.keys(BATCHES) as BatchId[]).map((id) => (
                <Chip key={id} active={batch === id} onClick={() => setBatch(id)} label={BATCHES[id].label} detail={BATCHES[id].blurb} />
              ))}
            </div>
            <ActionButton
              label={`Run agent: build ${count(build.amount, 'task')}`}
              detail={runDetail(build, 'tasks')}
              tone="primary"
              disabled={!build.ok}
              reason={build.ok || build.shortBy > 0 || g.human ? null : build.reason}
              onClick={() => act((x) => startBuild(x, p.id, model, batch))}
            />
            {build.shortBy > 0 && (
              <div className="mt-1.5">
                <ShortOfTokens g={g} act={act} preview={build} model={model} batch={batch} />
              </div>
            )}
          </Section>
        )}

        {fixableBugs > 0 && (
          <Section title="Fix known bugs" note="Pick an AI model to squash bugs, or fix them yourself by hand.">
            <div className="flex flex-wrap gap-1.5 mb-2">
              {(Object.keys(MODELS) as ModelId[]).map((id) => (
                <Chip
                  key={id}
                  active={fixModel === id}
                  onClick={() => setFixModel(id)}
                  label={MODELS[id].label}
                  detail={`Fix rate ${(MODELS[id].fixRate * 100).toFixed(0)}% · ${(MODELS[id].regress * 100).toFixed(0)}% regress`}
                />
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <ActionButton
                label={`Agent fixes ${count(fix.amount, 'bug')} (${MODELS[fixModel].label})`}
                detail={`${duration(fix.humanMinutes)} prompt + ${duration(fix.aiMinutes)} agent · ${tokens(fix.tokens)} tokens`}
                tone="primary"
                disabled={!fix.ok}
                reason={fix.ok || fix.shortBy > 0 || g.human ? null : fix.reason}
                onClick={() => act((x) => startFix(x, p.id, fixModel))}
              />
              <ActionButton label="Fix one by hand" detail={`${duration(handMinutes(g, 1) * 0.75)} of your time, no tokens`} disabled={!!g.human} onClick={() => act((x) => startHandfix(x, p.id))} />
            </div>
            {fix.shortBy > 0 && (
              <div className="mt-1.5">
                <ShortOfTokens g={g} act={act} preview={fix} model={fixModel} />
              </div>
            )}
          </Section>
        )}

        <Section title="Do it yourself">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <ActionButton
              label={spec.ai ? 'Write the plan' : 'Write the plan by hand'}
              detail={`${duration(spec.minutes)}, ${spec.ai ? `${tokens(spec.tokens)} tokens` : 'no tokens'}. Covered tasks: 40% fewer bugs, 15% fewer tokens`}
              disabled={!!g.human || remaining <= p.specTasks}
              onClick={() => act((x) => startPlan(x, p.id))}
            />
            <ActionButton label={testing.ai ? 'Test and review' : 'Test and review by hand'} detail={testing.ai ? `${duration(testing.minutes)}, ${tokens(testing.tokens)} tokens. Finds most hidden bugs` : `${duration(testing.minutes)}, no tokens. Slower, finds fewer bugs`} disabled={!!test} reason={g.human ? null : test} onClick={() => act((x) => startTest(x, p.id))} />
            {hand > 0 && (
              <ActionButton
                label={`Hand-code ${count(hand, 'task')}`}
                detail={`${duration(handMinutes(g, hand))}, no tokens, tiring`}
                disabled={!!g.human}
                onClick={() => act((x) => startHandcode(x, p.id))}
              />
            )}
          </div>
        </Section>

        <ActionButton
          label="Deliver to client"
          detail={delivery ?? `Expected quality ${quality}, client needs ${p.qualityBar}. Below that they reject it.`}
          tone={quality >= p.qualityBar ? 'good' : 'warn'}
          disabled={!!delivery || busyHere}
          onClick={() => act((x) => deliver(x, p.id))}
        />
      </div>
    </div>
  );
}

export const ProjectsTab: React.FC<{ g: GameState; act: Act; goTo: (t: TabId) => void }> = ({ g, act, goTo }) => {
  const [selected, setSelected] = useState<string | null>(null);
  const project = g.projects.find((p) => p.id === selected) ?? g.projects[0] ?? null;

  return (
    <div className="space-y-3">
      {g.agents.length > 0 && (
        <div className="space-y-1">
          {g.agents.map((run) => {
            const p = g.projects.find((x) => x.id === run.projectId);
            return (
              <div key={run.id} className="flex items-center gap-2">
                <Meter
                  label={`${MODELS[run.model].label} ${run.type === 'build' ? `building ${count(run.amount, 'task')}` : `fixing ${count(run.amount, 'bug')}`} on ${p?.title ?? 'a job'}`}
                  value={run.stalled ? 'paused, no tokens' : duration(run.minutesLeft)}
                  percent={(1 - run.minutesLeft / run.minutesTotal) * 100}
                  tone="bg-emerald-400"
                />
                {run.stalled && (
                  <button
                    onClick={() => act((g) => cancelStalledAgent(g, run.id))}
                    className="px-2 py-1 rounded bg-red-900 hover:bg-red-800 text-white text-sm font-semibold shrink-0"
                  >
                    Cancel run
                  </button>
                )}
              </div>
            );
          })}
          {g.agents.some((run) => run.stalled) && <ShortOfTokens g={g} act={act} />}
        </div>
      )}

      {g.projects.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {g.projects.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelected(p.id)}
              className={`px-2 py-1 rounded-lg border text-left text-sm max-w-[240px] ${
                project?.id === p.id ? 'bg-cyan-950/60 border-cyan-500' : 'bg-zinc-900 border-zinc-800 hover:border-zinc-600'
              }`}
            >
              <div className="font-semibold text-zinc-100 truncate">{p.title}</div>
              <div className="text-sm font-mono text-zinc-400">
                {p.tasksDone}/{p.tasksTotal} · due {moment(p.deadlineAt)}
              </div>
            </button>
          ))}
        </div>
      )}

      {project ? (
        <ProjectPanel key={project.id} g={g} act={act} p={project} />
      ) : (
        <div className="text-center py-10">
          <h2 className="text-lg font-bold text-white">No active jobs</h2>
          <p className="text-sm text-zinc-400 mb-4">Pick a contract from the Market to start building.</p>
          <button onClick={() => goTo('market')} className="px-4 py-2 bg-cyan-700 hover:bg-cyan-600 border border-cyan-500 text-white font-semibold rounded-lg text-sm">
            Open the Market
          </button>
        </div>
      )}
    </div>
  );
};
