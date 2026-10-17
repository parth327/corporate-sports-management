import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ACCENTS, EVENTS, REGISTER_COPY } from '../lib/site-data.js';
import { DURATION, EASE, VIEWPORT } from '../lib/motion.js';
import { useSectionAccent } from '../lib/hooks.js';
import SectionHeading from './ui/SectionHeading.jsx';
import Reveal from './ui/Reveal.jsx';

const FIELD =
  'w-full rounded-xl border border-white/12 bg-ink-900/60 px-4 py-3.5 text-[15px] text-white placeholder:text-white/25 transition-colors duration-300 focus:border-solar-400 focus:outline-none';

const EMPTY = { name: '', empId: '', division: '', event: '', phone: '' };

export default function Register() {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const accentRef = useSectionAccent(ACCENTS.phthalo.hex);

  const update = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  };

  const validate = () => {
    const next = {};
    if (!form.name.trim()) next.name = 'Tell us who you are.';
    if (!/^[A-Za-z0-9-]{4,}$/.test(form.empId.trim())) next.empId = 'Employee ID looks incomplete.';
    if (!form.division) next.division = 'Pick your division.';
    if (!form.event) next.event = 'Pick at least one event.';
    if (!/^[0-9+\s-]{10,}$/.test(form.phone.trim())) next.phone = 'A reachable number, please.';
    return next;
  };

  const onSubmit = (e) => {
    e.preventDefault();
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    // No backend on the portal yet — this is where the committee's intake
    // endpoint gets wired in. Until then the entry is confirmed optimistically.
    setSubmitted(true);
  };

  return (
    <section ref={accentRef} id="register" className="relative py-24 sm:py-32">
      <div className="shell">
        <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-ink-800/60 backdrop-blur-2xl">
          {/* Ambient wash */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-phthalo-500/20 blur-[130px]"
          />
          <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-grid-fade bg-grid opacity-25" />

          <div className="relative grid gap-12 p-7 sm:p-12 lg:grid-cols-[1fr_1.05fr] lg:gap-16 lg:p-16">
            {/* Left: pitch + steps */}
            <div>
              <SectionHeading
                eyebrow={REGISTER_COPY.eyebrow}
                title={REGISTER_COPY.title}
                body={REGISTER_COPY.body}
                accentClass="text-phthalo-400"
                titleClass="text-[clamp(2rem,5vw,3.6rem)]"
              />

              <ol className="mt-12 space-y-0">
                {REGISTER_COPY.steps.map((step, i) => (
                  <Reveal
                    key={step.n}
                    as="li"
                    delay={i * 0.1}
                    className="flex gap-5 border-t border-white/10 py-6 last:border-b"
                  >
                    <span className="font-display text-2xl leading-none text-phthalo-400">{step.n}</span>
                    <div>
                      <h3 className="font-cond text-lg uppercase tracking-wider2 text-white">
                        {step.title}
                      </h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-white/50">{step.body}</p>
                    </div>
                  </Reveal>
                ))}
              </ol>
            </div>

            {/* Right: form */}
            <div className="relative">
              <AnimatePresence mode="wait">
                {submitted ? (
                  <motion.div
                    key="done"
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: DURATION.base, ease: EASE.luxe }}
                    className="flex h-full min-h-[420px] flex-col items-center justify-center rounded-2xl border border-phthalo-500/30 bg-phthalo-600/10 p-10 text-center"
                  >
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ duration: DURATION.slow, ease: EASE.pop, delay: 0.1 }}
                      className="grid h-16 w-16 place-items-center rounded-full bg-phthalo-500 text-2xl text-ink-900"
                    >
                      ✓
                    </motion.span>
                    <h3 className="mt-6 font-display text-3xl uppercase tracking-tight text-white">
                      You’re in
                    </h3>
                    <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/60">
                      Entry received for <span className="text-phthalo-300">{form.event}</span>. Your
                      divisional sports secretary will confirm your slot within two working days.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setForm(EMPTY);
                        setSubmitted(false);
                      }}
                      className="mt-8 font-cond text-sm uppercase tracking-wider2 text-white/50 underline-offset-4 transition-colors hover:text-white hover:underline"
                    >
                      Submit another entry
                    </button>
                  </motion.div>
                ) : (
                  <motion.form
                    key="form"
                    onSubmit={onSubmit}
                    noValidate
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: DURATION.base }}
                    className="space-y-5"
                  >
                    <motion.div
                      initial="hidden"
                      whileInView="show"
                      viewport={VIEWPORT}
                      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
                      className="space-y-5"
                    >
                      {[
                        { key: 'name', label: 'Full name', type: 'text', placeholder: 'As it appears on your ID card' },
                        { key: 'empId', label: 'Employee ID', type: 'text', placeholder: 'ACE-00000' },
                        { key: 'phone', label: 'Mobile', type: 'tel', placeholder: '+91 00000 00000' },
                      ].map((field) => (
                        <motion.div
                          key={field.key}
                          variants={{
                            hidden: { opacity: 0, y: 16 },
                            show: { opacity: 1, y: 0, transition: { duration: DURATION.base, ease: EASE.luxe } },
                          }}
                        >
                          <label
                            htmlFor={field.key}
                            className="mb-2 block font-mono text-[10px] uppercase tracking-hud text-white/45"
                          >
                            {field.label}
                          </label>
                          <input
                            id={field.key}
                            type={field.type}
                            value={form[field.key]}
                            onChange={update(field.key)}
                            placeholder={field.placeholder}
                            aria-invalid={Boolean(errors[field.key])}
                            className={`${FIELD} ${errors[field.key] ? 'border-rose-400/60' : ''}`}
                          />
                          {errors[field.key] && (
                            <p className="mt-1.5 font-mono text-[10px] uppercase tracking-hud text-rose-400">
                              {errors[field.key]}
                            </p>
                          )}
                        </motion.div>
                      ))}

                      {/* Selects */}
                      <motion.div
                        variants={{
                          hidden: { opacity: 0, y: 16 },
                          show: { opacity: 1, y: 0, transition: { duration: DURATION.base, ease: EASE.luxe } },
                        }}
                        className="grid gap-5 sm:grid-cols-2"
                      >
                        <div>
                          <label
                            htmlFor="division"
                            className="mb-2 block font-mono text-[10px] uppercase tracking-hud text-white/45"
                          >
                            Division
                          </label>
                          <select
                            id="division"
                            value={form.division}
                            onChange={update('division')}
                            aria-invalid={Boolean(errors.division)}
                            className={`${FIELD} ${errors.division ? 'border-rose-400/60' : ''}`}
                          >
                            <option value="">Select…</option>
                            {REGISTER_COPY.divisions.map((d) => (
                              <option key={d} value={d}>
                                {d}
                              </option>
                            ))}
                          </select>
                          {errors.division && (
                            <p className="mt-1.5 font-mono text-[10px] uppercase tracking-hud text-rose-400">
                              {errors.division}
                            </p>
                          )}
                        </div>

                        <div>
                          <label
                            htmlFor="event"
                            className="mb-2 block font-mono text-[10px] uppercase tracking-hud text-white/45"
                          >
                            Event
                          </label>
                          <select
                            id="event"
                            value={form.event}
                            onChange={update('event')}
                            aria-invalid={Boolean(errors.event)}
                            className={`${FIELD} ${errors.event ? 'border-rose-400/60' : ''}`}
                          >
                            <option value="">Select…</option>
                            {EVENTS.map((e) => (
                              <option key={e.id} value={e.name}>
                                {e.name}
                              </option>
                            ))}
                          </select>
                          {errors.event && (
                            <p className="mt-1.5 font-mono text-[10px] uppercase tracking-hud text-rose-400">
                              {errors.event}
                            </p>
                          )}
                        </div>
                      </motion.div>
                    </motion.div>

                    <motion.button
                      type="submit"
                      whileHover={{ scale: 1.015 }}
                      whileTap={{ scale: 0.985 }}
                      transition={{ duration: DURATION.fast, ease: EASE.luxe }}
                      className="btn-primary !w-full"
                    >
                      Submit entry
                    </motion.button>

                    <p className="text-center text-xs leading-relaxed text-white/30">
                      Entries are visible to your divisional sports secretary and the Engagement
                      Council only.
                    </p>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
