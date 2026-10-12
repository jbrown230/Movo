// Pruebas de la interfaz: se dibuja la app completa y se usa como lo haría una persona.
// La base de datos es SQLite real en memoria; el servidor no responde (la app debe funcionar igual).
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Se reemplaza solo la apertura de la base (IndexedDB no existe en las pruebas). Todo lo demás es real.
vi.mock('../../web/src/composition/openSession.js', async () => {
  const { createTestApp } = await import('../helpers/createTestApp.js');
  return {
    openSession: async () => {
      const { services } = createTestApp();
      return { services, flush: async () => {}, wipe: async () => {} };
    },
  };
});
vi.mock('../../web/src/composition/platform.js', async (importOriginal) => {
  const original = await importOriginal();
  return {
    ...original,
    backendApi: { ...original.backendApi, getConfig: async () => null, getExchangeRate: async () => ({}) },
  };
});

const { App } = await import('../../web/src/presentation/App.jsx');

async function openDemo() {
  const user = userEvent.setup();
  render(<App />);
  await user.click(await screen.findByRole('button', { name: 'Ver el modo demo' }));
  await screen.findByText(/Gastado en/);
  return user;
}

describe('bienvenida', () => {
  test('sin servidor, Google queda desactivado y se explica por qué', async () => {
    render(<App />);
    expect(await screen.findByRole('button', { name: 'Conectar con Google' })).toBeDisabled();
    expect(screen.getByText(/no tiene configurado el inicio de sesión con Google/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver el modo demo' })).toBeEnabled();
  });
});

describe('modo demo', () => {
  beforeEach(() => localStorage.clear());

  test('muestra el gasto del mes, las categorías y los movimientos de ejemplo', async () => {
    await openDemo();
    expect(screen.getByText('Modo demo', { selector: '.live span' })).toBeInTheDocument();
    expect(screen.getByText('Modo demo: simula a tu banco')).toBeInTheDocument();
    expect(screen.getByText('Por categoría')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Super La Amistad|Netflix/i }).length).toBeGreaterThan(0);
  });

  test('un gasto en efectivo aparece en la lista', async () => {
    const user = await openDemo();
    await user.click(screen.getByRole('button', { name: /Efectivo/ }));

    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Monto'), '2500');
    await user.type(within(dialog).getByLabelText('¿En qué fue?'), 'Parqueo prueba');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar gasto' }));

    expect(await screen.findByRole('button', { name: /Parqueo Prueba/ })).toBeInTheDocument();
  });

  test('el botón de guardar un gasto está desactivado hasta tener monto y descripción', async () => {
    const user = await openDemo();
    await user.click(screen.getByRole('button', { name: /Efectivo/ }));
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Guardar gasto' })).toBeDisabled();
  });

  test('pegar un aviso de banco lo convierte en un movimiento', async () => {
    const user = await openDemo();
    await user.click(screen.getByRole('button', { name: /Pegar aviso/ }));

    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByLabelText('Texto'));
    await user.paste('Monto: CRC 4,500.00\nComercio: PANADERIA PRUEBA\nFecha: 15/01/2026 13:22');
    await user.click(within(dialog).getByRole('button', { name: 'Leer' }));

    expect(await screen.findByRole('button', { name: /Panaderia Prueba/ })).toBeInTheDocument();
  });

  test('la bandeja muestra los correos y permite ver lo que leyó Movo', async () => {
    const user = await openDemo();
    const navigation = screen.getByRole('navigation', { name: 'Navegación principal' });
    await user.click(within(navigation).getByRole('button', { name: /Bandeja/ }));

    const mails = await screen.findAllByRole('button', { name: /BAC Credomatic|Banco Nacional|BCR/ });
    expect(mails.length).toBeGreaterThan(5);
    expect(screen.getByText('Sin movimiento')).toBeInTheDocument();

    await user.click(mails[0]);
    expect(await screen.findByText(/Lo que leyó Movo/)).toBeInTheDocument();
  });

  test('en ajustes se puede reiniciar o salir del demo', async () => {
    const user = await openDemo();
    const navigation = screen.getByRole('navigation', { name: 'Navegación principal' });
    await user.click(within(navigation).getByRole('button', { name: /Ajustes/ }));
    expect(screen.getByText('Reiniciar datos de ejemplo')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Salir del modo demo' }));
    expect(await screen.findByRole('button', { name: 'Ver el modo demo' })).toBeInTheDocument();
  });
});
