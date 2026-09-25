import { lazy, Suspense, useState } from 'react';
import KiviWorld from './KiviWorld';

// Kivi is rendered with three.js, so load the page only when Persona opens.
const PersonaWorlds = lazy(() => import('../personaWorlds/PersonaWorlds'));

const supportsWebGL = (() => {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch (e) {
    return false;
  }
})();

interface StylesManagerProps {
  currentMode: string;
  setMode: (val: string) => void;
  // Adaptive mode local sync
  isAdaptiveMode?: boolean;
  onToggleAdaptive?: () => void;
  // Moods toggle
  moodsEnabled?: boolean;
  setMoodsEnabled?: (val: boolean) => void;
}

export default function StylesManager({ 
  currentMode, 
  setMode,
  isAdaptiveMode: propIsAdaptiveMode,
  onToggleAdaptive: propOnToggleAdaptive
}: StylesManagerProps) {
  // Adaptive mode local sync
  const [internalAdaptiveMode, setInternalAdaptiveMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('whispurr_adaptive_mode');
      return saved !== null ? saved === 'true' : true;
    } catch (e) {
      return true;
    }
  });

  const effectiveAdaptiveMode = propIsAdaptiveMode !== undefined ? propIsAdaptiveMode : internalAdaptiveMode;

  const handleToggleAdaptive = () => {
    if (propOnToggleAdaptive) {
      propOnToggleAdaptive();
    } else {
      setInternalAdaptiveMode((prev) => {
        const next = !prev;
        try {
          localStorage.setItem('whispurr_adaptive_mode', String(next));
        } catch (e) {}
        return next;
      });
    }
  };

  // Active style name
  const activeStyleName = currentMode || 'Professional';

  const handleSelectActiveStyle = (styleName: string) => {
    if (setMode) {
      setMode(styleName as any);
    }
    try {
      localStorage.setItem('whispurr_mode', styleName);
    } catch (e) {}
  };

  const worldProps = {
    activeStyleName,
    onSelectActiveStyle: handleSelectActiveStyle,
    isAdaptiveMode: effectiveAdaptiveMode,
    onToggleAdaptive: handleToggleAdaptive,
  };

  return (
    <div className="w-full h-full flex flex-col relative overflow-hidden">
      {supportsWebGL ? (
        <Suspense fallback={<div className="w-full h-full rounded-3xl bg-[#0b100a]" />}>
          <PersonaWorlds {...worldProps} />
        </Suspense>
      ) : (
        <KiviWorld {...worldProps} />
      )}
    </div>
  );
}
