// Top level. OfficeOS is the product now: a living office where every teammate's context agent
// has a desk, joins meetings, and talks. The earlier ocean scenes (scene/, sim/, scenes/,
// App.tsx) are no longer mounted; they stay in the repo until the pixel-art layer replaces them.
// To plug in the pixel-art renderer: <OfficeShell makeRenderer={() => new YourRenderer()} />.
import OfficeShell from './office/OfficeShell';

export default function Root() {
  return <OfficeShell />;
}
