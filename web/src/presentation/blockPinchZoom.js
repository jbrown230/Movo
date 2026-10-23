/**
 * Una app de celular no debe agrandarse al separar los dedos. Safari de iPhone ignora `user-scalable=no`,
 * así que ahí se cancela el gesto de pellizcar; el resto de navegadores obedece al viewport y a `touch-action`.
 */
export function blockPinchZoom() {
  document.addEventListener('gesturestart', (event) => event.preventDefault());
}
