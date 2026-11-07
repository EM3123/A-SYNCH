// Top level: owns the shared state (roster, last response, motion setting) and moves between the
// landing page (ask) and the ocean (explore). Settings are remembered when storage is available.
import { useCallback, useEffect, useState } from 'react';
import App from './App';
import Landing from './scenes/Landing';
import { loadPeople, type AskResponse, type PersonProfile } from './api';

const MOTION_KEY = 'asynch.motion';

function readMotion(): boolean | null {
  try {
    const v = window.localStorage.getItem(MOTION_KEY);
    return v === null ? null : v === 'on';
  } catch {
    return null;
  }
}

function writeMotion(on: boolean) {
  try {
    window.localStorage.setItem(MOTION_KEY, on ? 'on' : 'off');
  } catch {
    // Storage can be blocked. The setting then lasts for this visit only.
  }
}

export default function Root() {
  const [scene, setScene] = useState<'landing' | 'ocean'>('landing');
  const [roster, setRoster] = useState<PersonProfile[]>([]);
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [response, setResponse] = useState<AskResponse | null>(null);
  const systemReduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [motionOn, setMotionOn] = useState<boolean>(() => {
    const saved = readMotion();
    return saved === null ? !systemReduce : saved;
  });

  useEffect(() => {
    let alive = true;
    loadPeople()
      .then((people) => { if (alive) setRoster(people); })
      .catch((err: unknown) => { if (alive) setRosterError(err instanceof Error ? err.message : 'The team list could not load.'); });
    return () => { alive = false; };
  }, []);

  const toggleMotion = () => {
    setMotionOn((v) => {
      writeMotion(!v);
      return !v;
    });
  };

  const onResponse = useCallback((r: AskResponse | null) => setResponse(r), []);

  return scene === 'landing' ? (
    <Landing
      roster={roster}
      reduceMotion={!motionOn}
      motionOn={motionOn}
      onToggleMotion={toggleMotion}
      onEnter={() => setScene('ocean')}
      onResponse={onResponse}
    />
  ) : (
    <App
      roster={roster}
      rosterError={rosterError}
      lastResponse={response}
      reduceMotion={!motionOn}
      onBack={() => setScene('landing')}
    />
  );
}
