// Controles del landing: el selector de pantallas y el botón para copiar los comandos.

const SWAP_MS = 220;
const COPIED_MS = 1600;

/** Cambia la captura del escaparate con un fundido corto al elegir otra pantalla. */
export function initShowcase() {
  const tabs = [...document.querySelectorAll('.showcase-list [role="tab"]')];
  const shot = document.querySelector('.showcase-shot');
  const caption = document.querySelector('.showcase-caption');
  if (!tabs.length || !shot) return;

  // Precarga las demás capturas para que el cambio sea inmediato.
  tabs.forEach((tab) => {
    const image = new Image();
    image.src = `./capturas/${tab.dataset.shot}.webp`;
  });

  const select = (tab) => {
    if (tab.getAttribute('aria-selected') === 'true') return;
    tabs.forEach((other) => other.setAttribute('aria-selected', String(other === tab)));
    shot.classList.add('is-swapping');
    window.setTimeout(() => {
      shot.src = `./capturas/${tab.dataset.shot}.webp`;
      shot.alt = `Pantalla de Movo: ${tab.textContent}`;
      caption.textContent = tab.dataset.caption;
      shot.classList.remove('is-swapping');
    }, SWAP_MS);
  };

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => select(tab));
    tab.addEventListener('keydown', (event) => {
      const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[event.key];
      if (!step) return;
      event.preventDefault();
      const next = tabs[(index + step + tabs.length) % tabs.length];
      next.focus();
      select(next);
    });
  });
}

/** Cambia el texto de un botón con un desenfoque corto (sale hacia arriba, entra desde abajo). */
function swapLabel(label, text) {
  label.classList.add('is-out');
  window.setTimeout(() => {
    label.textContent = text;
    label.classList.remove('is-out');
  }, 180);
}

/** Copia los comandos de instalación al portapapeles. */
export function initCopyButton() {
  const button = document.querySelector('.copy');
  const label = button?.querySelector('.copy-label');
  if (!button) return;
  const commands = [...document.querySelectorAll('.terminal .code-line')].map((line) => line.textContent).join('\n');

  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(commands);
      swapLabel(label, 'Copiado');
    } catch {
      swapLabel(label, 'Sin permiso');
    }
    window.setTimeout(() => swapLabel(label, 'Copiar'), COPIED_MS);
  });
}
