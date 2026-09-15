export function renderHero() {
  const hero = document.createElement('section');
  hero.className = 'hero';
  hero.setAttribute('aria-label', "Emi's Craft House welcome");

  const decor = document.createElement('div');
  decor.className = 'hero-decor';
  decor.setAttribute('aria-hidden', 'true');
  decor.innerHTML = `
    <span style="top:10%; left:8%;">✨</span>
    <span style="top:20%; right:10%;">🌸</span>
    <span style="bottom:15%; left:15%;">⭐</span>
    <span style="bottom:20%; right:18%;">💗</span>
    <span style="top:50%; left:3%;">🌟</span>
  `;

  const content = document.createElement('div');
  content.className = 'hero-content';

  const title = document.createElement('h1');
  title.className = 'hero-title';
  title.textContent = "Emi's Craft House";

  const subtitle = document.createElement('p');
  subtitle.className = 'hero-subtitle';
  subtitle.textContent = 'Your special creations, beautifully organized!';

  const actions = document.createElement('div');
  actions.className = 'hero-actions';

  const addPhotosBtn = document.createElement('button');
  addPhotosBtn.type = 'button';
  addPhotosBtn.className = 'btn btn-primary';
  addPhotosBtn.setAttribute('data-action', 'add-photos');
  addPhotosBtn.textContent = '+ Add Photos';

  const createAlbumBtn = document.createElement('button');
  createAlbumBtn.type = 'button';
  createAlbumBtn.className = 'btn btn-secondary';
  createAlbumBtn.setAttribute('data-action', 'create-album');
  createAlbumBtn.textContent = 'Create Album';

  actions.appendChild(addPhotosBtn);
  actions.appendChild(createAlbumBtn);

  content.appendChild(title);
  content.appendChild(subtitle);
  content.appendChild(actions);

  hero.appendChild(decor);
  hero.appendChild(content);

  return hero;
}

export function attachHeroEvents(heroElement, onAddPhotos, onCreateAlbum) {
  heroElement.addEventListener('click', (event) => {
    if (event.target.closest('[data-action="add-photos"]')) {
      onAddPhotos();
      return;
    }

    if (event.target.closest('[data-action="create-album"]')) {
      onCreateAlbum();
    }
  });
}
