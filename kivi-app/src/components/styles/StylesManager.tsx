import { lazy, Suspense, useState } from 'react';

// The persona onboarding flow, loaded when the Persona page opens.
const Onboarding = lazy(() => import('../onboarding/Onboarding'));

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
      <Suspense fallback={<div className="w-full h-full rounded-3xl bg-[#070b06]" />}>
        <Onboarding {...worldProps} />
      </Suspense>
    </div>
  );
}
