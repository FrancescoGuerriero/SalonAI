const toggle = document.querySelector('.nav-toggle');
const nav = document.querySelector('#site-nav');

if (toggle && nav) {
  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(open));
  });

  nav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      nav.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
    });
  });
}

const filters = [...document.querySelectorAll('.filter')];
const cards = [...document.querySelectorAll('.module-card')];

filters.forEach((filter) => {
  filter.addEventListener('click', () => {
    const target = filter.dataset.filter || 'all';

    filters.forEach((item) => item.classList.toggle('is-active', item === filter));
    cards.forEach((card) => {
      card.hidden = target !== 'all' && card.dataset.group !== target;
    });
  });
});

const revealTargets = document.querySelectorAll('.module-card, .flow-grid article, .timeline li, .vertical-grid article');

if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.animate(
          [
            { opacity: 0, transform: 'translateY(14px)' },
            { opacity: 1, transform: 'translateY(0)' },
          ],
          { duration: 420, easing: 'ease-out', fill: 'both' }
        );
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08 });

  revealTargets.forEach((target) => observer.observe(target));
}
