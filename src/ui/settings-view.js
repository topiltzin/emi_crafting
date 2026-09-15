import { getThemePreference } from '../modules/theme.js';

const APPEARANCE_OPTIONS = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'Match Device' }
];

export function renderSettingsView(stats) {
  const { photoCount = 0, albumCount = 0, appVersion = '1.0.0' } = stats || {};
  const currentTheme = getThemePreference();

  const container = document.createElement('div');
  container.className = 'settings-view';

  const heading = document.createElement('h1');
  heading.textContent = 'Settings';
  container.appendChild(heading);

  const aboutCard = document.createElement('div');
  aboutCard.className = 'settings-card';
  aboutCard.innerHTML = `
    <h3>About</h3>
    <div class="settings-stat-row"><span>App name</span><span class="settings-stat-value">Emi's Craft House</span></div>
    <div class="settings-stat-row"><span>Version</span><span class="settings-stat-value">${appVersion}</span></div>
  `;
  container.appendChild(aboutCard);

  const storageCard = document.createElement('div');
  storageCard.className = 'settings-card';
  storageCard.innerHTML = `
    <h3>Your Gallery</h3>
    <div class="settings-stat-row"><span>Photos</span><span class="settings-stat-value">${photoCount}</span></div>
    <div class="settings-stat-row"><span>Albums</span><span class="settings-stat-value">${albumCount}</span></div>
  `;
  container.appendChild(storageCard);

  const appearanceCard = document.createElement('div');
  appearanceCard.className = 'settings-card';
  const appearanceHeading = document.createElement('h3');
  appearanceHeading.textContent = 'Appearance';
  appearanceCard.appendChild(appearanceHeading);

  const appearanceGroup = document.createElement('div');
  appearanceGroup.className = 'settings-appearance-toggle';
  appearanceGroup.setAttribute('role', 'radiogroup');
  appearanceGroup.setAttribute('aria-label', 'Appearance');

  APPEARANCE_OPTIONS.forEach((option) => {
    const optionLabel = document.createElement('label');
    optionLabel.className = 'settings-appearance-option';

    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'appearance';
    radio.value = option.value;
    radio.setAttribute('data-action', 'set-theme');
    radio.checked = option.value === currentTheme;

    optionLabel.appendChild(radio);
    optionLabel.appendChild(document.createTextNode(option.label));
    appearanceGroup.appendChild(optionLabel);
  });

  appearanceCard.appendChild(appearanceGroup);
  container.appendChild(appearanceCard);

  const helpCard = document.createElement('div');
  helpCard.className = 'settings-card';
  helpCard.innerHTML = `
    <h3>Managing Your Data</h3>
    <p class="text-sm">You can remove individual photos or whole albums any time from the
    Albums or My Photos pages using their delete buttons.</p>
  `;
  container.appendChild(helpCard);

  return container;
}

export function attachSettingsViewEvents(viewElement, onAppearanceChange) {
  viewElement.addEventListener('change', (event) => {
    const radio = event.target.closest('[data-action="set-theme"]');
    if (radio) {
      onAppearanceChange(radio.value);
    }
  });
}
