const PLACEHOLDER_STICKERS = ['✂️', '🎨', '🧶'];

// `photos` is the home gallery's photo list (newest first). The three newest are taped onto the
// hero as a polaroid collage; with no photos yet, colorful craft stickers stand in for them.
// Omit it to render the hero immediately with an empty collage, then call setHeroPhotos() once
// the photos have loaded, so the buttons never wait on the network.
export function renderHero(photos) {
  const hero = document.createElement('section');
  hero.className = 'hero';
  hero.setAttribute('aria-label', "Emi's Craft House welcome");

  const content = document.createElement('div');
  content.className = 'hero-content';

  const title = document.createElement('h1');
  title.className = 'hero-title';
  title.innerHTML = 'Emi\'s <span class="hero-title-highlight">Craft</span> House';

  const subtitle = document.createElement('p');
  subtitle.className = 'hero-subtitle';
  subtitle.textContent = 'All your crafts, saved in one happy place.';

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

  hero.appendChild(content);
  hero.appendChild(photos ? renderCollage(photos) : renderEmptyCollage());

  return hero;
}

export function setHeroPhotos(heroElement, photos) {
  const current = heroElement.querySelector('.hero-collage');
  if (current) current.replaceWith(renderCollage(photos));
}

function renderEmptyCollage() {
  const collage = document.createElement('div');
  collage.className = 'hero-collage';
  collage.setAttribute('aria-hidden', 'true');
  return collage;
}

function renderCollage(photos) {
  const collage = document.createElement('div');
  collage.className = 'hero-collage';

  const withThumbs = photos.filter((photo) => photo.thumbnail_url).slice(0, 3);

  if (withThumbs.length === 0) {
    collage.setAttribute('aria-hidden', 'true');
    PLACEHOLDER_STICKERS.forEach((emoji) => {
      const sticker = document.createElement('div');
      sticker.className = 'hero-sticker hero-sticker--blank';
      sticker.textContent = emoji;
      collage.appendChild(sticker);
    });
    return collage;
  }

  withThumbs.forEach((photo) => {
    const sticker = document.createElement('div');
    sticker.className = 'hero-sticker';
    const img = document.createElement('img');
    img.src = photo.thumbnail_url;
    img.alt = photo.filename ? `Recent craft: ${photo.filename}` : 'Recent craft';
    img.loading = 'eager';
    sticker.appendChild(img);
    collage.appendChild(sticker);
  });

  const count = document.createElement('p');
  count.className = 'hero-count';
  const number = document.createElement('strong');
  number.textContent = String(photos.length);
  count.appendChild(number);
  count.appendChild(
    document.createTextNode(photos.length === 1 ? 'craft saved' : 'crafts saved')
  );
  collage.appendChild(count);

  return collage;
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
