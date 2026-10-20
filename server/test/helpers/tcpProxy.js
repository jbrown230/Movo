// Intermediario TCP para simular que Redis o MongoDB se caen a mitad de ejecución.
// La API se conecta al intermediario, y el intermediario al servicio real. `cut()` cierra todas las
// conexiones y deja de aceptar nuevas, como si el servicio se hubiera apagado; `restore()` lo vuelve
// a abrir en el mismo puerto, como si el servicio hubiera vuelto.

import net from 'node:net';

/** Un puerto libre en esta máquina. */
export async function freePort() {
  const probe = net.createServer();
  await new Promise((resolve) => probe.listen(0, '127.0.0.1', resolve));
  const { port } = probe.address();
  await new Promise((resolve) => probe.close(resolve));
  return port;
}

/**
 * @param {{ host: string, port: number }} target  El servicio real.
 * @param {{ port?: number, listening?: boolean }} [options]  `listening: false` crea el intermediario ya caído.
 */
export async function startTcpProxy(target, { port, listening = true } = {}) {
  const proxyPort = port ?? (await freePort());
  const sockets = new Set();
  let server = null;

  const track = (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.on('error', () => socket.destroy());
  };

  async function restore() {
    server = net.createServer((client) => {
      const upstream = net.connect(target.port, target.host);
      track(client);
      track(upstream);
      client.pipe(upstream).pipe(client);
    });
    await new Promise((resolve) => server.listen(proxyPort, '127.0.0.1', resolve));
  }

  async function cut() {
    for (const socket of sockets) socket.destroy();
    if (server) await new Promise((resolve) => server.close(resolve));
    server = null;
  }

  if (listening) await restore();
  return { port: proxyPort, cut, restore, close: cut };
}
