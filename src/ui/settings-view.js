export function renderSettingsView(stats) {
  const { photoCount = 0, albumCount = 0, appVersion = '1.0.0' } = stats || {};

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
