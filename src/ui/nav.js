const SECTIONS = [
  { id: 'home', label: 'Home', icon: '🏠' },
  { id: 'photos', label: 'My Photos', icon: '🖼️' },
  { id: 'albums', label: 'Albums', icon: '📁' },
  { id: 'favorites', label: 'Favorites', icon: '💗' },
  { id: 'settings', label: 'Settings', icon: '⚙️' }
];

export function renderNav(activeSection) {
  const nav = document.createElement('nav');
  nav.className = 'app-nav';
  nav.setAttribute('aria-label', 'Main navigation');

  const inner = document.createElement('div');
  inner.className = 'app-nav-inner';

  const logo = document.createElement('div');
  logo.className = 'app-nav-logo';
  logo.innerHTML = '<span aria-hidden="true">🧵</span> Emi\'s Craft House';

  const menuToggle = document.createElement('button');
  menuToggle.type = 'button';
  menuToggle.className = 'app-nav-toggle';
  menuToggle.setAttribute('aria-label', 'Toggle navigation menu');
  menuToggle.setAttribute('aria-expanded', 'false');
  menuToggle.innerHTML = '<span aria-hidden="true">☰</span>';

  const list = document.createElement('ul');
  list.className = 'app-nav-list';

  SECTIONS.forEach((section) => {
    const item = document.createElement('li');
    const link = document.createElement('button');
    link.type = 'button';
    link.className = `app-nav-link${section.id === activeSection ? ' is-active' : ''}`;
    link.setAttribute('data-section', section.id);
    if (section.id === activeSection) {
      link.setAttribute('aria-current', 'page');
    }
    link.innerHTML = `<span aria-hidden="true">${section.icon}</span> ${section.label}`;
    item.appendChild(link);
    list.appendChild(item);
  });

  inner.appendChild(logo);
  inner.appendChild(menuToggle);
  inner.appendChild(list);
  nav.appendChild(inner);

  return nav;
}

export function attachNavEvents(navElement, onNavigate) {
  const list = navElement.querySelector('.app-nav-list');
  const toggle = navElement.querySelector('.app-nav-toggle');

  navElement.addEventListener('click', (event) => {
    const link = event.target.closest('[data-section]');
    if (link) {
      onNavigate(link.getAttribute('data-section'));
      list.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      return;
    }

    if (event.target.closest('.app-nav-toggle')) {
      const isOpen = list.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    }
  });
}
