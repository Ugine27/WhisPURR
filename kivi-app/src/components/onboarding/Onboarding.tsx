import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, MotionConfig } from 'framer-motion';
import { HubId, hubById, preloadAll } from './config';
import { usePointer, useSize } from './hooks';
import IntroScreen from './IntroScreen';
import HubWorld, { WorldCustom } from './HubWorld';
import HubInterior from './HubInterior';

/*
 * Kivi onboarding: intro -> world -> hub, all DOM and Framer Motion over
 * static images. The views overlap during transitions (AnimatePresence in
 * sync mode), which is what makes each change a crossfade rather than a cut:
 *
 *   intro -> world   intro dives (accelerating zoom, late fade) over the world fading up
 *   world -> hub     world zooms into the building; the hub fades in at the same framing
 *   hub -> world     card and Kivi slide out; the world zooms back out from the building
 */

type View = { name: 'intro' } | { name: 'world'; from: 'intro' | HubId } | { name: 'hub'; hub: HubId };

// StylesManager passes the active dictation mode; the cards no longer switch it.
interface Props {
  activeStyleName?: string;
  onSelectActiveStyle?: (mode: string) => void;
}

export default function Onboarding(_props: Props) {
  const stage = useRef<HTMLDivElement>(null);
  const size = useSize(stage);
  const pointer = usePointer();
  const [view, setView] = useState<View>({ name: 'intro' });

  useEffect(preloadAll, []);

  const go = () => setView({ name: 'world', from: 'intro' });
  const open = (hub: HubId) => setView({ name: 'hub', hub });
  const back = () => view.name === 'hub' && setView({ name: 'world', from: view.hub });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.metaKey || e.ctrlKey) return;
      if (view.name === 'intro' && e.key === 'Enter') go();
      if (view.name === 'hub' && e.key === 'Escape') back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Tells the world view where it came from and where it is going.
  const custom: WorldCustom = {
    from: view.name === 'world' ? view.from : null,
    to: view.name === 'hub' ? view.hub : null,
    size,
  };

  return (
    <MotionConfig reducedMotion="user">
      <div ref={stage} onPointerMove={pointer.onMove} className="relative w-full h-full overflow-hidden rounded-3xl select-none" style={{ background: '#070b06' }}>
        <AnimatePresence custom={custom}>
          {view.name === 'intro' && <IntroScreen key="intro" onGo={go} />}
          {view.name === 'world' && <HubWorld key="world" custom={custom} size={size} px={pointer.x} py={pointer.y} onOpen={open} />}
          {view.name === 'hub' && (
            <HubInterior
              key={`hub-${view.hub}`}
              hub={hubById(view.hub)}
              size={size}
              px={pointer.x}
              py={pointer.y}
              onBack={back}
            />
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}
