import './styles/main.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/tutorial-link.css';
import './styles/model-3d.css';
import { initApp } from './app.js';

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  // Document already parsed by the time this module executed — DOMContentLoaded
  // already fired, so the listener above would never run.
  initApp();
}
