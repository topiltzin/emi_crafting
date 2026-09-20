const ICON_ATTRS =
  'width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" focusable="false"';

const ICONS = {
  home: `<svg ${ICON_ATTRS}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>`,
  photos: `<svg ${ICON_ATTRS}><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>`,
  albums: `<svg ${ICON_ATTRS}><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`,
  favorites: `<svg ${ICON_ATTRS}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`,
  tutorials: `<svg ${ICON_ATTRS}><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>`,
  settings: `<svg ${ICON_ATTRS}><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`
};

const SECTIONS = [
  { id: 'home', label: 'Home', icon: ICONS.home },
  { id: 'photos', label: 'My Photos', icon: ICONS.photos },
  { id: 'albums', label: 'Albums', icon: ICONS.albums },
  { id: 'favorites', label: 'Favorites', icon: ICONS.favorites },
  { id: 'tutorials', label: 'Tutorials', icon: ICONS.tutorials },
  { id: 'settings', label: 'Settings', icon: ICONS.settings }
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
