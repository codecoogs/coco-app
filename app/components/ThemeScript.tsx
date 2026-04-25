/**
 * Inline script that runs before React to set .dark on <html> from cookie or system preference
 * when the server didn't set it (e.g. theme is "system" or cookie missing). Reduces flash.
 * Must match ThemeContext cookie name (coco-theme) and logic.
 */
export function ThemeScript() {
  const script = `
(function() {
  var cookie = document.cookie.split('; ').find(function(r) { return r.startsWith('coco-theme='); });
  var theme = cookie ? cookie.split('=')[1] : 'system';
  var systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  var resolved = (theme === 'system') ? (systemDark ? 'dark' : 'light') : (theme === 'dark' || theme === 'frappe' || theme === 'macchiato' || theme === 'mocha') ? 'dark' : 'light';
  var root = document.documentElement;
  root.classList.toggle('dark', resolved === 'dark');
  root.classList.toggle('theme-latte', theme === 'latte');
  root.classList.toggle('theme-frappe', theme === 'frappe');
  root.classList.toggle('theme-macchiato', theme === 'macchiato');
  root.classList.toggle('theme-mocha', theme === 'mocha');
  root.setAttribute('data-theme', theme);
})();
`;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
