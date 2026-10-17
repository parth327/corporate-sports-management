import { useEffect, useState } from 'react';

/**
 * Matches a media query and stays in sync with it. The site has one in
 * lib/hooks.js, but that module also pulls in the landing page's smooth
 * scroller and its stylesheet, which the lab has no use for.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const list = window.matchMedia(query);
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    setMatches(list.matches);
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}
