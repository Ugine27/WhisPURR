import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Mic, Pencil, Plus, Settings, Sparkles, Trash2, X } from 'lucide-react';
import AppIcon, { KNOWN_APPS } from './AppIcon';
import { useTypewriter } from '../styles/KiviWorld';

/*
 * The glass panel shown inside a hub: the apps this persona is used in, one
 * example of Kivi's rewrite, and the user's custom rules. Apps and rules are
 * stored where the rest of WhisPURR reads them, so edits take effect.
 */

type Example = { input: string; output: string; code?: boolean };

interface HubContent {
  apps: string[];
  example: Example;
  rules: string[];
}

export const HUB_CONTENT: Record<string, HubContent> = {
  Formal: {
    apps: ['Outlook', 'Teams', 'Word', 'Excel', 'PowerPoint'],
    example: { input: 'hey bro let meet', output: 'Hello, could we schedule a meeting at your convenience?' },
    rules: ['Keep a formal, polished tone', 'No emojis'],
  },
  Casual: {
    apps: ['Slack', 'iMessage', 'Discord', 'WhatsApp'],
    example: { input: 'yo ill be there at 5', output: "I'll be there at 5! Can't wait." },
    rules: ['Always use exclamation points for friends'],
  },
  Developer: {
    apps: ['VS Code', 'Terminal', 'GitHub', 'Stack Overflow'],
    example: {
      input: 'make a function to sort an array',
      output: 'function sortArray(arr) {\n  return [...arr].sort((a, b) => a - b);\n}',
      code: true,
    },
    rules: ['Always format code snippets using Markdown'],
  },
};

const APPS_KEY = 'whispurr_context_apps';
const RULE_TEXT_KEY = 'whispurr_context_custom_rules';
const RULE_LIST_KEY = 'kivi_persona_rules';

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch (e) {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {}
}

function loadRules(persona: string): string[] {
  const lists = readJSON<Record<string, string[]>>(RULE_LIST_KEY, {});
  if (lists[persona]) return lists[persona];
  // Carry over a rule written in the previous Persona page, if any.
  const legacy = readJSON<Record<string, string>>(RULE_TEXT_KEY, {})[persona];
  return legacy ? [legacy] : HUB_CONTENT[persona]?.rules ?? [];
}

function saveRules(persona: string, rules: string[]) {
  writeJSON(RULE_LIST_KEY, { ...readJSON<Record<string, string[]>>(RULE_LIST_KEY, {}), [persona]: rules });
  // The transformer reads a single instruction string per mode.
  writeJSON(RULE_TEXT_KEY, { ...readJSON<Record<string, string>>(RULE_TEXT_KEY, {}), [persona]: rules.join('. ') });
}

function loadApps(persona: string): string[] {
  return readJSON<Record<string, string[]>>(APPS_KEY, {})[persona] ?? HUB_CONTENT[persona]?.apps ?? [];
}

function saveApps(persona: string, apps: string[]) {
  writeJSON(APPS_KEY, { ...readJSON<Record<string, string[]>>(APPS_KEY, {}), [persona]: apps });
}

const glass = 'rounded-[22px] bg-[#fdfcf8]/70 backdrop-blur-xl border border-[#fdfcf8]/80 shadow-[0_18px_50px_rgba(20,30,15,0.18)]';

// Very small JS highlighter for the developer example.
function Code({ text }: { text: string }) {
  const parts = text.split(/(\bfunction\b|\breturn\b|\bconst\b|=>|\.\.\.|\b\d+\b|\bsort\b|\bsortArray\b)/g);
  const colour = (p: string) =>
    /^(function|return|const)$/.test(p) ? '#c586c0' : p === '=>' || p === '...' ? '#d4d4d4' : /^\d+$/.test(p) ? '#b5cea8' : p === 'sortArray' || p === 'sort' ? '#dcdcaa' : '#9cdcfe';
  return (
    <pre className="m-0 whitespace-pre font-mono text-[12.5px] leading-relaxed text-[#9cdcfe]">
      {parts.map((p, i) => (
        <span key={i} style={{ color: colour(p) }}>
          {p}
        </span>
      ))}
    </pre>
  );
}

export default function HubPanel({ persona, origin }: { persona: string; origin?: { x: number; y: number } }) {
  const content = HUB_CONTENT[persona];
  const [apps, setApps] = useState(() => loadApps(persona));
  const [rules, setRules] = useState(() => loadRules(persona));
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [picking, setPicking] = useState(false);
  const [heard, setHeard] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setApps(loadApps(persona));
    setRules(loadRules(persona));
    setEditing(null);
    setPicking(false);
    setHeard(false);
    // Kivi "hears" the example, then types its rewrite.
    const t = setTimeout(() => setHeard(true), 900);
    return () => clearTimeout(t);
  }, [persona]);

  useEffect(() => {
    if (editing !== null) input.current?.focus();
  }, [editing]);

  const typed = useTypewriter(content?.example.output ?? '', heard, content?.example.code ? 18 : 32);
  if (!content) return null;

  const commit = () => {
    if (editing === null) return;
    const text = draft.trim();
    const next = [...rules];
    if (!text) next.splice(editing, 1);
    else next[editing] = text;
    setRules(next);
    saveRules(persona, next);
    setEditing(null);
  };

  const remove = (i: number) => {
    const next = rules.filter((_, k) => k !== i);
    setRules(next);
    saveRules(persona, next);
    if (editing === i) setEditing(null);
  };

  const add = () => {
    const next = [...rules, ''];
    setRules(next);
    setDraft('');
    setEditing(next.length - 1);
  };

  const addApp = (app: string) => {
    const next = [...apps, app];
    setApps(next);
    saveApps(persona, next);
    setPicking(false);
  };

  const removeApp = (app: string) => {
    const next = apps.filter((a) => a !== app);
    setApps(next);
    saveApps(persona, next);
  };

  const spare = KNOWN_APPS.filter((a) => !apps.includes(a));
  // Grow out of Kivi's device: the panel sits at left 20px / top 64px.
  const ox = (origin?.x ?? 120) - 20;
  const oy = (origin?.y ?? 200) - 64;

  return (
    <motion.div
      key={persona}
      initial={{ opacity: 0, scale: 0.35, clipPath: `circle(0px at ${ox}px ${oy}px)` }}
      animate={{ opacity: 1, scale: 1, clipPath: `circle(160% at ${ox}px ${oy}px)` }}
      exit={{ opacity: 0, scale: 0.6, clipPath: `circle(0px at ${ox}px ${oy}px)` }}
      transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      style={{ transformOrigin: `${ox}px ${oy}px` }}
      className="absolute left-5 top-16 bottom-24 w-[min(440px,48%)] flex flex-col gap-3 pointer-events-auto text-[#26302a]"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Apps where this persona switches on automatically */}
      <div className={`${glass} p-2.5 relative`}>
        <div className="flex flex-wrap gap-2">
          {apps.map((app) => (
            <div key={app} className="group relative w-11 h-11" title={app}>
              <div className="w-full h-full rounded-xl bg-[#fdfcf8] shadow-sm p-0.5" role="img" aria-label={app}>
                <AppIcon app={app} />
              </div>
              <button
                type="button"
                aria-label={`Remove ${app}`}
                onClick={() => removeApp(app)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#26302a] text-[#fdfcf8] items-center justify-center hidden group-hover:flex cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          <button
            type="button"
            aria-label="Add an app"
            title="Add an app"
            onClick={() => setPicking((p) => !p)}
            className="w-11 h-11 rounded-xl bg-[#fdfcf8]/60 border border-dashed border-[#26302a]/25 flex items-center justify-center text-[#26302a]/60 hover:bg-[#fdfcf8] cursor-pointer"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
        <AnimatePresence>
          {picking && spare.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className={`${glass} absolute left-2 right-2 top-full mt-2 p-2 flex flex-wrap gap-2 z-10 bg-[#fdfcf8]/90`}
            >
              {spare.map((app) => (
                <button key={app} type="button" title={app} aria-label={`Add ${app}`} onClick={() => addApp(app)} className="w-10 h-10 rounded-xl hover:scale-105 transition-transform cursor-pointer">
                  <AppIcon app={app} />
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* One example: what you say, what Kivi writes */}
      <div className={`${glass} p-3 flex flex-col gap-2.5`}>
        <div className="flex items-center gap-2 rounded-2xl bg-[#fdfcf8] px-3.5 py-2.5 shadow-sm">
          <span className="flex-1 text-[15px] text-[#26302a]/80">{content.example.input}</span>
          <Mic className="w-4 h-4 text-[#26302a]/60" aria-label="Spoken" />
        </div>
        <div className="flex items-center gap-2 pl-4 text-[#62823a]">
          <Sparkles className="w-4 h-4" aria-hidden="true" />
          <span className="h-px flex-1 bg-[#62823a]/25" />
        </div>
        <div className={`rounded-2xl px-3.5 py-3 shadow-sm min-h-[3.25rem] ${content.example.code ? 'bg-[#1e1e1e]' : 'bg-[#eef3e6]'}`}>
          {content.example.code ? <Code text={typed} /> : <p className="m-0 text-[15px] leading-snug text-[#26302a]">{typed}</p>}
        </div>
      </div>

      {/* Custom rules */}
      <div className={`${glass} p-3 flex flex-col gap-2 min-h-0`}>
        <div className="flex items-center gap-2 px-1 text-[#26302a]/70">
          <Settings className="w-4 h-4" aria-hidden="true" />
          <span className="text-[13px] font-semibold tracking-wide">My Custom Rules</span>
        </div>
        <ul className="m-0 p-0 list-none flex flex-col gap-1.5 overflow-y-auto min-h-0">
          {rules.map((rule, i) => (
            <li key={i} className="flex items-center gap-2 rounded-xl bg-[#fdfcf8] px-2.5 py-2 shadow-sm">
              <Settings className="w-4 h-4 shrink-0 text-[#62823a]" aria-hidden="true" />
              {editing === i ? (
                <input
                  ref={input}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commit();
                    if (e.key === 'Escape') {
                      if (!rules[i]) remove(i);
                      setEditing(null);
                    }
                  }}
                  onBlur={commit}
                  aria-label="Rule"
                  placeholder="Describe a rule"
                  className="flex-1 min-w-0 bg-transparent outline-none text-[14px] text-[#26302a] placeholder-[#26302a]/40"
                />
              ) : (
                <span className="flex-1 min-w-0 text-[14px] leading-snug">{rule}</span>
              )}
              {editing === i ? (
                <button type="button" aria-label="Save rule" onMouseDown={(e) => e.preventDefault()} onClick={commit} className="p-1.5 rounded-lg text-[#62823a] hover:bg-[#62823a]/10 cursor-pointer">
                  <Check className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  aria-label="Edit rule"
                  onClick={() => {
                    setDraft(rule);
                    setEditing(i);
                  }}
                  className="p-1.5 rounded-lg text-[#26302a]/55 hover:bg-[#26302a]/5 cursor-pointer"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              )}
              <button type="button" aria-label="Delete rule" onMouseDown={(e) => e.preventDefault()} onClick={() => remove(i)} className="p-1.5 rounded-lg text-[#26302a]/55 hover:bg-[#b3503f]/10 hover:text-[#b3503f] cursor-pointer">
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={add}
          className="flex items-center gap-2 self-start rounded-xl bg-[#fdfcf8] px-3 py-2 text-[14px] font-semibold shadow-sm hover:bg-[#fdfcf8]/80 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Add rule
        </button>
      </div>
    </motion.div>
  );
}
