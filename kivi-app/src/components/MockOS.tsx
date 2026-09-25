import { useState, useEffect, memo, useRef, useCallback } from 'react';
import { Mail, Terminal, Sparkles, X, Minus, Wifi, Type, Mic, Pencil, Check, Video, Users, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import WhispurrApp from './WhispurrApp';
import KiviCatIcon from './KiviCatIcon';
import FloatingDictationHUD from './FloatingDictationHUD';
import { getSanitizedDialLanguages } from '../constants/languages';

type AppType = 'email' | 'vscode' | 'ai' | 'whispurr' | 'zoom' | null;



interface MockOSProps {
  activeText: string;
  transcript?: string;
  translatedText?: string;
  setTranslatedText?: (t: string) => void;
  mode?: string;
  setMode?: any;
  degree?: number;
  setDegree?: any;
  isAltPressed?: boolean;
  isLoading?: boolean;
  toggleListening?: any;
  simulateSpeech?: (phrase: string) => void;
  resetInputState?: () => void;
}

const MockOS = memo(({ 
  activeText, 
  transcript,
  translatedText,
  mode, 
  setMode, 
  degree, 
  setDegree, 
  isAltPressed, 
  isLoading, 
  toggleListening,
  simulateSpeech,
  resetInputState
}: MockOSProps) => {
  const [openApp, setOpenApp] = useState<AppType>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('app')) return params.get('app') as AppType;
      if (params.has('tab')) return 'whispurr';
      return null;
    } catch (e) {
      return null;
    }
  });
  const [isStartMenuOpen, setIsStartMenuOpen] = useState(false);
  
  // Floating Strip State
  const [isHovered, setIsHovered] = useState(false);
  // The Persona page is full-bleed, so the dock orb steps aside while it is open.
  const [appTab, setAppTab] = useState('Home');
  const hideOrb = openApp === 'whispurr' && ['Persona', 'Modes', 'Context'].includes(appTab);

  // Global Double Tap logic for Quicklaunch
  useEffect(() => {
    let lastTap = 0;
    const handleKeyDown = (e: KeyboardEvent) => {
      const savedShortcut = localStorage.getItem('whispurr_quicklaunch') || 'Ctrl';
      let key = e.key;
      if (key === ' ') key = 'Space';
      else if (key === 'Control') key = 'Ctrl';
      else if (key === 'Meta') key = 'Cmd';
      if (key.length === 1) key = key.toUpperCase();

      if (key === savedShortcut) {
        const now = Date.now();
        if (now - lastTap < 400) {
          // Double tap detected!
          setOpenApp(prev => prev === 'whispurr' ? null : 'whispurr');
          lastTap = 0;
        } else {
          lastTap = now;
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const [activePopup, setActivePopup] = useState<'styles' | 'scratchpad' | null>(null);
  const [scratchPadText, setScratchPadText] = useState("");

  const [showModeHud, setShowModeHud] = useState(false);
  
  const [dialLangs, setDialLangs] = useState<string[]>(getSanitizedDialLanguages);

  const [dialModes, setDialModes] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('whispurr_dial_modes');
      return saved ? JSON.parse(saved) : ['Formal', 'Casual', 'Developer', 'Prompts'];
    } catch (e) {
      return ['Formal', 'Casual', 'Developer', 'Prompts'];
    }
  });

  const [_modeRotation, setModeRotation] = useState(0);

  // Meeting Assistant Settings
  const [meetsAutoTranscribe, setMeetsAutoTranscribe] = useState(true);
  const [meetsInvisibleOverlay, setMeetsInvisibleOverlay] = useState(true);
  const [meetsMeetingSummary, setMeetsMeetingSummary] = useState(false);
  const [showMeetingSummary, setShowMeetingSummary] = useState(false);

  // Cycle handlers
  const [activeDial, setActiveDial] = useState<0 | 1>(0);
  const [langRotation, setLangRotation] = useState(0);
  
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const activeDialRef = useRef(activeDial);
  activeDialRef.current = activeDial;
  const dialModesRef = useRef(dialModes);
  dialModesRef.current = dialModes;
  const dialLangsRef = useRef(dialLangs);
  dialLangsRef.current = dialLangs;
  const showModeHudRef = useRef(showModeHud);
  showModeHudRef.current = showModeHud;

  // Listen for dynamic dial customizations from WhispurrApp Shortcuts tab
  useEffect(() => {
    const handleDialConfigChange = () => {
      try {
        setDialLangs(getSanitizedDialLanguages());
        const savedModes = localStorage.getItem('whispurr_dial_modes');
        if (savedModes) setDialModes(JSON.parse(savedModes));
      } catch (e) {}
    };
    window.addEventListener('whispurr_dial_config_changed', handleDialConfigChange);
    return () => window.removeEventListener('whispurr_dial_config_changed', handleDialConfigChange);
  }, []);
  
  // Synchronize modeRotation when mode changes
  useEffect(() => {
    if (!mode) return;
    const idx = dialModes.indexOf(mode);
    if (idx >= 0) {
      setModeRotation(idx);
    }
  }, [mode, dialModes]);

  useEffect(() => {
    if (isAltPressed) {
      const idx = dialModesRef.current.indexOf(modeRef.current as string);
      setModeRotation(idx >= 0 ? idx : 0);
    } else {
      setShowModeHud(false);
    }
  }, [isAltPressed]);

  // Dedicated Auto-hide Timer for Mode/Language HUD
  const hudTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetHudTimer = useCallback((durationMs = 1200) => {
    if (hudTimerRef.current) clearTimeout(hudTimerRef.current);
    hudTimerRef.current = setTimeout(() => {
      setShowModeHud(false);
    }, durationMs);
  }, []);

  const clearHudTimer = useCallback(() => {
    if (hudTimerRef.current) clearTimeout(hudTimerRef.current);
  }, []);

  useEffect(() => {
    if (showModeHud) {
      resetHudTimer(1200);
    } else {
      clearHudTimer();
    }
    return () => clearHudTimer();
  }, [showModeHud, resetHudTimer, clearHudTimer]);

  const cycleMode = useCallback((direction: 1 | -1) => {
    const modesList = dialModesRef.current;
    if (!modesList.length) return;
    setModeRotation(prev => {
      let nextRot = (prev + direction) % modesList.length;
      if (nextRot < 0) nextRot += modesList.length;
      const selectedMode = modesList[nextRot];
      if (selectedMode && setMode) {
        setMode(selectedMode as any);
      }
      return nextRot;
    });
    setShowModeHud(true);
    resetHudTimer(1200);
  }, [setMode, resetHudTimer]);

  const cycleLang = useCallback((direction: 1 | -1) => {
    const langsList = dialLangsRef.current;
    if (!langsList.length) return;
    setLangRotation(prev => {
      let nextRot = (prev + direction) % langsList.length;
      if (nextRot < 0) nextRot += langsList.length;
      return nextRot;
    });
    setShowModeHud(true);
    resetHudTimer(1200);
  }, [resetHudTimer]);

  // Option+Scroll or Option+Arrow / Option+Right-Click to change mode/lang
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      // Trigger whenever Option is held on Mac (via isAltPressed or hardware e.altKey)
      if (!isAltPressed && !e.altKey) return;
      e.preventDefault();
      if (activeDialRef.current === 0) cycleMode(e.deltaY > 0 ? 1 : -1);
      else cycleLang(e.deltaY > 0 ? 1 : -1);
    };

    const handleContextMenu = (e: MouseEvent) => {
      // Trigger whenever Option is held on Mac (via isAltPressed or hardware e.altKey)
      if (!isAltPressed && !e.altKey) return;
      e.preventDefault();
      setActiveDial(prev => {
        const next = (prev === 0 ? 1 : 0) as 0 | 1;
        activeDialRef.current = next;
        return next;
      });
      setShowModeHud(true);
      resetHudTimer(1200);
    };

    const handleKeyDown = (e: KeyboardEvent) => {

      // When HUD is closed: Option + Left/Right/Up/Down opens HUD and activates corresponding dial
      const isOptionHeld = isAltPressed || e.altKey || e.key === 'Alt' || e.key === 'Option' || e.code === 'AltLeft' || e.code === 'AltRight';
      if (!isOptionHeld) return;

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveDial(1);
        activeDialRef.current = 1;
        setShowModeHud(true);
        resetHudTimer(1200);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveDial(0);
        activeDialRef.current = 0;
        setShowModeHud(true);
        resetHudTimer(1200);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (activeDialRef.current === 0) cycleMode(-1);
        else cycleLang(-1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (activeDialRef.current === 0) cycleMode(1);
        else cycleLang(1);
      }
    };
    
    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isAltPressed, cycleMode, cycleLang, resetHudTimer, clearHudTimer]);

  // Local state for native typing
  const [emailText, setEmailText] = useState('');
  const [vscodeText, setVscodeText] = useState('');
  const [aiText, setAiText] = useState('');
  const [zoomText, setZoomText] = useState('');

  // Auto open Notes (from the Alt+Scroll workflow)
  useEffect(() => {
    if (mode === 'Notes' && !isAltPressed) {
      setOpenApp('whispurr');
    }
  }, [mode, isAltPressed]);

  // Floating Dictation HUD State & Automatic Typing Logic
  const [isHudOpen, setIsHudOpen] = useState(false);
  const autoDismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypedTextRef = useRef<string>('');

  // Helper: check if an app is open or active where user is supposed to type
  const hasActiveTypingTarget = useCallback((): boolean => {
    if (openApp) return true;
    if (activePopup === 'scratchpad') return true;
    const activeEl = document.activeElement;
    if (activeEl && (activeEl instanceof HTMLInputElement || activeEl instanceof HTMLTextAreaElement)) {
      return true;
    }
    return false;
  }, [openApp, activePopup]);

  // Keep HUD closed whenever an active typing app is opened
  useEffect(() => {
    if (hasActiveTypingTarget()) {
      setIsHudOpen(false);
      setShowModeHud(false);
    }
  }, [openApp, activePopup, hasActiveTypingTarget]);

  // Direct Mac Option key listener inside MockOS for instant HUD invocation & Escape dismiss
  useEffect(() => {
    const isMacOption = (e: KeyboardEvent) => {
      return (
        e.key === 'Alt' ||
        e.key === 'Option' ||
        e.key === 'AltGraph' ||
        e.code === 'AltLeft' ||
        e.code === 'AltRight' ||
        e.altKey ||
        (e.key && (e.key.toLowerCase() === 'alt' || e.key.toLowerCase() === 'option'))
      );
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (isMacOption(e) && !e.repeat) {
        if (!hasActiveTypingTarget()) {
          setIsHudOpen(true);
        } else {
          setIsHudOpen(false);
        }
        if (autoDismissTimerRef.current) {
          clearTimeout(autoDismissTimerRef.current);
          autoDismissTimerRef.current = null;
        }
      }
      if (e.key === 'Escape') {
        setIsHudOpen(false);
        if (resetInputState) resetInputState();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [resetInputState, hasActiveTypingTarget]);

  // Open HUD whenever Alt/Option is held or speech begins ONLY IF NO APP IS ACTIVE
  useEffect(() => {
    if (isAltPressed) {
      if (autoDismissTimerRef.current) {
        clearTimeout(autoDismissTimerRef.current);
        autoDismissTimerRef.current = null;
      }
      if (!hasActiveTypingTarget()) {
        setIsHudOpen(true);
      } else {
        setIsHudOpen(false);
      }
    }
  }, [isAltPressed, hasActiveTypingTarget]);

  useEffect(() => {
    if (transcript && transcript.trim()) {
      if (autoDismissTimerRef.current) {
        clearTimeout(autoDismissTimerRef.current);
        autoDismissTimerRef.current = null;
      }
      if (!hasActiveTypingTarget()) {
        setIsHudOpen(true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcript]);

  // Determine current active destination app or text field
  const getDestinationApp = () => {
    if (openApp === 'email') return 'Outlook';
    if (openApp === 'zoom') return 'Zoom';
    if (openApp === 'vscode') return 'VS Code';
    if (openApp === 'ai') return 'Antigravity AI';
    if (openApp === 'whispurr') return 'WhisPURR';
    if (activePopup === 'scratchpad') return 'ScratchPad';
    const activeEl = document.activeElement;
    if (activeEl && (activeEl instanceof HTMLInputElement || activeEl instanceof HTMLTextAreaElement)) {
      return 'Active Text Field';
    }
    return null;
  };

  // Helper to insert text at the current cursor position in a focused text field
  const insertAtCursor = (text: string): boolean => {
    const activeEl = document.activeElement;
    if (
      activeEl &&
      (activeEl instanceof HTMLInputElement || activeEl instanceof HTMLTextAreaElement)
    ) {
      const start = activeEl.selectionStart ?? activeEl.value.length;
      const end = activeEl.selectionEnd ?? activeEl.value.length;
      const original = activeEl.value;
      const spaceBefore = start > 0 && !original.slice(0, start).endsWith(' ') && !original.slice(0, start).endsWith('\n') ? ' ' : '';
      const newText = original.slice(0, start) + spaceBefore + text + original.slice(end);

      const proto = activeEl instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      if (setter) {
        setter.call(activeEl, newText);
      } else {
        activeEl.value = newText;
      }

      activeEl.dispatchEvent(new Event('input', { bubbles: true }));
      activeEl.dispatchEvent(new Event('change', { bubbles: true }));

      const newCursor = start + spaceBefore.length + text.length;
      activeEl.setSelectionRange(newCursor, newCursor);
      return true;
    }
    return false;
  };

  // Process text typing when final transformed text is ready
  useEffect(() => {
    if (isAltPressed) return;

    const outputText = translatedText || activeText;
    if (!outputText || outputText.trim() === '' || isLoading) return;
    if (lastTypedTextRef.current === outputText) return;
    lastTypedTextRef.current = outputText;

    const destination = getDestinationApp();
    if (destination) {
      // 1. Insert at cursor if active element is focused
      insertAtCursor(outputText);

      // 2. ALWAYS update React state for controlled inputs so they stay perfectly in sync
      if (openApp === 'email') {
        setEmailText(prev => prev ? `${prev}\n${outputText}` : outputText);
      } else if (openApp === 'zoom') {
        setZoomText(prev => prev ? `${prev}\n${outputText}` : outputText);
      } else if (openApp === 'vscode') {
        setVscodeText(prev => prev ? `${prev} ${outputText}` : outputText);
      } else if (openApp === 'ai') {
        setAiText(prev => prev ? `${prev} ${outputText}` : outputText);
      } else if (activePopup === 'scratchpad') {
        setScratchPadText(prev => prev ? `${prev}\n${outputText}` : outputText);
      }

      if (openApp === 'whispurr') {
        window.dispatchEvent(new CustomEvent('whispurr-insert-text', { detail: outputText }));
      }

      // App is open: window will NOT pop up / stays closed
      setIsHudOpen(false);
    } else {
      // No active destination: User is on Desktop!
      // The window pops up with the prominent Copy button!
      setIsHudOpen(true);
      // Auto-dismiss HUD window after 5-second countdown if not interacted with
      if (autoDismissTimerRef.current) clearTimeout(autoDismissTimerRef.current);
      autoDismissTimerRef.current = setTimeout(() => {
        setIsHudOpen(false);
      }, 5000);
    }
  }, [translatedText, activeText, isLoading, openApp, activePopup, isAltPressed]);


  return (
    <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop')] bg-cover bg-center">
      <div className="absolute inset-0 bg-black/20" />

      {/* Taskbar */}
      {openApp !== 'whispurr' && (
        <div className="absolute bottom-0 left-0 right-0 h-12 bg-black/40 backdrop-blur-xl border-t border-white/5 flex items-center justify-between px-4 z-50">
           <div className="w-48">
              <div 
                 className="w-10 h-10 hover:bg-white/10 rounded-lg flex items-center justify-center cursor-pointer transition-colors"
                 onClick={() => setIsStartMenuOpen(!isStartMenuOpen)}
              >
                 <div className="grid grid-cols-2 gap-0.5">
                    <div className="w-2.5 h-2.5 bg-blue-500 rounded-sm" />
                    <div className="w-2.5 h-2.5 bg-blue-500 rounded-sm" />
                    <div className="w-2.5 h-2.5 bg-blue-500 rounded-sm" />
                    <div className="w-2.5 h-2.5 bg-blue-500 rounded-sm" />
                 </div>
              </div>
              
              <AnimatePresence>
                 {isStartMenuOpen && (
                    <motion.div 
                       initial={{ opacity: 0, y: 20 }}
                       animate={{ opacity: 1, y: 0 }}
                       exit={{ opacity: 0, y: 20 }}
                       className="absolute bottom-14 left-4 w-64 glass-dark rounded-xl border border-white/10 p-4 shadow-2xl flex flex-col gap-2"
                    >
                       <div className="text-white/50 text-xs font-bold uppercase tracking-wider mb-2">Pinned Apps</div>
                       <div className="flex items-center gap-3 text-white hover:bg-white/10 p-2 rounded cursor-pointer" onClick={() => {setOpenApp('whispurr'); setIsStartMenuOpen(false);}}>
                          <KiviCatIcon className="w-5 h-5 text-orange-400" />
                          <span className="font-medium text-sm">WhisPURR Settings</span>
                       </div>
                       <div className="flex items-center gap-3 text-white hover:bg-white/10 p-2 rounded cursor-pointer" onClick={() => {setOpenApp('ai'); setIsStartMenuOpen(false);}}>
                          <Sparkles className="w-5 h-5 text-purple-400" />
                          <span className="font-medium text-sm">Antigravity AI</span>
                       </div>
                    </motion.div>
                 )}
              </AnimatePresence>
           </div>

           <div className="flex items-center gap-2">
              <div 
                 onClick={() => openApp !== 'email' && setOpenApp('email')}
                 className={`w-8 h-8 rounded flex items-center justify-center cursor-pointer transition-colors ${openApp === 'email' ? 'bg-white/10 border-b-2 border-blue-400' : 'hover:bg-white/10'}`}
              >
                 <Mail className="w-5 h-5 text-blue-300" />
              </div>
              <div 
                 onClick={() => openApp !== 'zoom' && setOpenApp('zoom')}
                 className={`w-8 h-8 rounded flex items-center justify-center cursor-pointer transition-colors ${openApp === 'zoom' ? 'bg-white/10 border-b-2 border-blue-500' : 'hover:bg-white/10'}`}
              >
                 <Video className="w-5 h-5 text-blue-400" />
              </div>
              <div 
                 onClick={() => openApp !== 'vscode' && setOpenApp('vscode')}
                 className={`w-8 h-8 rounded flex items-center justify-center cursor-pointer transition-colors ${openApp === 'vscode' ? 'bg-white/10 border-b-2 border-blue-600' : 'hover:bg-white/10'}`}
              >
                 <Terminal className="w-5 h-5 text-blue-500" />
              </div>
              <div 
                 onClick={() => openApp !== 'ai' && setOpenApp('ai')}
                 className={`w-8 h-8 rounded flex items-center justify-center cursor-pointer transition-colors ${openApp === 'ai' ? 'bg-white/10 border-b-2 border-purple-400' : 'hover:bg-white/10'}`}
              >
                 <Sparkles className="w-5 h-5 text-purple-300" />
              </div>
              <div 
                 onClick={() => (openApp as string) !== 'whispurr' && setOpenApp('whispurr')}
                 className={`w-8 h-8 rounded flex items-center justify-center cursor-pointer transition-colors ${(openApp as string) === 'whispurr' ? 'bg-white/10 border-b-2 border-orange-400' : 'hover:bg-white/10'}`}
              >
                 <KiviCatIcon className="w-5 h-5 text-orange-400" />
              </div>

           </div>

           <div className="flex items-center gap-3 text-white w-48 justify-end cursor-pointer hover:bg-white/10 px-2 py-1 rounded transition-colors">
              <Wifi className="w-4 h-4" />
              <div className="flex flex-col items-end leading-tight text-xs font-medium">
                 <span>10:42 AM</span>
                 <span>9/3/2026</span>
              </div>
           </div>
        </div>
      )}

      {/* DOCK WHISPURR STRIP (ALWAYS IN DOCK AT bottom-0 left-[41.5%]) */}
      <motion.div 
        initial={{ y: 50, opacity: 0 }}
        animate={{ 
          y: (isHovered || isAltPressed || isLoading) ? 0 : 50, 
          opacity: 1 
        }}
        transition={{ type: 'spring', stiffness: 350, damping: 25 }}
        className="absolute bottom-0 left-[41.5%] -translate-x-1/2 z-[60] w-64 h-64 flex items-center justify-center rounded-full pointer-events-none"
        onMouseLeave={() => { setIsHovered(false); setActivePopup(null); }}
      >
        <div 
          className="relative w-32 h-32 flex items-center justify-center rounded-full pointer-events-auto"
        >
          {/* Subtle Hover Glow Backdrop */}
          <AnimatePresence>
            {isHovered && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                className="absolute top-[-20px] left-[-20px] right-[-20px] bottom-1/2 bg-white/[0.02] rounded-t-full backdrop-blur-md border border-white/5 border-b-0 shadow-2xl origin-bottom"
              />
            )}
          </AnimatePresence>

          {/* Persona / Language Arc when Alt is pressed and in app */}
          <AnimatePresence>
            {isAltPressed && hasActiveTypingTarget() && showModeHud && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98, y: 10 }}
                transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
                className="absolute top-1/2 left-1/2 -translate-y-3 z-10 pointer-events-none transform-gpu will-change-transform will-change-opacity"
              >
                <AnimatePresence mode="popLayout">
                  {activeDial === 0 && (
                    <motion.div
                      key="persona-dial"
                      initial={{ opacity: 0, y: 40 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 40 }}
                      transition={{ type: "spring", mass: 0.6, stiffness: 250, damping: 24 }}
                      className="absolute"
                    >
                      {dialModes.map((modeName, i) => {
                        const isActive = mode === modeName;
                        const selectedIndex = dialModes.indexOf(mode || '') !== -1 ? dialModes.indexOf(mode || '') : 0;
                        const angle = 90 + (selectedIndex - i) * 45;
                        
                        const rad = (angle * Math.PI) / 180;
                        const radius = 120;
                        const x = Math.cos(rad) * radius;
                        const y = -Math.sin(rad) * radius;

                        const distance = Math.abs(i - selectedIndex);
                        const scale = isActive ? 1.2 : Math.max(0.7, 0.95 - distance * 0.15);
                        const itemOpacity = isActive ? 1 : Math.max(0, 0.55 - distance * 0.15);

                        return (
                          <motion.div
                            key={modeName}
                            initial={{ opacity: 0, x: 0, y: 0, scale: 0.5 }}
                            animate={{ opacity: itemOpacity, x, y, scale }}
                            transition={{ type: "spring", mass: 0.8, stiffness: 220, damping: 24 }}
                            className="absolute left-0 top-0"
                          >
                            <div className={`-translate-x-1/2 -translate-y-1/2 px-4 py-2 rounded-full backdrop-blur-xl border flex items-center justify-center font-medium text-[11px] whitespace-nowrap transition-colors duration-300 ${
                              isActive 
                                ? 'bg-[#190f0b]/90 border-[#8d6e63]/90 text-[#ffd6b3] shadow-[0_0_25px_rgba(141,110,99,0.5)] z-30'
                                : 'bg-black/50 border-white/10 text-white/50 z-20'
                            }`}>
                              {modeName}
                            </div>
                          </motion.div>
                        );
                      })}
                    </motion.div>
                  )}
                  {activeDial === 1 && (
                    <motion.div
                      key="lang-dial"
                      initial={{ opacity: 0, y: -40 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -40 }}
                      transition={{ type: "spring", mass: 0.6, stiffness: 250, damping: 24 }}
                      className="absolute"
                    >
                      {dialLangs.map((langName, i) => {
                        // In language dial, active item is based on langRotation index
                        const isActive = i === langRotation;
                        const selectedIndex = langRotation;
                        const angle = 90 + (selectedIndex - i) * 60;
                        
                        const rad = (angle * Math.PI) / 180;
                        const radius = 120;
                        const x = Math.cos(rad) * radius;
                        const y = -Math.sin(rad) * radius;

                        const distance = Math.abs(i - selectedIndex);
                        const scale = isActive ? 1.2 : Math.max(0.7, 0.95 - distance * 0.15);
                        const itemOpacity = isActive ? 1 : Math.max(0, 0.55 - distance * 0.15);

                        return (
                          <motion.div
                            key={langName}
                            initial={{ opacity: 0, x: 0, y: 0, scale: 0.5 }}
                            animate={{ opacity: itemOpacity, x, y, scale }}
                            transition={{ type: "spring", mass: 0.8, stiffness: 220, damping: 24 }}
                            className="absolute left-0 top-0"
                          >
                            <div className={`-translate-x-1/2 -translate-y-1/2 px-4 py-2 rounded-full backdrop-blur-xl border flex items-center justify-center font-medium text-[11px] whitespace-nowrap transition-colors duration-300 ${
                              isActive 
                                ? 'bg-[#190f0b]/90 border-[#8d6e63]/90 text-[#ffd6b3] shadow-[0_0_25px_rgba(141,110,99,0.5)] z-30'
                                : 'bg-black/50 border-white/10 text-white/50 z-20'
                            }`}>
                              {langName}
                            </div>
                          </motion.div>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Central Cat in Dock */}
          <AnimatePresence>
            {!isHudOpen && !hideOrb && (
              <motion.div 
                layoutId="whispurr-morph"
                transition={{ type: "spring", mass: 0.8, stiffness: 280, damping: 24 }}
                onDoubleClick={() => {
                  setOpenApp('whispurr');
                  setIsHudOpen(false);
                }}
                onClick={(e) => { 
                  if (e.detail === 1 && toggleListening) {
                    if (!hasActiveTypingTarget()) {
                      setIsHudOpen(prev => !prev);
                    } else {
                      setIsHudOpen(false);
                    }
                    toggleListening();
                  } else if (e.detail === 1) {
                    setIsHovered(prev => !prev);
                    if (activePopup) setActivePopup(null);
                  }
                }}
                className={`w-10 h-10 rounded-full border-2 flex items-center justify-center cursor-pointer will-change-transform transition-all duration-300 shadow-2xl relative z-20 overflow-hidden ${
                  (isAltPressed || isLoading)
                    ? (hasActiveTypingTarget() 
                        ? 'border-[#8d6e63] shadow-[0_0_35px_rgba(141,110,99,0.8)] scale-[1.3] -translate-y-3' 
                        : 'border-[#8d6e63] shadow-[0_0_35px_rgba(141,110,99,0.8)] scale-110')
                    : 'border-white/20 shadow-[0_0_15px_rgba(0,0,0,0.5)] hover:scale-105 hover:border-white/40'
                }`}
                title="WhisPURR Dock Orb · Click to dictate or hover for tools"
              >
                <KiviCatIcon className={`w-full h-full object-cover transition-all duration-300 ${isLoading ? 'animate-pulse opacity-100' : 'opacity-100'}`} />
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {isHovered && !hideOrb && (
                <>
                  {/* ScratchPad Satellite (Top Left) */}
                  <motion.div 
                    initial={{ opacity: 0, x: 0, y: 0, scale: 0.5 }}
                    animate={{ opacity: 1, x: -60, y: -30, scale: 1 }}
                    exit={{ opacity: 0, x: 0, y: 0, scale: 0.5 }}
                    transition={{ type: "spring", stiffness: 400, damping: 25, delay: 0 }}
                    onClick={() => setActivePopup(activePopup === 'scratchpad' ? null : 'scratchpad')}
                    className={`absolute w-9 h-9 rounded-full border shadow-xl flex items-center justify-center cursor-pointer transition-colors z-20 ${
                      activePopup === 'scratchpad' ? 'bg-white/20 border-white/30 text-white' : 'bg-[#1e1e1e] border-white/10 text-white/60 hover:bg-white/15 hover:text-white'
                    }`}
                  >
                    <Pencil className="w-4 h-4" />

                    <AnimatePresence>
                      {activePopup === 'scratchpad' && (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.9, y: 10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.9, y: 10 }}
                          className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 bg-[#1A1A1A]/95 backdrop-blur-3xl border border-white/10 rounded-2xl p-3 w-56 shadow-2xl flex flex-col gap-2 z-30 cursor-auto"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <textarea 
                            className="w-full h-24 bg-transparent resize-none outline-none text-white text-sm placeholder-white/30"
                            placeholder="Jot down a quick thought..."
                            value={scratchPadText}
                            onChange={(e) => setScratchPadText(e.target.value)}
                            autoFocus
                          />
                          <div 
                            className="flex items-center justify-center gap-2 bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 py-1.5 rounded-lg cursor-pointer transition-colors text-xs font-medium"
                            onClick={() => {
                               if (scratchPadText.trim()) {
                                 window.dispatchEvent(new CustomEvent('add-sticky-note', { detail: scratchPadText }));
                                 setScratchPadText("");
                                 setActivePopup(null);
                               }
                            }}
                          >
                            <Check className="w-3 h-3" /> Save to App
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                  
                  {/* Context Satellite (Top Center) */}
                  <motion.div 
                    initial={{ opacity: 0, x: 0, y: 0, scale: 0.5 }}
                    animate={{ opacity: 1, x: 0, y: -65, scale: 1 }}
                    exit={{ opacity: 0, x: 0, y: 0, scale: 0.5 }}
                    transition={{ type: "spring", stiffness: 400, damping: 25, delay: 0.05 }}
                    onClick={() => setActivePopup(activePopup === 'styles' ? null : 'styles')}
                    className={`absolute w-9 h-9 rounded-full border shadow-xl flex items-center justify-center cursor-pointer transition-colors z-20 ${
                      activePopup === 'styles' ? 'bg-white/20 border-white/30 text-white' : 'bg-[#1e1e1e] border-white/10 text-white/60 hover:bg-white/15 hover:text-white'
                    }`}
                  >
                    <Type className="w-4 h-4" />
                    
                    <AnimatePresence>
                      {activePopup === 'styles' && (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.9, y: 10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.9, y: 10 }}
                          className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 bg-[#1A1A1A]/95 backdrop-blur-3xl border border-white/10 rounded-2xl p-2 w-40 shadow-2xl flex flex-col gap-1 z-30"
                        >
                          {(['Formal', 'Casual', 'Developer', 'Prompts'] as const).map(s => (
                            <div 
                              key={s}
                              onClick={(e) => { e.stopPropagation(); if(setMode) setMode(s as any); setActivePopup(null); }}
                              className={`px-3 py-2 text-sm rounded-xl cursor-pointer flex items-center gap-2 transition-colors ${mode === s ? 'bg-white/10 text-white font-medium' : 'text-white/50 hover:bg-white/5 hover:text-white'}`}
                            >
                              {s}
                            </div>
                          ))}
                          <div className="flex bg-white/5 p-1 rounded-lg mt-1 border border-white/5">
                            <div onClick={(e) => { e.stopPropagation(); if(setDegree) setDegree(1); setActivePopup(null); }} className={`flex-1 text-center text-xs py-1.5 rounded-md cursor-pointer transition-colors ${degree === 1 ? 'bg-white/20 text-white shadow-sm' : 'text-white/40 hover:text-white/70'}`}>Roman</div>
                            <div onClick={(e) => { e.stopPropagation(); if(setDegree) setDegree(2); setActivePopup(null); }} className={`flex-1 text-center text-xs py-1.5 rounded-md cursor-pointer transition-colors ${degree === 2 ? 'bg-white/20 text-white shadow-sm' : 'text-white/40 hover:text-white/70'}`}>Native</div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>

                  {/* Dictate Satellite (Top Right) */}
                  <motion.div 
                    initial={{ opacity: 0, x: 0, y: 0, scale: 0.5 }}
                    animate={{ opacity: 1, x: 60, y: -30, scale: 1 }}
                    exit={{ opacity: 0, x: 0, y: 0, scale: 0.5 }}
                    transition={{ type: "spring", stiffness: 400, damping: 25, delay: 0.1 }}
                    onClick={() => { if(toggleListening) toggleListening(); }}
                    className="absolute w-9 h-9 rounded-full bg-[#1e1e1e] border border-white/10 shadow-xl flex items-center justify-center cursor-pointer hover:bg-white/15 text-white/60 hover:text-white transition-colors z-20"
                  >
                    <Mic className="w-4 h-4" />
                  </motion.div>
                </>
              )}
            </AnimatePresence>
            </div>
          </motion.div>



      {/* FULL SCREEN APPS */}
      <AnimatePresence mode="wait">
        {openApp && (
          <motion.div 
            key={openApp}
            initial={{ scale: 0.96, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.98, opacity: 0, y: 10 }}
            transition={{ duration: 0.45, ease: [0.32, 0.72, 0, 1] }}
            className="absolute inset-0 z-40 bg-[#1e1e1e] flex flex-col transform-gpu will-change-transform will-change-opacity"
            style={{ height: openApp === 'whispurr' ? '100vh' : 'calc(100vh - 48px)' }}
          >
            {/* Standard Window Title Bar */}
            <div className={`h-10 flex items-center px-4 select-none ${openApp === 'whispurr' ? 'justify-end absolute top-0 right-0 z-50 bg-transparent w-full pointer-events-none' : 'justify-between bg-black/40 w-full'}`}>
              {openApp !== 'whispurr' && (
                <div className="flex items-center gap-2 text-white/70 text-xs font-medium">
                  {openApp === 'email' && <><Mail className="w-4 h-4"/> Outlook</>}
                  {openApp === 'zoom' && <><Video className="w-4 h-4"/> Zoom Meeting</>}
                  {openApp === 'vscode' && <><Terminal className="w-4 h-4"/> VS Code</>}
                  {openApp === 'ai' && <><Sparkles className="w-4 h-4"/> Antigravity Canvas</>}
                </div>
              )}
              <div className={`flex items-center gap-4 pointer-events-auto ${openApp === 'whispurr' ? 'text-[#5D4037]' : 'text-white/50'}`}>
                <Minus 
                  className={`cursor-pointer transition-colors ${openApp === 'whispurr' ? 'w-5 h-5 hover:text-[#3E2723]' : 'w-4 h-4 hover:text-white'}`} 
                  onClick={() => setOpenApp(null)} 
                />
                <X 
                  className={`cursor-pointer transition-colors ${openApp === 'whispurr' ? 'w-5 h-5 hover:text-red-700' : 'w-5 h-5 hover:text-red-500'}`} 
                  onClick={() => setOpenApp(null)}
                />
              </div>
            </div>

            {/* App Content */}
            <div className="flex-1 overflow-hidden">
              {openApp === 'zoom' && (
                <div className="flex h-full bg-[#242424] text-white overflow-hidden">
                  {/* Main Video Area */}
                  <div className="flex-1 flex flex-col p-4 relative">
                    {meetsInvisibleOverlay && (
                      <AnimatePresence>
                        {(isAltPressed || transcript || activeText || translatedText) && (
                          <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="absolute bottom-24 left-1/2 -translate-x-1/2 z-50 pointer-events-none max-w-lg w-full px-4"
                          >
                            <div className="bg-black/60 backdrop-blur-xl rounded-2xl border border-white/10 p-4 shadow-2xl text-center">
                              <div className="flex items-center justify-center gap-2 mb-2">
                                <Sparkles className="w-4 h-4 text-orange-400" />
                                <span className="text-xs font-medium text-white/70">Live Meeting Overlay</span>
                              </div>
                              <p className="text-base text-white font-medium leading-relaxed">
                                {translatedText || activeText || transcript || "Listening..."}
                              </p>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    )}
                    <div className="flex-1 grid grid-cols-2 gap-4 mb-4">
                      {/* Speaker 1 */}
                      <div className="bg-[#1a1a1a] rounded-xl border border-white/10 flex items-center justify-center relative overflow-hidden group">
                        <div className="absolute top-4 left-4 bg-black/60 px-2 py-1 rounded text-xs font-medium backdrop-blur-sm">Sarah Jenkins</div>
                        <div className="w-24 h-24 rounded-full bg-blue-600/30 flex items-center justify-center border-4 border-blue-500/20">
                          <Users className="w-10 h-10 text-blue-400" />
                        </div>
                      </div>
                      {/* Speaker 2 */}
                      <div className="bg-[#1a1a1a] rounded-xl border border-white/10 flex items-center justify-center relative overflow-hidden">
                        <div className="absolute top-4 left-4 bg-black/60 px-2 py-1 rounded text-xs font-medium backdrop-blur-sm">Alex Chen (You)</div>
                        <div className="w-24 h-24 rounded-full bg-emerald-600/30 flex items-center justify-center border-4 border-emerald-500/20">
                          <Video className="w-10 h-10 text-emerald-400" />
                        </div>
                      </div>
                    </div>
                    {/* Bottom Controls */}
                    <div className="h-16 bg-[#1a1a1a] rounded-xl border border-white/10 flex items-center justify-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-red-500/20 text-red-500 flex items-center justify-center"><Mic className="w-5 h-5" /></div>
                      <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center"><Video className="w-5 h-5" /></div>
                      <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center"><Users className="w-5 h-5" /></div>
                      <div 
                        onClick={() => {
                          if (meetsMeetingSummary) {
                            setShowMeetingSummary(true);
                          } else {
                            setOpenApp(null);
                          }
                        }}
                        className="px-4 py-2 rounded-full bg-red-600 text-white font-medium text-sm ml-4 cursor-pointer hover:bg-red-700"
                      >
                        End
                      </div>
                    </div>
                  </div>

                  {/* Chat Sidebar */}
                  <div className="w-80 bg-[#1a1a1a] border-l border-white/5 flex flex-col">
                    <div className="h-12 border-b border-white/5 flex items-center px-4 gap-2">
                      <MessageSquare className="w-4 h-4 text-white/70" />
                      <span className="font-medium text-sm text-white/90">Meeting Chat</span>
                    </div>
                    <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-white/50">Sarah Jenkins</span>
                        <div className="text-sm bg-white/5 rounded-lg p-2.5 w-fit">Can you send the Q3 report?</div>
                      </div>
                      {zoomText && (
                        <div className="flex flex-col gap-1 items-end">
                          <span className="text-xs text-white/50">You</span>
                          <div className="text-sm bg-blue-600 rounded-lg p-2.5 text-left max-w-[85%] whitespace-pre-wrap break-words">{zoomText}</div>
                        </div>
                      )}
                    </div>
                    <div className="p-4 border-t border-white/5">
                      <div className="bg-[#242424] rounded-lg p-2 border border-white/10 focus-within:border-blue-500 transition-colors">
                        <textarea
                          className="w-full bg-transparent resize-none outline-none text-sm text-white placeholder-white/30"
                          placeholder="Type message here..."
                          rows={3}
                          value={zoomText}
                          onChange={e => setZoomText(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                  
                  {/* Meeting Summary Modal */}
                  <AnimatePresence>
                    {showMeetingSummary && (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
                      >
                        <motion.div 
                          initial={{ scale: 0.95, y: 20 }}
                          animate={{ scale: 1, y: 0 }}
                          exit={{ scale: 0.95, y: 20 }}
                          className="bg-[#1e1e1e] border border-white/10 rounded-2xl p-6 max-w-lg w-full shadow-2xl flex flex-col"
                        >
                          <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/10">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                              <Sparkles className="w-5 h-5 text-orange-400" />
                              AI Meeting Summary
                            </h3>
                            <div 
                              className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center cursor-pointer transition-colors"
                              onClick={() => {
                                setShowMeetingSummary(false);
                                setOpenApp(null);
                              }}
                            >
                              <X className="w-5 h-5 text-white/50" />
                            </div>
                          </div>
                          <div className="space-y-4 text-sm text-white/80 leading-relaxed max-h-96 overflow-y-auto pr-2">
                            <div>
                              <h4 className="text-orange-300 font-semibold mb-1">Key Action Items</h4>
                              <ul className="list-disc pl-5 space-y-1">
                                <li>Send Q3 report to Sarah Jenkins by EOD.</li>
                                <li>Schedule follow-up for next week to review the designs.</li>
                              </ul>
                            </div>
                            <div>
                              <h4 className="text-orange-300 font-semibold mb-1">Summary</h4>
                              <p>Discussed the Q3 performance metrics and reviewed the upcoming UI changes. Sarah requested the final numbers for her presentation. The team agreed the new glassmorphic styles look much better.</p>
                            </div>
                          </div>
                          <div className="mt-6 pt-4 border-t border-white/10 flex justify-end">
                            <div 
                              onClick={() => {
                                setShowMeetingSummary(false);
                                setOpenApp(null);
                              }}
                              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium text-sm cursor-pointer transition-colors"
                            >
                              Done
                            </div>
                          </div>
                        </motion.div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
              {openApp === 'email' && (
                <div className="flex h-full bg-white text-black">
                  <div className="w-64 border-r border-gray-200 p-4 bg-gray-50 flex flex-col gap-2">
                    <div className="font-bold text-gray-700 mb-2">Folders</div>
                    <div className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">Inbox</div>
                    <div className="text-sm hover:bg-gray-200 px-2 py-1 rounded cursor-pointer">Sent Items</div>
                    <div className="text-sm hover:bg-gray-200 px-2 py-1 rounded cursor-pointer">Drafts</div>
                  </div>
                  <div className="flex-1 p-8 flex flex-col gap-4 font-serif">
                    <div className="flex items-center justify-between border-b pb-4">
                      <h1 className="text-2xl font-semibold">Daily Comms Update</h1>
                    </div>
                    <div className="flex-1 text-gray-800 leading-relaxed text-lg flex flex-col">
                      <p className="mb-4">Hi Team,</p>
                      <p className="mb-4">Just wanted to provide a quick update on the latest deployment. Everything is looking stable.</p>
                      <textarea 
                        className="flex-1 w-full bg-transparent resize-none outline-none text-orange-700 font-medium placeholder-gray-400"
                        placeholder="Type your message here..."
                        value={emailText}
                        onChange={e => setEmailText(e.target.value)}
                        autoFocus
                      />
                    </div>
                  </div>
                </div>
              )}

              {openApp === 'vscode' && (
                <div className="flex h-full bg-[#1e1e1e] text-[#d4d4d4] font-mono text-sm">
                  <div className="w-64 border-r border-[#333] p-4 bg-[#252526]">
                    <div className="text-xs font-bold tracking-wider text-gray-400 mb-4">EXPLORER</div>
                    <div className="text-blue-400 hover:text-blue-300 cursor-pointer">backend.ts</div>
                    <div className="text-gray-400 hover:text-gray-300 cursor-pointer mt-2">utils.ts</div>
                    <div className="text-gray-400 hover:text-gray-300 cursor-pointer mt-2">server.ts</div>
                  </div>
                  <div className="flex-1 p-6 leading-loose">
                    <p><span className="text-[#c586c0]">import</span> <span className="text-[#9cdcfe]">Server</span> <span className="text-[#c586c0]">from</span> <span className="text-[#ce9178]">'infrastructure'</span>;</p>
                    <br/>
                    <p><span className="text-[#c586c0]">async function</span> <span className="text-[#dcdcaa]">main</span>() {'{'}</p>
                    <p className="pl-4 text-[#6a9955]">// Initialize system</p>
                    <p className="pl-4">const server = new Server();</p>
                    <br/>
                    <p className="pl-4 text-[#6a9955]">// TODO: Implement fix</p>
                    <div className="pl-4 flex items-center gap-2">
                       <input 
                         type="text" 
                         className="flex-1 bg-transparent outline-none text-[#4ec9b0] placeholder-[#6a9955]/50"
                         placeholder="type your code..."
                         value={vscodeText}
                         onChange={e => setVscodeText(e.target.value)}
                         spellCheck={false}
                         autoFocus
                       />
                       <button
                         type="button"
                         onClick={() => simulateSpeech ? simulateSpeech("const data = await fetchReport();") : toggleListening?.()}
                         className="px-2 py-0.5 rounded bg-[#333] hover:bg-orange-500/20 text-gray-400 hover:text-orange-300 text-[11px] font-mono border border-[#444] hover:border-orange-500/40 transition-all cursor-pointer flex items-center gap-1 active:scale-95 shrink-0"
                         title="Dictate code with Whispurr (option)"
                       >
                         <Mic className="w-3 h-3 text-orange-400" />
                         <span>option</span>
                       </button>
                    </div>
                    <p>{'}'}</p>
                  </div>
                </div>
              )}

              {openApp === 'ai' && (
                <div className="flex flex-col h-full bg-slate-950 items-center justify-center relative">
                  <div className="text-center">
                    <Sparkles className="w-16 h-16 text-purple-500/50 mx-auto mb-6" />
                    <h2 className="text-2xl font-bold text-white mb-2">Antigravity AI</h2>
                    <p className="text-gray-400 max-w-md mx-auto flex items-center justify-center gap-1.5 flex-wrap">
                      <span>Hold</span>
                      <button
                        type="button"
                        onClick={() => simulateSpeech ? simulateSpeech("Analyze the performance of our application.") : toggleListening?.()}
                        className="px-2.5 py-0.5 bg-white/10 hover:bg-orange-500/20 text-white hover:text-orange-300 rounded-md border border-white/20 hover:border-orange-500/40 text-xs font-mono font-semibold transition-all cursor-pointer shadow-sm hover:scale-105 active:scale-95 inline-flex items-center gap-1"
                        title="Click option to dictate with Whispurr"
                      >
                        <Mic className="w-3 h-3 text-orange-400" />
                        <span>option</span>
                      </button>
                      <span>anywhere in the OS to invoke Whispurr and translate your speech.</span>
                    </p>
                  </div>
                  
                  {/* Chat Input */}
                  <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-[80%] max-w-2xl bg-white/5 border border-white/10 rounded-xl p-3 md:p-4 flex items-center shadow-2xl focus-within:border-purple-500/50 transition-colors gap-2">
                    <input 
                      type="text" 
                      className="flex-1 bg-transparent outline-none text-white placeholder-white/30 text-base md:text-lg"
                      placeholder="Ask Antigravity anything..."
                      value={aiText}
                      onChange={e => setAiText(e.target.value)}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => simulateSpeech ? simulateSpeech("Analyze the performance of our application.") : toggleListening?.()}
                      className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-orange-500/20 text-white/70 hover:text-orange-300 border border-white/10 hover:border-orange-500/30 flex items-center gap-1.5 text-xs font-mono transition-all cursor-pointer active:scale-95 shrink-0"
                      title="Dictate with Whispurr (option)"
                    >
                      <Mic className="w-3.5 h-3.5 text-orange-400" />
                      <span>option</span>
                    </button>
                  </div>
                </div>
              )}

              {openApp === 'whispurr' && (
                <WhispurrApp 
                  mode={mode} 
                  setMode={setMode} 
                  meetsAutoTranscribe={meetsAutoTranscribe}
                  setMeetsAutoTranscribe={setMeetsAutoTranscribe}
                  meetsInvisibleOverlay={meetsInvisibleOverlay}
                  setMeetsInvisibleOverlay={setMeetsInvisibleOverlay}
                  meetsMeetingSummary={meetsMeetingSummary}
                  setMeetsMeetingSummary={setMeetsMeetingSummary}
                  onTabChange={setAppTab}
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FLOATING SPEECH & DICTATION DIALOGUE HUD */}
      <FloatingDictationHUD 
        isOpen={isHudOpen}
        isListening={!!isAltPressed}
        isProcessing={!!isLoading}
        transcript={transcript || ''}
        transformedText={translatedText || activeText || ''}
        mode={mode || 'Formal'}
        degree={degree}
        destinationApp={getDestinationApp()}
        onClose={() => {
          setIsHudOpen(false);
          setShowModeHud(false);
          if (autoDismissTimerRef.current) clearTimeout(autoDismissTimerRef.current);
          if (resetInputState) resetInputState();
        }}
        onSimulateSpeech={simulateSpeech}
        onTogglePersonaDial={() => {
          cycleMode(1);
        }}
      />


    </div>
  );
});

export default MockOS;
