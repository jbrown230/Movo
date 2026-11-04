// Dibuja en un canvas las notificaciones bancarias que flotan en la portada.
// Todos los datos son de ejemplo (comercios y montos inventados).
import * as THREE from 'three';

const NOTICES = [
  { bank: 'BAC', color: '#d71920', title: 'BAC Credomatic', detail: 'SINPE Móvil enviado', amount: '₡12 500' },
  { bank: 'BCR', color: '#1d4fa3', title: 'BCR', detail: 'Compra con tarjeta · Súper', amount: '₡23 450' },
  { bank: 'BN', color: '#0b7a4b', title: 'Banco Nacional', detail: 'Voucher digital', amount: '₡8 900' },
  { bank: 'DV', color: '#e1251b', title: 'Davivienda', detail: 'Transferencia recibida', amount: '+₡20 000' },
  { bank: 'BP', color: '#e86f0c', title: 'Banco Popular', detail: 'Comprobante SINPE', amount: '₡5 000' },
  { bank: 'BAC', color: '#d71920', title: 'BAC Credomatic', detail: 'Compra · Gasolinera', amount: '$32,40' },
];

const WIDTH = 640;
const HEIGHT = 240;

function roundedRect(context, [posX, posY, width, height], radius) {
  context.beginPath();
  context.roundRect(posX, posY, width, height, radius);
  context.fill();
}

function drawNotice(notice) {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext('2d');

  context.fillStyle = '#ffffff';
  roundedRect(context, [0, 0, WIDTH, HEIGHT], 48);

  context.fillStyle = notice.color;
  roundedRect(context, [34, 50, 92, 92], 24);
  context.fillStyle = '#ffffff';
  context.font = '800 30px Onest, Arial, sans-serif';
  context.textAlign = 'center';
  context.fillText(notice.bank, 80, 107);

  context.textAlign = 'left';
  context.fillStyle = '#14111f';
  context.font = '700 36px Onest, Arial, sans-serif';
  context.fillText(notice.title, 152, 86);
  context.fillStyle = '#5d5873';
  context.font = '500 28px Onest, Arial, sans-serif';
  context.fillText(notice.detail, 152, 128);

  context.fillStyle = '#5a33e6';
  context.font = '800 44px Onest, Arial, sans-serif';
  context.fillText(notice.amount, 34, 206);
  context.fillStyle = '#5d5873';
  context.font = '500 24px Onest, Arial, sans-serif';
  context.textAlign = 'right';
  context.fillText('ahora', WIDTH - 36, 86);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/** Una textura por aviso. Espera a la fuente Onest para que el texto salga con la letra de la marca. */
export function createNoticeTextures() {
  const textures = NOTICES.map(drawNotice);
  document.fonts?.ready.then(() => {
    NOTICES.forEach((notice, index) => {
      const fresh = drawNotice(notice);
      textures[index].image = fresh.image;
      textures[index].needsUpdate = true;
    });
  });
  return textures;
}
