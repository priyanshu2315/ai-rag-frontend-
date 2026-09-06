import { memo } from 'react';
import cn from '../../utils/cn';
import { AI_PLATFORMS, ENV_KEYS, NPM_PACKAGES, STACK_NOTE } from '../../constants/techStack';

const DOT_CLASSES = {
  blue: 'bg-blue',
  green: 'bg-green',
  purple: 'bg-purple',
  amber: 'bg-amber',
  teal: 'bg-teal',
};

/**
 * Sits below the pipeline timeline as its own section, so it reads as
 * "here's what's actually running under the hood" rather than another
 * numbered phase. Cards for the platforms (visual weight, since that's the
 * interesting part), plain lists for the env keys and packages (reference
 * material, not something to linger on).
 */
const TechStack = memo(() => (
  <section>
    <div className="mb-6 flex items-center gap-3">
      <span className="h-px flex-1 bg-border" />
      <h2 className="font-display text-[11px] font-semibold uppercase tracking-wider text-muted">
        AI Platforms &amp; Models
      </h2>
      <span className="h-px flex-1 bg-border" />
    </div>

    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {AI_PLATFORMS.map((platform) => (
        <li
          key={platform.name}
          className="rounded-(--radius) border border-border bg-surface p-4 shadow-(--sh-sm)"
        >
          <div className="flex items-center gap-2">
            <span className={cn('h-2 w-2 shrink-0 rounded-full', DOT_CLASSES[platform.color])} />
            <h3 className="font-display text-[13px] font-semibold text-ink">{platform.name}</h3>
          </div>
          <p className="mono mt-2 text-[11px] leading-snug text-ink-2">{platform.model}</p>
          <p className="mt-1.5 text-[12px] leading-relaxed text-muted">{platform.purpose}</p>
          <p className="mono mt-2.5 text-[10.5px] text-muted-2">{platform.package}</p>
        </li>
      ))}
    </ul>

    <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="rounded-(--radius) border border-border bg-surface-2 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-2">
          API Keys Required (.env)
        </p>
        {/* The note sits under its key rather than beside it: most keys carry
            one now, and the longest would otherwise squeeze the name it
            belongs to. */}
        <ul className="mt-2 space-y-2">
          {ENV_KEYS.map(({ key, note }) => (
            <li key={key}>
              <span className="mono text-[11.5px] text-ink-2">{key}</span>
              {note && <p className="text-[10.5px] leading-snug text-muted-2">{note}</p>}
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-(--radius) border border-border bg-surface-2 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-2">
          NPM Packages
        </p>
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {NPM_PACKAGES.map((pkg) => (
            <li
              key={pkg}
              className="mono rounded-(--radius-sm) border border-border bg-surface px-2 py-1 text-[10.5px] text-muted"
            >
              {pkg}
            </li>
          ))}
        </ul>
      </div>
    </div>

    <p className="mt-6 border-l-2 border-blue/30 py-1 pl-4 text-[12.5px] italic leading-relaxed text-muted">
      {STACK_NOTE}
    </p>
  </section>
));

TechStack.displayName = 'TechStack';

export default TechStack;
