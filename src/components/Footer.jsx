import { COMPANY, FOOTER } from '../lib/site-data.js';
import Reveal from './ui/Reveal.jsx';
import { BrandLogo } from '../ui/BrandLogo';

export default function Footer() {
  return (
    <footer className="relative border-t border-fg/10 bg-surface/80 backdrop-blur-xl">
      <div className="shell py-16 sm:py-20">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_2fr]">
          {/* Identity */}
          <Reveal>
            <BrandLogo alt={COMPANY.name} className="h-10 w-auto" />

            <p className="mt-6 font-cond text-sm uppercase tracking-wider2 text-accent-magenta">
              {COMPANY.tagline}
            </p>

            <p className="mt-5 max-w-sm text-sm leading-relaxed text-fg/74">{FOOTER.blurb}</p>

            <div className="mt-7 space-y-1.5">
              <p className="font-mono text-[11px] tracking-wider2 text-fg/78">
                {FOOTER.contact.email}
              </p>
              <p className="font-mono text-[11px] tracking-wider2 text-fg/78">
                {FOOTER.contact.phone}
              </p>
              <p className="max-w-xs text-xs leading-relaxed text-fg/68">
                {FOOTER.contact.address}
              </p>
            </div>
          </Reveal>

          {/* Link columns */}
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {FOOTER.columns.map((col, i) => (
              <Reveal key={col.title} delay={i * 0.08}>
                <h3 className="hud-label">{col.title}</h3>
                <ul className="mt-5 space-y-3">
                  {col.links.map((link) => (
                    <li key={link}>
                      <a
                        href="#top"
                        className="text-sm text-fg/74 transition-colors duration-300 hover:text-accent-solar"
                      >
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </Reveal>
            ))}
          </div>
        </div>

        <div className="mt-16 flex flex-col gap-4 border-t border-fg/10 pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-mono text-[10px] uppercase tracking-hud text-fg/68">
            © {new Date().getFullYear()} {COMPANY.name} · Internal use only
          </p>
          <p className="font-mono text-[10px] uppercase tracking-hud text-fg/68">
            {COMPANY.tagline}
          </p>
        </div>
      </div>
    </footer>
  );
}
