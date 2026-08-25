/**
 * Module frame entry.
 *
 * Listens for the host to post { type: 'kc:load', source } then compiles and
 * renders the uploaded component. Posts { type: 'kc:ready' } on success or
 * { type: 'kc:error', error } back to the parent. Also relays a resize signal
 * so the host iframe can size naturally.
 */
import './frame.css';
import { bootModule } from './runtime.js';

const rootEl = document.getElementById('root');

function post(msg) {
  try {
    window.parent.postMessage(msg, '*');
  } catch {
    /* parent may have navigated away */
  }
}

window.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || typeof data !== 'object') return;

  if (data.type === 'kc:load' && typeof data.source === 'string') {
    // Reset any previous render
    rootEl.replaceChildren();
    bootModule(data.source, rootEl).then((result) => {
      if (result.ok) {
        post({ type: 'kc:ready' });
        requestAnimationFrame(() => {
          post({ type: 'kc:resize', height: document.documentElement.scrollHeight });
        });
      } else {
        showError(result.error);
        post({ type: 'kc:error', error: result.error });
      }
    });
  }
});

function showError(message) {
  rootEl.replaceChildren();
  const box = document.createElement('div');
  box.className = 'kc-frame-error';
  box.innerHTML = `
    <div class="kc-frame-error-title">Module failed to load</div>
    <pre></pre>
  `;
  box.querySelector('pre').textContent = message;
  rootEl.appendChild(box);
}

// Announce readiness with retries: the host's message listener may attach
// after this script first runs (SPA mount timing), so keep announcing until
// the host acknowledges by sending kc:load (or we give up).
let announced = false;
window.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'kc:load') announced = true;
});

let attempts = 0;
const announce = () => {
  if (announced || attempts >= 30) return;
  attempts += 1;
  post({ type: 'kc:frame-ready', attempt: attempts });
  setTimeout(announce, 400);
};
announce();
