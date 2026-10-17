// chalk-talk landing page: theme toggle, install tabs + copy, live hero talk.
(() => {
  const root = document.documentElement;
  const KEY = 'chalk-talk-theme';           // same key the talks use, so a talk opens in the theme picked here
  const sys = matchMedia('(prefers-color-scheme: dark)');
  const saved = () => { try { return localStorage.getItem(KEY); } catch (_) { return null; } };
  const theme = () => root.dataset.theme;

  /* ---------- theme ---------- */
  const toggle = document.getElementById('theme');
  function setTheme(t, save) {
    root.dataset.theme = t;
    toggle.setAttribute('aria-label', t === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    if (save) { try { localStorage.setItem(KEY, t); } catch (_) {} }
    themeFrames();
  }
  toggle.addEventListener('click', () => setTheme(theme() === 'dark' ? 'light' : 'dark', true));
  sys.addEventListener('change', e => { if (!saved()) setTheme(e.matches ? 'dark' : 'light'); });

  /* ---------- install tabs + copy ---------- */
  document.querySelectorAll('.install').forEach(box => {
    const tabs = [...box.querySelectorAll('[role=tab]')];
    const select = (tab, focus) => {
      tabs.forEach(t => {
        const on = t === tab;
        t.setAttribute('aria-selected', on); t.tabIndex = on ? 0 : -1;
        document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
      });
      if (focus) tab.focus();
    };
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => select(t));
      t.addEventListener('keydown', e => {
        const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
        if (d) { e.preventDefault(); select(tabs[(i + d + tabs.length) % tabs.length], true); }
      });
    });
    box.querySelectorAll('.copy').forEach(btn => btn.addEventListener('click', async () => {
      const text = [...btn.parentElement.querySelectorAll('pre [data-cmd]')].map(n => n.textContent).join('\n');
      try { await navigator.clipboard.writeText(text); }
      catch (_) {                              // file:// or older browsers
        const ta = Object.assign(document.createElement('textarea'), { value: text });
        document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
      }
      btn.classList.add('done');
      const live = box.querySelector('[aria-live]'); if (live) live.textContent = 'Copied to clipboard';
      setTimeout(() => { btn.classList.remove('done'); if (live) live.textContent = ''; }, 1800);
    }));
  });

  /* ---------- header border on scroll ---------- */
  const top = document.querySelector('.top');
  const onScroll = () => top.classList.toggle('scrolled', scrollY > 8);
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  /* ---------- live talks: each iframe autoplays itself through the talk's own ?play=loop ---------- */
  const frames = [...document.querySelectorAll('.frame iframe')];
  const load = f => { f.parentElement.classList.remove('ready'); f.src = f.dataset.src + '&theme=' + theme(); };
  function themeFrames() { frames.forEach(f => { if (f.src) load(f); }); }   // the talk reads its theme at boot
  frames.forEach(f => f.addEventListener('load', () => f.parentElement.classList.add('ready')));
  // the hero loads once the page is in (the poster paints first); the others when they come near the screen,
  // so they start playing when someone is there to watch
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { io.unobserve(e.target); load(e.target.querySelector('iframe')); }
  }), { rootMargin: '200px' });
  frames.forEach(f => {
    if (!f.hasAttribute('data-eager')) io.observe(f.parentElement);
    else if (document.readyState === 'complete') load(f);
    else addEventListener('load', () => load(f), { once: true });
  });

  /* ---------- clean / chalkboard switch ---------- */
  const seg = [...document.querySelectorAll('.seg-b')];
  const chalk = document.querySelector('#chalk-frame iframe'), open = document.getElementById('chalk-open');
  seg.forEach(b => b.addEventListener('click', () => {
    seg.forEach(x => x.setAttribute('aria-pressed', x === b));
    const page = 'gallery/git-commit/git-commit.html', style = b.dataset.style ? 'style=' + b.dataset.style : '';
    chalk.dataset.src = page + '?' + (style ? style + '&' : '') + 'play=loop';
    open.href = page + (style ? '?' + style : '');
    io.unobserve(chalk.parentElement); load(chalk);
  }));
})();
