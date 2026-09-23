import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Info,
  Check,
  Plus,
  Palette,
  X,
  Search,
  Sparkles,
  Briefcase,
  Coffee,
  Code2,
  Bot,
  Layers
} from 'lucide-react';
import { StyleItem, WeeklyStats } from './StylesData';

interface MainStylesViewProps {
  styles?: StyleItem[];
  activeStyleName: string;
  onSelectActiveStyle: (name: string) => void;
  onOpenStyleDetail?: (style: StyleItem) => void;
  onOpenCreateModal?: () => void;
  onRevisitIntro?: () => void;
  weeklyStats?: WeeklyStats;
  isAdaptiveMode?: boolean;
  onToggleAdaptive?: () => void;
}

const CONTEXT_ITEMS = [
  { name: "Formal", icon: Briefcase, desc: "Workplace & business" },
  { name: "Casual", icon: Coffee, desc: "Chats & social" },
  { name: "Developer", icon: Code2, desc: "Code, git & bugs" },
  { name: "Prompts", icon: Bot, desc: "AI assistant instructions" },
  { name: "Other apps", icon: Layers, desc: "Everyday general typing" },
];

const CONTEXT_ICONS: Record<string, any> = {
  "Formal": Briefcase,
  "Casual": Coffee,
  "Developer": Code2,
  "Prompts": Bot,
  "Other apps": Layers
};

const CONTEXT_TAGLINES: Record<string, string> = {
  "Formal": "Professional and executive communications.",
  "Casual": "Friendly, natural, and conversational.",
  "Developer": "Technical syntax, code logic, and bug reports.",
  "Prompts": "Clear constraints and system instructions.",
  "Other apps": "Everyday balanced typing."
};

const DEFAULT_CONTEXT_APPS: Record<string, string[]> = {
  "Formal": ["Teams", "Outlook", "LinkedIn"],
  "Casual": ["Slack", "Discord", "WhatsApp"],
  "Developer": ["VS Code", "Terminal", "GitHub"],
  "Prompts": ["ChatGPT", "Claude", "Midjourney"],
  "Other apps": ["Chrome", "Notion", "Obsidian"]
};

export default function MainStylesView({
  activeStyleName,
  onSelectActiveStyle,
  isAdaptiveMode = true,
  onToggleAdaptive,
  onRevisitIntro
}: MainStylesViewProps) {
  const [showAdaptInfo, setShowAdaptInfo] = useState(false);
  const adaptInfoRef = useRef<HTMLDivElement>(null);
  const [sliderValues, setSliderValues] = useState<Record<string, number>>({});
  

  useEffect(() => {
    if (!showAdaptInfo) return;

    const handleOutsideInteraction = (e: MouseEvent | TouchEvent) => {
      if (adaptInfoRef.current && !adaptInfoRef.current.contains(e.target as Node)) {
        setShowAdaptInfo(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowAdaptInfo(false);
      }
    };

    document.addEventListener('pointerdown', handleOutsideInteraction);
    document.addEventListener('touchstart', handleOutsideInteraction);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handleOutsideInteraction);
      document.removeEventListener('touchstart', handleOutsideInteraction);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showAdaptInfo]);

  const [isAddAppsOpen, setIsAddAppsOpen] = useState(false);
  const [contextApps, setContextApps] = useState<Record<string, string[]>>(() => {
    try {
      const saved = localStorage.getItem('whispurr_context_apps');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return DEFAULT_CONTEXT_APPS;
  });

  const handleAddApp = (contextName: string, appName: string) => {
    const trimmed = appName.trim();
    if (!trimmed) return;
    setContextApps(prev => {
      const current = prev[contextName] || DEFAULT_CONTEXT_APPS[contextName] || [];
      if (current.some(a => a.toLowerCase() === trimmed.toLowerCase())) {
        return prev;
      }
      const updated = {
        ...prev,
        [contextName]: [...current, trimmed]
      };
      try {
        localStorage.setItem('whispurr_context_apps', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  };

  const handleRemoveApp = (contextName: string, appName: string) => {
    setContextApps(prev => {
      const current = prev[contextName] || DEFAULT_CONTEXT_APPS[contextName] || [];
      const updated = {
        ...prev,
        [contextName]: current.filter(a => a.toLowerCase() !== appName.toLowerCase())
      };
      try {
        localStorage.setItem('whispurr_context_apps', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  };

  const activeApps = contextApps[activeStyleName] || DEFAULT_CONTEXT_APPS[activeStyleName] || [];
  const ActiveIcon = CONTEXT_ICONS[activeStyleName] || Palette;

  return (
    <div className="flex-1 w-full h-full flex flex-col font-sans overflow-hidden gap-3.5 select-none">
      {/* 1. Page Title + Subtitle & Controls */}
      <div className="flex items-center justify-between px-2 shrink-0">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
            <Palette className="text-[#8d6e63] w-8 h-8" />
            Persona
          </h1>
          <p className="text-white/80 font-medium text-sm">
            Customise each persona to match how you sound.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {onRevisitIntro && (
            <button
              type="button"
              onClick={onRevisitIntro}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
              title="Interactive demo"
            >
              <Sparkles className="w-3.5 h-3.5 text-orange-400" />
              <span>Demo</span>
            </button>
          )}


          {/* Auto-Adapt Toggle Bar */}
          <div className="flex items-center gap-2 bg-white/10 border border-white/20 py-1.5 px-3 rounded-xl shrink-0 relative">
            <span className="text-xs font-bold text-white">
              Auto-Adapt
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={isAdaptiveMode}
              onClick={onToggleAdaptive}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border transition-all duration-200 ease-in-out p-0.5 items-center focus:outline-none ${
                isAdaptiveMode
                  ? 'bg-orange-500 border-orange-400'
                  : 'bg-black/20 border-white/20'
              }`}
              title={isAdaptiveMode ? "Disable Auto-Adapt" : "Enable Auto-Adapt"}
            >
              <span className="sr-only">Toggle Auto-Adapt</span>
              <motion.span
                layout
                transition={{ type: "spring", stiffness: 600, damping: 35 }}
                className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm flex items-center justify-center ${
                  isAdaptiveMode ? 'ml-auto' : 'mr-auto'
                }`}
              >
                <span className={`w-1 h-1 rounded-full ${isAdaptiveMode ? 'bg-orange-600' : 'bg-transparent'}`} />
              </motion.span>
            </button>
            <div ref={adaptInfoRef} className="relative">
              <button 
                type="button"
                onClick={() => setShowAdaptInfo(!showAdaptInfo)}
                className="p-0.5 rounded-full text-white/50 hover:text-white transition-colors cursor-pointer"
                title="Info"
              >
                <Info className="w-3.5 h-3.5" />
              </button>
              <AnimatePresence>
                {showAdaptInfo && (
                  <motion.div 
                    initial={{ opacity: 0, y: -4, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.96 }}
                    className="absolute top-full mt-2 right-0 w-60 bg-black/90 backdrop-blur-xl border border-white/10 rounded-xl p-3 shadow-2xl z-50 text-xs text-white leading-relaxed font-normal"
                  >
                    WhisPURR detects your active app to automatically switch personas.
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* Main 2-Column Work Area */}
      <div className="flex-1 min-h-0 flex gap-4 overflow-hidden px-4">
        {/* Left Column: Personas list */}
        <div className="w-1/3 shrink-0 flex flex-col h-full overflow-hidden mt-4">
          <div className="flex flex-col gap-3 overflow-y-auto pr-2 pb-10">
            {CONTEXT_ITEMS.map(({ name, icon: Icon }) => {
              const isActive = activeStyleName === name;
              const apps = contextApps[name] || DEFAULT_CONTEXT_APPS[name] || [];
              return (
                <button 
                  key={name}
                  type="button"
                  onClick={() => onSelectActiveStyle(name)}
                  className={`group relative flex items-center justify-between p-4 px-5 rounded-2xl border transition-all text-left cursor-pointer ${
                    isActive 
                      ? 'bg-[#5d4037] text-white border-[#3e2723] shadow-md' 
                      : 'bg-transparent border-transparent text-[#5d4037] hover:bg-[#5d4037]/10 hover:text-[#2b170e]'
                  }`}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className={`p-3 rounded-xl transition-colors shrink-0 ${
                      isActive ? 'bg-[#795548] text-[#ffffff]' : 'bg-[#5d4037]/10 text-[#5d4037] group-hover:text-[#2b170e]'
                    }`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div className="min-w-0 flex flex-col">
                      <span className={`text-xl tracking-tight truncate ${isActive ? 'text-[#ffffff] font-bold' : 'text-[#3e2723] font-semibold'}`}>
                        {name}
                      </span>
                      <span className={`text-sm truncate font-medium ${isActive ? 'text-[#fceee2]' : 'text-[#6d4c41]'}`}>
                        {apps.length} {apps.length === 1 ? 'app' : 'apps'}
                      </span>
                    </div>
                  </div>
                  {isActive && (
                    <div className="w-2 h-6 rounded-full bg-orange-400 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: Warm Roasted Espresso Panel (.context-studio-panel) */}
        <div className="context-studio-panel flex-1 min-h-0 h-full flex flex-col rounded-3xl p-5 md:p-6 shadow-xl overflow-y-auto custom-scrollbar border mt-4">
          <AnimatePresence mode="wait">
            <motion.div 
              key={activeStyleName}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="flex flex-col h-full w-full min-h-0 gap-5"
            >
              {/* Context Header & Active Apps Strip */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#6e4938]/60 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-500/20 text-orange-300 rounded-xl border border-orange-400/30 shrink-0">
                    <ActiveIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-title-cream tracking-tight leading-tight">
                      {activeStyleName}
                    </h2>
                    <p className="text-xs text-desc-beige font-normal leading-normal mt-0.5">
                      {CONTEXT_TAGLINES[activeStyleName] || "Tailored tone, examples, and custom instructions."}
                    </p>
                  </div>
                </div>

                {/* Secondary Controls: Active Apps Chips & Add Button */}
                <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                  <span className="text-xs text-label-muted font-bold mr-1">Active in:</span>
                  {activeApps.slice(0, 3).map(app => (
                    <span 
                      key={app} 
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#241510] border border-[#5e3b2c] rounded-lg text-xs text-title-cream font-medium shadow-xs"
                    >
                      <span>{app}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveApp(activeStyleName, app)}
                        className="opacity-75 hover:opacity-100 hover:text-red-400 p-0.5 transition-opacity cursor-pointer"
                        title={`Remove ${app}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  {activeApps.length > 3 && (
                    <span className="text-xs text-label-muted font-medium px-1">
                      +{activeApps.length - 3}
                    </span>
                  )}
                  <button 
                    type="button"
                    onClick={() => setIsAddAppsOpen(true)}
                    className="flex items-center gap-1 px-2.5 py-1 bg-[#482d21] hover:bg-[#583728] text-title-cream rounded-lg font-semibold transition-colors border border-[#7d5340] cursor-pointer text-xs shrink-0 ml-1 shadow-xs"
                    title={`Add apps to ${activeStyleName}`}
                  >
                    <Plus className="w-3 h-3 text-orange-400" />
                    <span>Apps</span>
                  </button>
                </div>
              </div>

              {/* Context Options Body: Output Cards & Custom Rules */}
              <ContextOptionsRenderer 
                activeStyleName={activeStyleName} 
                sliderValue={sliderValues[activeStyleName] ?? 50}
                onSliderChange={(val: number) => setSliderValues(prev => ({...prev, [activeStyleName]: val}))}
                
              />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Add Apps Modal */}
      <AddAppsModal 
        isOpen={isAddAppsOpen}
        onClose={() => setIsAddAppsOpen(false)}
        contextName={activeStyleName}
        currentApps={activeApps}
        onAddApp={(app) => handleAddApp(activeStyleName, app)}
        onRemoveApp={(app) => handleRemoveApp(activeStyleName, app)}
      />
    </div>
  );
}

const DEFAULT_CONTEXT_RULES: Record<string, string> = {
  "Formal": "Keep messages under 2 sentences. Avoid emojis. Keep the tone confident, polite, and work-ready.",
  "Casual": "Keep wording natural and conversational. Feel free to use relaxed phrasing and friendly expressions.",
  "Developer": "Format code snippets in markdown blocks. Keep explanations concise, direct, and structured with bullet points.",
  "Prompts": "Specify clear system instructions. Request output strictly in markdown or JSON without chatty filler.",
  "Other apps": "Clean grammar, natural conversational flow without filler words."
};

const CONTEXT_SUGGESTIONS: Record<string, string[]> = {
  "Formal": ["Under 2 sentences", "No emojis", "Workplace polished", "Sign off 'Best regards'"],
  "Casual": ["Natural & conversational", "Light emojis allowed", "Lowercase styling", "Relaxed phrasing"],
  "Developer": ["Markdown code blocks", "Concise bullet points", "No syntax fluff", "Include type hints"],
  "Prompts": ["Output as JSON", "Step-by-step reasoning", "Strict constraints", "Act as Senior Engineer"],
  "Other apps": ["Cut filler words", "Clean grammar", "Straight to the point", "Preserve intent"]
};

const CONTEXT_PLACEHOLDERS: Record<string, string> = {
  "Formal": "E.g. \"Always start with 'Dear Team'\", \"Never use emojis\", \"Keep under 2 sentences\"...",
  "Casual": "E.g. \"Keep it chill\", \"Use friendly emojis\", \"Allow conversational slang\"...",
  "Developer": "E.g. \"Format code snippets in markdown\", \"Use bullet points for changes\", \"Keep concise\"...",
  "Prompts": "E.g. \"Output strictly in valid JSON\", \"Think step-by-step\", \"No conversational filler\"...",
  "Other apps": "E.g. \"Cut filler words like 'um' and 'like'\", \"Clean punctuation\"..."
};

interface ContextOptionsRendererProps {
  activeStyleName: string;
  sliderValue: number;
  onSliderChange: (val: number) => void;
}

function ContextOptionsRenderer({ 
  activeStyleName,
  sliderValue,
  onSliderChange
}: ContextOptionsRendererProps) {
  const contextModes: Record<string, {n: string, d: string, ex: string}[]> = {
    "Formal": [
      { n: 'Very Casual', d: 'Informal check-in.', ex: 'Hey, take a look at this.' },
      { n: 'Casual', d: 'Conversational workplace shorthand.', ex: 'Can you check this out?' },
      { n: 'Clear', d: 'Clean sentences with natural professional cadence.', ex: 'Please take a look at this.' },
      { n: 'Formal', d: 'Fully composed, executive-ready phrasing.', ex: 'I kindly request that you review this material.' },
      { n: 'Highly Formal', d: 'Executive-ready phrasing.', ex: 'It is highly requested that the material is reviewed at your earliest convenience.' }
    ],
    "Casual": [
      { n: 'Very Casual', d: 'Lowercase, relaxed shorthand, zero fuss.', ex: 'running late' },
      { n: 'Casual', d: 'Light cleanup, preserving your spoken voice.', ex: 'I am going to be a bit late.' },
      { n: 'Natural', d: 'Friendly, natural conversational grammar.', ex: 'I will be arriving slightly later than expected.' },
      { n: 'Clear', d: 'Punctuation and conversational grammar.', ex: 'I will be arriving slightly later.' },
      { n: 'Polished', d: 'Full punctuation and composed.', ex: 'I will be arriving slightly later than originally planned.' }
    ],
    "Developer": [
      { n: 'Very Concise', d: 'Minimal code snippet.', ex: 'fix auth bug' },
      { n: 'Concise', d: 'Brief summary stripped of conversational filler.', ex: 'Fix auth module bug.' },
      { n: 'Clear', d: 'Plain instruction with exact technical intent.', ex: 'Fix the bug in the authentication module.' },
      { n: 'Structured', d: 'Standard ticket format with goal and impact.', ex: 'Task: Resolve auth bug.\nImpact: Critical.' },
      { n: 'Detailed', d: 'Comprehensive technical writeup.', ex: 'Task: Resolve auth bug.\nImpact: Critical.\nDetails: Investigate OAuth flow.' }
    ],
    "Prompts": [
      { n: 'Very Direct', d: 'Minimal prompt.', ex: 'python csv script' },
      { n: 'Direct', d: 'Direct instruction with immediate task parameters.', ex: 'Write a Python script for CSV parsing.' },
      { n: 'Clear', d: 'Clear system persona and reasoning.', ex: 'Act as a Senior Engineer and write a Python script.' },
      { n: 'Detailed', d: 'Exhaustive parameters, edge cases, and type hints.', ex: 'Write a robust Python script using type hints and error handling.' },
      { n: 'Role-Based', d: 'Clear system persona and structured reasoning.', ex: 'Act as a Principal Engineer and review this architecture.' }
    ],
    "Other apps": [
      { n: 'Minimal', d: 'Compressed down to key words and fragments.', ex: 'Sounds good.' },
      { n: 'Casual', d: 'Cleaned grammar with your personal tone preserved.', ex: 'Yeah, that sounds good to me.' },
      { n: 'Balanced', d: 'Cleaned grammar with your personal tone preserved.', ex: 'Yeah, that sounds good.' },
      { n: 'Clear', d: 'Composed, complete sentences ready to publish.', ex: 'That sounds perfectly fine with me.' },
      { n: 'Polished', d: 'Composed, complete sentences ready to publish.', ex: 'That sounds perfectly fine.' }
    ]
  };

  const INPUT_EXAMPLES: Record<string, string> = {
    "Formal": "Can you check this out?",
    "Casual": "I am running late",
    "Developer": "fix auth bug",
    "Prompts": "python script for csv",
    "Other apps": "yeah sounds good to me"
  };

  const INTENSITY_TITLES: Record<string, string> = {
    "Formal": "How formal do you want it to be?",
    "Casual": "How casual do you want it to be?",
    "Developer": "How concise do you want the code?",
    "Prompts": "How strict should the prompt be?",
    "Other apps": "How polished do you want it?"
  };

  const currentAdvancedModes = contextModes[activeStyleName] || contextModes["Other apps"];
  const optIndex = sliderValue / 25;
  const opt = currentAdvancedModes[optIndex] || currentAdvancedModes[currentAdvancedModes.length - 1];

  const inputExample = INPUT_EXAMPLES[activeStyleName] || "Test input...";
  const intensityTitle = INTENSITY_TITLES[activeStyleName] || "Select tone intensity";

  const [customRules, setCustomRules] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('whispurr_context_custom_rules');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return DEFAULT_CONTEXT_RULES;
  });
  const [isSaved, setIsSaved] = useState(false);

  const currentRule = customRules[activeStyleName] ?? (DEFAULT_CONTEXT_RULES[activeStyleName] || '');

  const handleRuleChange = (text: string) => {
    setCustomRules(prev => {
      const updated = {
        ...prev,
        [activeStyleName]: text
      };
      try {
        localStorage.setItem('whispurr_context_custom_rules', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 1500);
  };

  const handleAddChip = (chip: string) => {
    const trimmed = currentRule.trim();
    let updated = '';
    if (trimmed.toLowerCase().includes(chip.toLowerCase())) {
      updated = trimmed
        .replace(new RegExp(`(^|\.\s*)${chip}(\.\s*|$)`, 'gi'), '')
        .trim();
    } else {
      updated = trimmed ? `${trimmed}${trimmed.endsWith('.') ? '' : '.'} ${chip}.` : `${chip}.`;
    }
    handleRuleChange(updated);
  };

  return (
    <div className="flex flex-col w-full h-full min-h-0 select-text gap-6">
      
      {/* Input Example */}
      <div className="flex flex-col gap-1.5 shrink-0 bg-[#251610] border border-[#5e3b2c] p-3 rounded-2xl shadow-inner">
        <span className="text-xs font-bold uppercase tracking-wider text-title-cream">
          You say
        </span>
        <p className="text-sm leading-relaxed text-[#fceee2] italic">
          "{inputExample}"
        </p>
      </div>

      {/* Slider Section */}
      <div className="flex flex-col gap-3 shrink-0">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-title-cream">
            {intensityTitle}
          </span>
        </div>
        <div className="w-full flex flex-col justify-center gap-2">
          <div className="flex justify-between text-[11px] font-bold text-[#fceee2] px-1 uppercase tracking-wider">
            <span>0%</span>
            <span>25%</span>
            <span>50%</span>
            <span>75%</span>
            <span>100%</span>
          </div>
          <input 
            type="range"
            min="0"
            max="100"
            step="25"
            value={sliderValue}
            onChange={(e) => onSliderChange(parseInt(e.target.value))}
            className="w-full cursor-pointer h-2 rounded-lg appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-orange-400 [&::-webkit-slider-thumb]:rounded-full shadow-inner border border-black/30"
            style={{
              background: `linear-gradient(to right, #fceee2 ${sliderValue}%, rgba(93, 64, 55, 0.4) ${sliderValue}%)`
            }}
          />
        </div>
      </div>

      {/* Output Example */}
      <div className="flex flex-col gap-2 shrink-0">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-title-cream">
            WhisPURR types
          </span>
        </div>
        <div className={`relative rounded-2xl p-4 bg-[#4a2c20] border-2 border-orange-400 shadow-md ring-2 ring-orange-400/30 flex flex-col justify-between gap-3`}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-base font-bold tracking-tight text-[#ffffff]">
                {opt.n}
              </h3>
              <p className="text-sm font-normal leading-normal mt-1 text-[#fceee2]">
                {opt.d}
              </p>
            </div>
          </div>
          <div className="rounded-xl p-3 px-4 flex items-center transition-colors border bg-[#1c0f0a] border-orange-400/50">
            <p className="text-sm leading-relaxed text-[#ffffff] font-medium whitespace-pre-wrap">
              "{opt.ex}"
            </p>
          </div>
        </div>
      </div>

      {/* Custom Rules Section */}
      <div className="flex flex-col gap-2 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-title-cream">
              Custom Instructions
            </span>
            <p className="text-xs text-desc-beige font-normal mt-0.5">
              Rules applied when this persona is active.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isSaved && (
              <span className="text-xs text-emerald-300 font-bold flex items-center gap-1 bg-emerald-500/25 px-2.5 py-0.5 rounded-md border border-emerald-400/50">
                <Check className="w-3 h-3" /> Saved
              </span>
            )}
            {currentRule.trim() && (
              <button
                type="button"
                onClick={() => handleRuleChange('')}
                className="text-xs text-desc-beige hover:text-red-400 hover:bg-white/[0.08] transition-colors px-2 py-0.5 rounded cursor-pointer font-semibold"
                title="Clear rules"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Textarea */}
        <textarea
          value={currentRule}
          onChange={(e) => handleRuleChange(e.target.value)}
          placeholder={CONTEXT_PLACEHOLDERS[activeStyleName] || "Enter custom rules for this persona..."}
          rows={2}
          className="w-full bg-[#241510] border border-[#5e3b2c] focus:border-orange-400 rounded-xl p-2.5 text-sm text-title-cream resize-none outline-none font-sans leading-relaxed transition-all shadow-inner font-normal"
        />

        {/* Quick Rule Suggestion Chips */}
        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
          <span className="text-xs text-label-muted font-bold mr-1">
            Suggestions:
          </span>
          {(CONTEXT_SUGGESTIONS[activeStyleName] || CONTEXT_SUGGESTIONS["Other apps"]).map(chip => {
            const isChipActive = currentRule.toLowerCase().includes(chip.toLowerCase());
            return (
              <button
                key={chip}
                type="button"
                onClick={() => handleAddChip(chip)}
                className={`text-xs px-2.5 py-0.5 rounded-lg border transition-all cursor-pointer font-medium ${
                  isChipActive
                    ? 'bg-orange-500/25 border-orange-400 text-[#ffd6b3] font-bold shadow-xs'
                    : 'bg-[#251610] hover:bg-[#3d251a] border-[#5e3b2c] text-desc-beige hover:text-title-cream'
                }`}
                title={isChipActive ? "Remove" : "Add rule"}
              >
                {isChipActive ? '✓ ' : '+ '}{chip}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface AddAppsModalProps {
  isOpen: boolean;
  onClose: () => void;
  contextName: string;
  currentApps: string[];
  onAddApp: (appName: string) => void;
  onRemoveApp: (appName: string) => void;
}

function AddAppsModal({
  isOpen,
  onClose,
  contextName,
  currentApps,
  onAddApp,
  onRemoveApp
}: AddAppsModalProps) {
  const [inputValue, setInputValue] = useState('');

  const suggestedApps = [
    "Slack", "Discord", "Teams", "Outlook", "Apple Mail", "Gmail",
    "VS Code", "Terminal", "iTerm2", "Cursor", "GitHub", "Xcode",
    "Notion", "Obsidian", "Figma", "Linear", "Jira", "Trello",
    "Chrome", "Safari", "Arc", "Firefox", "Brave",
    "ChatGPT", "Claude", "Perplexity", "Midjourney",
    "WhatsApp", "Telegram", "Zoom", "Google Meet", "Word", "Excel"
  ];

  if (!isOpen) return null;

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      onAddApp(inputValue.trim());
      setInputValue('');
    }
  };

  const filteredSuggested = suggestedApps.filter(app => 
    !currentApps.some(c => c.toLowerCase() === app.toLowerCase()) &&
    (!inputValue.trim() || app.toLowerCase().includes(inputValue.toLowerCase()))
  );

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md"
      onClick={onClose}
    >
      <div 
        className="context-studio-panel bg-[#342018] border border-[#6e4938] rounded-3xl p-6 md:p-7 max-w-lg w-full shadow-2xl flex flex-col gap-5 text-title-cream relative max-h-[85vh] overflow-hidden font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[#6e4938]/60 pb-3.5 shrink-0">
          <div>
            <h3 className="text-xl font-bold text-title-cream flex items-center gap-2">
              <span>Add Apps to</span>
              <span className="text-orange-400 font-bold">{contextName}</span>
            </h3>
            <p className="text-xs text-desc-beige font-normal mt-1">
              Select or type apps that trigger the {contextName} persona.
            </p>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-1.5 text-desc-beige hover:text-title-cream hover:bg-white/10 rounded-full transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Input Bar */}
        <form onSubmit={handleFormSubmit} className="flex gap-2 shrink-0">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-label-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input 
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Search or enter app name (e.g. Safari, Figma, Cursor)..."
              className="w-full bg-[#241510] border border-[#5e3b2c] rounded-xl pl-10 pr-4 py-2 text-sm text-title-cream focus:border-orange-400 focus:outline-none transition-all font-normal"
              autoFocus
            />
          </div>
          <button 
            type="submit"
            disabled={!inputValue.trim()}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl transition-all flex items-center gap-1.5 shrink-0 cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Add</span>
          </button>
        </form>

        {/* Content Body: Scrollable */}
        <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-4 min-h-0 custom-scrollbar">
          {/* Currently Assigned */}
          <div>
            <div className="text-xs font-bold text-title-cream mb-2 flex items-center justify-between">
              <span>Currently Assigned ({currentApps.length})</span>
            </div>
            {currentApps.length === 0 ? (
              <p className="text-xs text-desc-beige italic bg-[#241510] p-3 rounded-xl border border-[#5e3b2c]/60">No apps assigned yet. Add some below.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {currentApps.map(app => (
                  <span 
                    key={app} 
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#251610] border border-[#5e3b2c] rounded-lg text-xs font-semibold text-title-cream shadow-xs"
                  >
                    <span>{app}</span>
                    <button 
                      type="button"
                      onClick={() => onRemoveApp(app)}
                      className="text-label-muted hover:text-red-400 transition-colors p-0.5 cursor-pointer"
                      title={`Remove ${app}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Quick Add Suggestions */}
          <div>
            <div className="text-xs font-bold text-title-cream mb-2">
              <span>Popular & Suggested Apps</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {filteredSuggested.map(app => (
                <button
                  key={app}
                  type="button"
                  onClick={() => onAddApp(app)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#251610] hover:bg-[#3d251a] border border-[#5e3b2c] hover:border-orange-400/60 rounded-lg text-xs text-desc-beige hover:text-title-cream font-medium transition-all cursor-pointer shadow-xs"
                >
                  <Plus className="w-3 h-3 text-orange-400" />
                  <span>{app}</span>
                </button>
              ))}
              {filteredSuggested.length === 0 && (
                <p className="text-xs text-desc-beige italic">
                  {inputValue.trim() ? `Press Enter or click Add to add "${inputValue.trim()}".` : 'All suggested apps are currently added.'}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-[#6e4938]/60 pt-3.5 flex justify-end shrink-0">
          <button 
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-orange-600 hover:bg-orange-500 text-white font-bold text-sm rounded-xl transition-all shadow-sm cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
