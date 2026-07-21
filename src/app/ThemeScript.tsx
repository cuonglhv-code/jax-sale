/**
 * Applies the persisted theme class to <html> before hydration, avoiding a flash of the wrong
 * theme. Reads localStorage['jax-theme'] directly (no React state yet at this point) — must run as
 * an inline synchronous script, not a component effect, or the flash isn't prevented.
 */
export function ThemeScript() {
  const script = `
    try {
      const t = localStorage.getItem('jax-theme');
      if (t === 'dark' || (t !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
      }
    } catch (e) {}
  `;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
