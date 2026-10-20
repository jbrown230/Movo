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
    expect(screen.getByText('Modo demo: simula a tu banco')).not.toBeVisible();
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
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Guardar gasto' }));

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
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Leer' }));

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
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Salir' }));
    expect(await screen.findByRole('button', { name: 'Ver el modo demo' })).toBeInTheDocument();
  });
});

describe('confirmaciones', () => {
  beforeEach(() => localStorage.clear());

  async function openFirstNetflix() {
    const user = await openDemo();
    await user.click(screen.getAllByRole('button', { name: /Netflix/i })[0]);
    await screen.findByText('¿Cómo contarlo?');
    return user;
  }

  test('eliminar un movimiento pide confirmación, y al cancelar se vuelve al detalle sin borrar', async () => {
    const user = await openFirstNetflix();
    const before = screen.getAllByRole('button', { name: /Netflix/i }).length;

    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Eliminar movimiento' }));
    expect(within(screen.getByRole('dialog')).getByText(/Se elimina Netflix/i)).toBeInTheDocument();
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }));

    expect(await screen.findByText('¿Cómo contarlo?')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Netflix/i })).toHaveLength(before);
  });

  test('al confirmar, el movimiento se elimina', async () => {
    const user = await openFirstNetflix();
    const before = screen.getAllByRole('button', { name: /Netflix/i }).length;

    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Eliminar movimiento' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Eliminar' }));

    expect(await screen.findByText('Movimiento eliminado')).toBeInTheDocument();
    expect(screen.queryAllByRole('button', { name: /Netflix/i })).toHaveLength(before - 1);
  });

  test('cambiar la categoría pide confirmación y no cambia nada si se cancela', async () => {
    const user = await openFirstNetflix();
    const categories = within(screen.getByRole('group', { name: 'Categoría' }));
    await user.click(categories.getByRole('button', { name: /Comida/ }));

    expect(within(screen.getByRole('dialog')).getByText(/pasa a Comida/)).toBeInTheDocument();
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }));

    const pickerAgain = within(await screen.findByRole('group', { name: 'Categoría' }));
    expect(pickerAgain.getByRole('button', { name: /Comida/ })).toHaveAttribute('aria-pressed', 'false');
  });

  test('al cancelar la confirmación de un gasto en efectivo, el formulario conserva lo escrito', async () => {
    const user = await openDemo();
    await user.click(screen.getByRole('button', { name: /Efectivo/ }));
    const form = within(screen.getByRole('dialog'));
    await user.type(form.getByLabelText('Monto'), '1800');
    await user.type(form.getByLabelText('¿En qué fue?'), 'Pan dulce');
    await user.click(form.getByRole('button', { name: 'Guardar gasto' }));

    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }));

    const formAgain = within(screen.getByRole('dialog'));
    expect(formAgain.getByLabelText('¿En qué fue?')).toHaveValue('Pan dulce');
    expect(screen.queryByRole('button', { name: /Pan Dulce/ })).not.toBeInTheDocument();
  });

  test('cambiar el presupuesto pide confirmación', async () => {
    const user = await openDemo();
    const navigation = screen.getByRole('navigation', { name: 'Navegación principal' });
    await user.click(within(navigation).getByRole('button', { name: /Ajustes/ }));
    await user.click(screen.getByRole('button', { name: /Presupuesto mensual/ }));

    const amount = within(screen.getByRole('dialog')).getByLabelText('Monto');
    await user.clear(amount);
    await user.type(amount, '400000');
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Guardar' }));

    const confirmation = within(screen.getByRole('dialog'));
    expect(confirmation.getByText(/pasa de ₡350\s000 a ₡400\s000/)).toBeInTheDocument();
    await user.click(confirmation.getByRole('button', { name: 'Cambiar presupuesto' }));
    expect(await screen.findByRole('button', { name: /Presupuesto mensual\s*₡400\s000/ })).toBeInTheDocument();
  });
});

describe('apariencia', () => {
  async function openSettings() {
    const user = await openDemo();
    const navigation = screen.getByRole('navigation', { name: 'Navegación principal' });
    await user.click(within(navigation).getByRole('button', { name: /Ajustes/ }));
    return user;
  }

  test('en ajustes se puede elegir el tema oscuro y claro, y queda guardado', async () => {
    const user = await openSettings();
    const options = screen.getByRole('group', { name: 'Apariencia' });
    expect(within(options).getByRole('button', { name: 'Automático' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(within(options).getByRole('button', { name: 'Oscuro' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('movo:theme')).toBe('dark');
    expect(within(options).getByRole('button', { name: 'Oscuro' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(within(options).getByRole('button', { name: 'Claro' }));
    expect(document.documentElement.dataset.theme).toBe('light');

    await user.click(within(options).getByRole('button', { name: 'Automático' }));
    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(localStorage.getItem('movo:theme')).toBe('auto');
  });

  test('la apariencia guardada se recuerda al volver a abrir los ajustes', async () => {
    localStorage.setItem('movo:theme', 'dark');
    await openSettings();
    const options = screen.getByRole('group', { name: 'Apariencia' });
    expect(within(options).getByRole('button', { name: 'Oscuro' })).toHaveAttribute('aria-pressed', 'true');
  });
});
