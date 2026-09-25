import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, UserRound, X } from 'lucide-react';
import { APP_LIBRARY, ASSETS, App, EASE_OUT, Hub } from './config';
import { BrandIcon } from './brands';

/*
 * Glass settings card for one persona: the apps it applies to (brand logos,
 * with + to add more), a two-line exchange showing what you said and what
 * Kivi writes, and your own rules.
 */

const SANS = { fontFamily: 'ui-sans-serif, system-ui, sans-serif' };
const CREAM = '#f1ecd9';

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

// Kivi's app-icon avatar.
function KiviAvatar() {
  return <img src={ASSETS.kiviAvatar} alt="Kivi" draggable={false} className="w-8 h-8 shrink-0 rounded-[9px]" style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.12)' }} />;
}

// Same rounded-square glass tile for app icons and the + button.
const tile = 'grid place-items-center w-11 h-11 rounded-xl border transition-colors duration-200';

export default function PersonaCard({ hub }: { hub: Hub }) {
  const [assigned, setAssigned] = useState<App[]>(hub.apps);
  const [apps, setApps] = useState(() => new Set(hub.apps.map((a) => a.name)));
  const [picking, setPicking] = useState(false);
  const available = APP_LIBRARY.filter((a) => !assigned.some((x) => x.name === a.name));
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
          <h2 className="font-serif text-[32px] leading-none tracking-[-0.01em] mt-1">{hub.persona}</h2>
        </div>
      </motion.header>

      <motion.section variants={item}>
        <div className="flex flex-wrap gap-2.5">
          {assigned.map(({ brand, name }) => {
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
                className={`${tile} hover:scale-105`}
                style={on ? { background: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.16)' } : { background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.06)' }}
              >
                {/* switched-off apps fade to grey */}
                <BrandIcon id={brand} className="w-[22px] h-[22px] transition-[filter,opacity] duration-200" style={on ? undefined : { filter: 'grayscale(1)', opacity: 0.35 }} />
              </button>
            );
          })}
          {available.length > 0 && (
            <motion.button
              aria-label="Add an app to this persona"
              aria-expanded={picking}
              title="Add an app"
              onClick={() => setPicking((p) => !p)}
              // Inline colours: the app theme overrides Tailwind's white/alpha utilities.
              style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.12)' }}
              whileHover={{ scale: 1.08, borderColor: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.1)' }}
              whileTap={{ scale: 0.95 }}
              className={tile}
            >
              <motion.span animate={{ rotate: picking ? 45 : 0 }} transition={{ duration: 0.2 }} className="grid place-items-center">
                <Plus className="w-[18px] h-[18px]" style={{ color: `${CREAM}b3` }} />
              </motion.span>
            </motion.button>
          )}
        </div>

        {/* apps that can be added, shown when + is open */}
        <AnimatePresence initial={false}>
          {picking && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: EASE_OUT }}
              className="overflow-hidden"
            >
              <div className="mt-3 flex flex-wrap gap-2 rounded-2xl p-2.5" style={{ background: 'rgba(0,0,0,0.22)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06)' }}>
                {available.map((app) => {
                  return (
                    <motion.button
                      key={app.name}
                      aria-label={`Add ${app.name}`}
                      title={app.name}
                      onClick={() => {
                        setAssigned((a) => [...a, app]);
                        setApps((s) => new Set(s).add(app.name));
                      }}
                      style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }}
                      whileHover={{ scale: 1.08, borderColor: 'rgba(255,255,255,0.3)' }}
                      whileTap={{ scale: 0.95 }}
                      className="grid place-items-center w-9 h-9 rounded-lg border"
                    >
                      <BrandIcon id={app.brand} className="w-[18px] h-[18px]" />
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.section>

      <motion.section variants={item}>
        {/* what you said, then what Kivi writes */}
        <div className="rounded-2xl p-3 space-y-2.5" style={{ background: 'rgba(0,0,0,0.25)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-3">
            <span aria-label="You said" role="img" className="grid place-items-center w-8 h-8 shrink-0 rounded-full" style={{ background: 'rgba(255,255,255,0.08)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.12)' }}>
              <UserRound className="w-4 h-4" style={{ color: `${CREAM}b3` }} />
            </span>
            <p className="rounded-2xl rounded-tl-md px-3.5 py-2 text-[14px] italic" style={{ color: `${CREAM}a6`, background: 'rgba(255,255,255,0.05)' }}>
              {hub.example.said}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <KiviAvatar />
            <p className="flex-1 rounded-2xl rounded-tl-md px-3.5 py-2 font-serif text-[19px] leading-snug" style={{ background: `${hub.accent}14`, boxShadow: `inset 0 0 0 1px ${hub.accent}33` }}>
              {hub.example.written}
            </p>
          </div>
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

    </motion.aside>
  );
}
