import SplitHeading from './SplitHeading.jsx';
import Reveal from './Reveal.jsx';

/**
 * The standard section opener: hairline rule, mono eyebrow, display headline,
 * optional body paragraph. Every section uses it, which is most of what gives
 * the page its rhythm.
 */
/**
 * Text here is literal white/current-colour, not the theme-reactive `fg`
 * token: every section on the public page sits over the fixed WebGL stadium
 * (see Landing.tsx / StadiumBackdrop.tsx), which stays night-dark in both
 * themes, and this heading is never wrapped in its own opaque card — it's
 * the bare intro copy each section opens with. `accentClass` follows the
 * same rule at every call site (pass a literal `text-{hue}-400`, not
 * `text-accent-{hue}`).
 */
export default function SectionHeading({
  eyebrow,
  title,
  body,
  align = 'left',
  accentClass = 'text-azure-400',
  className = '',
  titleClass = 'text-[clamp(2.1rem,6vw,4.6rem)]',
}) {
  const centered = align === 'center';

  return (
    <div className={`${centered ? 'mx-auto max-w-3xl text-center' : 'max-w-3xl'} ${className}`}>
      {eyebrow && (
        <Reveal blur={false} className={`flex items-center gap-3 ${centered ? 'justify-center' : ''}`}>
          <span className={`h-px w-8 bg-current opacity-50 ${accentClass}`} />
          <span className={`hud-label ${accentClass}`}>{eyebrow}</span>
        </Reveal>
      )}

      <SplitHeading
        text={title}
        as="h2"
        className={`display-title mt-5 text-white ${titleClass}`}
      />

      {body && (
        <Reveal delay={0.12} className="mt-6">
          <p className="text-balance text-base leading-relaxed text-white/80 [text-shadow:0_1px_14px_rgba(5,4,10,0.9)] sm:text-lg">
            {body}
          </p>
        </Reveal>
      )}
    </div>
  );
}
