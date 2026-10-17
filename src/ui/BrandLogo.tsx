import { useTheme } from '@/hooks/useTheme';

interface BrandLogoProps {
  alt: string;
  className?: string;
  /**
   * Overrides the theme-based choice. `logo-light.svg` carries a white
   * wordmark (for a dark background); `logo.svg` carries a near-black
   * one (for a light background) — see public/brand/. Most call sites just
   * want whichever matches the site theme, but the public Nav's transparent
   * header sits directly over the WebGL stadium, which stays night-dark in
   * both themes (see StadiumBackdrop.tsx), so it forces white regardless of
   * theme until the header scrolls to its opaque `bg-surface` state.
   */
  forceWhite?: boolean;
}

export function BrandLogo({ alt, className, forceWhite }: BrandLogoProps) {
  const { theme } = useTheme();
  const useWhite = forceWhite || theme === 'dark';

  return (
    <img
      src={useWhite ? '/brand/logo-light.svg' : '/brand/logo.svg'}
      alt={alt}
      width="424"
      height="80"
      className={className}
    />
  );
}
