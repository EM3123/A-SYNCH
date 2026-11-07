import { useEffect, useState } from 'react';
import { loadPeople, type PersonProfile } from './api';
import Landing from './scenes/Landing';
// The theme lives in App.css. It used to load via App.tsx, which Root no longer renders.
import './App.css';

export default function Root() {
  const [roster, setRoster] = useState<PersonProfile[]>([]);
  const [rosterError, setRosterError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    loadPeople()
      .then((people) => {
        if (alive) setRoster(people);
      })
      .catch((error: unknown) => {
        if (alive) setRosterError(error instanceof Error ? error.message : 'The Corvid Labs workspace could not load.');
      });
    return () => { alive = false; };
  }, []);

  return <Landing roster={roster} rosterError={rosterError} />;
}
