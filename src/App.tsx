import React, { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { InteractiveTarget, WorldScene, WorldView } from './game/threeScene';
import { ActionResult, BackgroundId, GameState } from './game/types';
import {
  advance,
  answerEvent,
  calendar,
  closeStatement,
  count,
  createGame,
  isTimeRunning,
  SAVE_KEY,
  startBreak,
  startCoffee,
  startDayOff,
  startEat,
  startNap,
  startSleep,
  STEP,
} from './game/Engine';
import { duration } from './game/Format';
import { HUD } from './components/HUD';
import { LaptopOS, TabId } from './components/LaptopOS';
import { CreateCareer, DayOffModal, EndingModal, EventModal, HelpModal, StatementModal, TitleScreen } from './components/Modals';
import { DayOffActivity } from './game/Content';
import { sound } from './game/audio';

// One game hour lasts 4 real seconds at 1x
const GAME_MINUTES_PER_SECOND = 15;
const FAST_KINDS = ['sleep', 'dayoff', 'sick', 'wait'];

function loadSave(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const g = JSON.parse(raw) as GameState;
    return g.version === 1 ? g : null;
  } catch {
    return null;
  }
}

function writeSave(g: GameState) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(g));
  } catch {
    // The game still runs without a save, for example in a private window
  }
}

function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to clear
  }
}

function playFx(g: GameState) {
  for (const fx of g.fx) {
    if (fx === 'typing' || fx === 'accept') sound.playTyping();
    else if (fx === 'success' || fx === 'cash') sound.playSuccess();
    else if (fx === 'error') sound.playError();
    else if (fx === 'buy') sound.playUpgrade();
    else if (fx === 'coffee') sound.playCoffee();
    else if (fx === 'done') sound.playTokenBlip();
  }
  g.fx.length = 0;
}

function viewOf(g: GameState): WorldView {
  const run = g.agents[0];
  const project = run ? g.projects.find((p) => p.id === run.projectId) : null;
  return {
    hour: calendar(g.minute).minuteOfDay / 60,
    online: g.outageUntil === null,
    headline: run ? `Agent ${run.type === 'build' ? 'building' : 'fixing'} ${count(run.amount, run.type === 'build' ? 'task' : 'bug')}` : g.human ? g.human.label : `Hi ${g.name}! How can I help you today?`,
    detail: !run && !g.human ? '' : (project?.title ?? (g.projects[0]?.title ?? '')),
    progress: run ? 1 - run.minutesLeft / run.minutesTotal : null,
    gear: g.gear,
  };
}

export default function App() {
  const [screen, setScreen] = useState<'title' | 'create' | 'playing'>('title');
  const [canContinue, setCanContinue] = useState(() => loadSave() !== null);
  const [laptopOpen, setLaptopOpen] = useState(false);
  const [laptopTab, setLaptopTab] = useState<TabId>('market');
  const [nearest, setNearest] = useState<InteractiveTarget | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [showDayOff, setShowDayOff] = useState(false);
  const [dayOffFade, setDayOffFade] = useState<{ opaque: boolean; label: string } | null>(null);
  const [muted, setMuted] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [, redraw] = useReducer((x: number) => x + 1, 0);

  const gameRef = useRef<GameState | null>(null);
  const canvasMountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<WorldScene | null>(null);
  const noticeTimer = useRef<number>(0);

  const refresh = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    playFx(g);
    if (sceneRef.current) {
      sceneRef.current.canMove = !g.human;
      sceneRef.current.updateWorld(viewOf(g));
    }
    redraw();
  }, []);

  const act = useCallback(
    (fn: (g: GameState) => ActionResult | void) => {
      const g = gameRef.current;
      if (!g) return;
      const result = fn(g);
      if (result && !result.ok) {
        setNotice(result.reason);
        sound.playError();
        window.clearTimeout(noticeTimer.current);
        noticeTimer.current = window.setTimeout(() => setNotice(null), 3500);
      }
      refresh();
    },
    [refresh],
  );

  const toggleLaptop = useCallback(() => {
    setLaptopOpen((open) => {
      if (sceneRef.current) sceneRef.current.isFocused = !open;
      return !open;
    });
  }, []);

  const interact = useCallback(
    (id: InteractiveTarget['id']) => {
      if (id === 'desk') toggleLaptop();
      else if (id === 'coffee') act(startCoffee);
      else if (id === 'fridge') act(startEat);
      else if (id === 'window') act(startBreak);
      else if (id === 'sofa') act(startNap);
      else if (id === 'bed') act(startSleep);
      else if (id === 'door') setShowDayOff(true);
    },
    [act, toggleLaptop],
  );

  useEffect(() => {
    if (!canvasMountRef.current) return;
    const scene = new WorldScene(canvasMountRef.current);
    sceneRef.current = scene;
    scene.updateWorld({ hour: 9, online: true, headline: 'Hi! How can I help you today?', detail: '', progress: null, gear: [] });
    const poll = window.setInterval(() => {
      const id = scene.nearestTarget?.id ?? null;
      setNearest((prev) => ((prev?.id ?? null) === id ? prev : scene.nearestTarget));
    }, 150);
    return () => {
      window.clearInterval(poll);
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    scene.setInteractCallback((id) => {
      if (screen === 'playing') interact(id);
    });
    scene.setToggleFocusCallback(() => {
      if (screen === 'playing') toggleLaptop();
    });
  }, [screen, interact, toggleLaptop]);

  useEffect(() => {
    if (screen !== 'playing') return;
    let last = performance.now();
    let carry = 0;
    let saved = last;
    const loop = window.setInterval(() => {
      const g = gameRef.current;
      const now = performance.now();
      const seconds = Math.min(0.25, (now - last) / 1000);
      last = now;
      if (!g) return;
      if (isTimeRunning(g)) {
        const fast = g.human && FAST_KINDS.includes(g.human.kind);
        carry += GAME_MINUTES_PER_SECOND * (fast ? Math.max(8, g.speed) : g.speed) * seconds;
        const minutes = Math.floor(carry / STEP) * STEP;
        if (minutes > 0) {
          carry -= minutes;
          advance(g, minutes);
          refresh();
        }
      }
      if (now - saved > 3000) {
        saved = now;
        writeSave(g);
    setCanContinue(true);
      }
    }, 50);
    const onHide = () => gameRef.current && writeSave(gameRef.current);
    window.addEventListener('beforeunload', onHide);
    return () => {
      window.clearInterval(loop);
      window.removeEventListener('beforeunload', onHide);
    };
  }, [screen, refresh]);

  useEffect(() => {
    if (screen !== 'playing') return;
    const onKey = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT') return;

      if (e.code === 'Digit1') act((g) => void (g.speed = 1));
      if (e.code === 'Digit2') act((g) => void (g.speed = 3));
      if (e.code === 'Digit3') act((g) => void (g.speed = 8));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [screen, act]);

  const begin = (g: GameState) => {
    gameRef.current = g;
    sound.startAmbientLoFi();
    setLaptopOpen(false);
    if (sceneRef.current) sceneRef.current.isFocused = false;
    setScreen('playing');
    writeSave(g);
    setCanContinue(true);
    refresh();
  };

  const startNew = (name: string, background: BackgroundId) => begin(createGame(name, background, (Date.now() ^ (Math.random() * 1e9)) | 0));

  const continueCareer = () => {
    const g = loadSave();
    if (g) begin(g);
  };

  const restart = () => {
    clearSave();
    gameRef.current = null;
    setCanContinue(false);
    setLaptopOpen(false);
    if (sceneRef.current) sceneRef.current.isFocused = false;
    setScreen('create');
  };

  const toggleMute = () => setMuted(sound.toggleMute());

  const goMainMenu = () => {
    if (gameRef.current) {
      writeSave(gameRef.current);
      setCanContinue(true);
    }
    setShowDayOff(false);
    setLaptopOpen(false);
    if (sceneRef.current) sceneRef.current.isFocused = false;
    setScreen('title');
  };

  const handleDayOffSelect = (activity: DayOffActivity) => {
    setShowDayOff(false);
    setLaptopOpen(false);
    if (sceneRef.current) {
      sceneRef.current.isFocused = false;
      sceneRef.current.canMove = false;
    }
    const label = activity.label;
    setDayOffFade({ opaque: false, label });
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setDayOffFade({ opaque: true, label });
      });
    });
    window.setTimeout(() => {
      act((x) => startDayOff(x, activity.id));
      if (sceneRef.current) sceneRef.current.canMove = false;
    }, 700);
    window.setTimeout(() => {
      setDayOffFade({ opaque: false, label });
    }, 1850);
    window.setTimeout(() => {
      setDayOffFade(null);
      if (sceneRef.current && gameRef.current) {
        sceneRef.current.canMove = !gameRef.current.human;
      }
    }, 2500);
  };

  const g = gameRef.current;
  const sickOverlay = g?.human && g.human.kind === 'sick';

  return (
    <div className="relative w-full h-screen min-h-[700px] overflow-hidden bg-zinc-950 font-sans select-none">
      <div ref={canvasMountRef} className="absolute inset-0 z-0 cursor-crosshair" />

      {screen === 'title' && <TitleScreen canContinue={canContinue} onContinue={continueCareer} onNew={() => setScreen('create')} onHelp={() => setShowHelp(true)} />}
      {screen === 'create' && <CreateCareer onStart={startNew} onBack={() => setScreen('title')} />}

      {screen === 'playing' && g && (
        <>
          {sickOverlay && (
            <div className="absolute inset-0 z-[5] bg-black/80 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <div className="text-2xl font-bold text-zinc-200">{g.human!.label}</div>
                <div className="text-sm font-mono text-zinc-400">{duration(g.human!.minutesLeft)} left</div>
              </div>
            </div>
          )}

          <HUD
            g={g}
            nearest={nearest}
            laptopOpen={laptopOpen}
            laptopTab={laptopTab}
            onToggleLaptop={toggleLaptop}
            onInteract={interact}
            onDayOff={() => setShowDayOff(true)}
            act={act}
            onHelp={() => setShowHelp(true)}
            onMainMenu={goMainMenu}
            muted={muted}
            onMute={toggleMute}
            notice={notice}
          >
            <LaptopOS g={g} act={act} onClose={toggleLaptop} onTabChange={setLaptopTab} />
          </HUD>

          {showDayOff && !g.human && (
            <DayOffModal
              g={g}
              onSelect={handleDayOffSelect}
              onClose={() => setShowDayOff(false)}
            />
          )}
          {dayOffFade && (
            <div
              className={`absolute inset-0 z-50 bg-black flex items-center justify-center pointer-events-auto transition-opacity duration-600 ${
                dayOffFade.opaque ? 'opacity-100' : 'opacity-0'
              }`}
            >
              <div className="text-xl font-semibold text-zinc-200 tracking-wide">{dayOffFade.label}</div>
            </div>
          )}
          {g.pendingEvent && !g.pendingStatement && (
            <EventModal
              g={g}
              onAnswer={(accept) => act((x) => answerEvent(x, accept))}
            />
          )}
          {g.pendingStatement && !g.ending && <StatementModal statement={g.pendingStatement} onClose={() => act(closeStatement)} />}
          {g.ending && !g.endingSeen && <EndingModal g={g} onContinue={() => act((x) => void (x.endingSeen = true))} onRestart={restart} />}
        </>
      )}

      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
    </div>
  );
}
