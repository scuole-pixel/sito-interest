/* Menu a scomparsa per gli schermi stretti: le tre stanghette
   aprono un pannello a cascata sotto l'header. Sul desktop il
   pulsante non esiste (display: none) e questo script resta inerte. */
(() => {
  const header = document.getElementById('header');
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.getElementById('site-nav');
  if (!header || !toggle || !nav) return;

  const set = (open) => {
    header.classList.toggle('menu-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Chiudi il menu' : 'Apri il menu');
  };

  toggle.addEventListener('click', () => set(!header.classList.contains('menu-open')));

  /* scegliere una voce chiude il pannello */
  nav.addEventListener('click', (e) => {
    if (e.target.closest('a')) set(false);
  });

  /* Esc chiude e riporta il focus sulle stanghette */
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && header.classList.contains('menu-open')) {
      set(false);
      toggle.focus();
    }
  });

  /* un tocco fuori dall'header chiude */
  document.addEventListener('click', (e) => {
    if (header.classList.contains('menu-open') && !e.target.closest('.site-header')) set(false);
  });

  /* se la finestra si allarga, il pannello non serve più */
  matchMedia('(min-width: 841px)').addEventListener('change', (e) => {
    if (e.matches) set(false);
  });
})();
