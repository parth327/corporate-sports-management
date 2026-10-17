import { useBuilder } from '../store/builderStore';

/**
 * Speaks every change to the lineup. The pitch is a canvas and the chips move
 * on their own, so this polite live region is how a screen reader user hears
 * that a player landed, who was swapped out, and what the team rating is now.
 */
export function Announcer() {
  const message = useBuilder((s) => s.announcement);
  return (
    <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {message}
    </p>
  );
}
