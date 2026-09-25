import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Check, Plus, X } from 'lucide-react';
import { EASE_OUT, Hub } from './config';

/*
 * Glass settings card for one persona: the apps it applies to (icons only),
 * an example of what Kivi does with your words, and your own rules.
 */

const SANS = { fontFamily: 'ui-sans-serif, system-ui, sans-serif' };
const CREAM = '#f1ecd9';
const GREEN = '#a4e35a';

export const cardVariants = {
  hidden: { opacity: 0, x: -48, filter: 'blur(6px)' },
  shown: { opacity: 1, x: 0, filter: 'blur(0px)', transition: { duration: 0.7, ease: EASE_OUT, delay: 0.6, staggerChildren: 0.07, delayChildren: 0.75 } },
  gone: { opacity: 0, x: -48, filter: 'blur(6px)', transition: { duration: 0.35, ease: 'easeIn' } },
};
const item = {
  hidden: { opacity: 0, y: 10 },
  shown: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE_OUT } },
};

function Overline({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] uppercase tracking-[0.14em] mb-2.5" style={{ ...SANS, color: `${CREAM}80` }}>
      {children}
    </div>
  );
}

interface Props {
  hub: Hub;
  active: boolean;
  onUse: () => void;
}

export default function PersonaCard({ hub, active, onUse }: Props) {
  const [apps, setApps] = useState(() => new Set(hub.apps.map((a) => a.name)));
  const [rules, setRules] = useState(hub.rules);
  const [draft, setDraft] = useState('');
  const Icon = hub.icon;

  const addRule = () => {
    const r = draft.trim();
    if (!r) return;
    setRules((all) => [...all, r]);
    setDraft('');
  };

  return (
    <motion.aside
      variants={cardVariants}
      initial="hidden"
      animate="shown"
      exit="gone"
      className="pointer-events-auto w-full max-h-full overflow-y-auto rounded-3xl p-6 space-y-6 border backdrop-blur-2xl"
      style={{ background: 'linear-gradient(160deg, rgba(24,32,20,0.62), rgba(10,14,9,0.5))', borderColor: 'rgba(255,255,255,0.12)', boxShadow: '0 30px 80px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08)', color: CREAM }}
    >
      <motion.header variants={item} className="flex items-center gap-4">
        <span className="grid place-items-center w-12 h-12 rounded-2xl shrink-0" style={{ background: `${hub.accent}1f`, boxShadow: `inset 0 0 0 1px ${hub.accent}55` }}>
          <Icon className="w-5 h-5" style={{ color: hub.accent }} />
        </span>
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-[0.14em]" style={{ ...SANS, color: `${CREAM}80` }}>
            Persona
          </div>
          <h2 className="font-serif text-[32px] leading-none tracking-[-0.01em] mt-1">{hub.label}</h2>
        </div>
      </motion.header>

      <motion.section variants={item}>
        <div className="flex gap-2.5">
          {hub.apps.map(({ icon: AppIcon, name }) => {
            const on = apps.has(name);
            return (
              <button
                key={name}
                aria-label={name}
                aria-pressed={on}
                title={name}
                onClick={() =>
                  setApps((s) => {
                    const n = new Set(s);
                    if (on) n.delete(name);
                    else n.add(name);
                    return n;
                  })
                }
                className="grid place-items-center w-11 h-11 rounded-xl transition-all duration-200 hover:scale-105"
                style={on ? { background: `${hub.accent}24`, boxShadow: `inset 0 0 0 1px ${hub.accent}88` } : { background: 'rgba(255,255,255,0.05)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)' }}
              >
                <AppIcon className="w-[18px] h-[18px]" style={{ color: on ? hub.accent : `${CREAM}66` }} />
              </button>
            );
          })}
        </div>
      </motion.section>

      <motion.section variants={item}>
        <Overline>How Kivi rewrites you</Overline>
        <div className="rounded-2xl p-4 space-y-2" style={{ background: 'rgba(0,0,0,0.25)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06)' }}>
          <p className="text-[14px] italic" style={{ color: `${CREAM}8c` }}>
            "{hub.example.said}"
          </p>
          <ArrowRight className="w-4 h-4 rotate-90" style={{ color: hub.accent }} />
          <p className="font-serif text-[21px] leading-snug">{hub.example.written}</p>
        </div>
      </motion.section>

      <motion.section variants={item}>
        <Overline>Your rules</Overline>
        <ul className="space-y-1.5" style={SANS}>
          <AnimatePresence initial={false}>
            {rules.map((r) => (
              <motion.li
                key={r}
                layout
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="group flex items-center gap-3 rounded-xl px-3 py-2 text-[13.5px]"
                style={{ background: 'rgba(255,255,255,0.04)' }}
              >
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: hub.accent }} />
                <span className="flex-1">{r}</span>
                <button aria-label={`Remove rule: ${r}`} onClick={() => setRules((all) => all.filter((x) => x !== r))} className="opacity-0 group-hover:opacity-70 hover:!opacity-100 focus:opacity-100 transition-opacity">
                  <X className="w-3.5 h-3.5" />
                </button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            addRule();
          }}
          className="mt-2 flex items-center gap-2 rounded-xl px-3 py-2"
          style={{ ...SANS, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.1)' }}
        >
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add a rule…" className="flex-1 bg-transparent outline-none text-[13.5px]" style={{ color: CREAM }} />
          <button type="submit" aria-label="Add rule" className="opacity-70 hover:opacity-100">
            <Plus className="w-4 h-4" />
          </button>
        </form>
      </motion.section>

      <motion.div variants={item} style={SANS}>
        {active ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl py-3 text-[14px] font-semibold" style={{ color: GREEN, background: `${GREEN}14` }}>
            <Check className="w-4 h-4" /> Kivi is using this persona
          </div>
        ) : (
          <motion.button
            onClick={onUse}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full rounded-2xl py-3 text-[15px] font-bold"
            style={{ background: GREEN, color: '#10170c', boxShadow: `0 10px 36px ${GREEN}40` }}
          >
            Use this persona
          </motion.button>
        )}
      </motion.div>
    </motion.aside>
  );
}
