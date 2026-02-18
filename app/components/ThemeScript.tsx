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
  var isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', isDark);
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
})();
`;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
