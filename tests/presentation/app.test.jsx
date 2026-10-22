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
// La descarga de archivos se reemplaza por una función que solo recuerda qué se descargó.
const { downloadTextFile } = vi.hoisted(() => ({ downloadTextFile: vi.fn() }));
vi.mock('../../web/src/composition/platform.js', async (importOriginal) => {
  const original = await importOriginal();
  return {
    ...original,
    backendApi: { ...original.backendApi, getConfig: async () => null, getExchangeRate: async () => ({}) },
    downloadTextFile,
  };
});

const { App } = await import('../../web/src/presentation/App.jsx');

/** Elige una pantalla en la barra de abajo. */
async function goToTab(user, name) {
  const navigation = screen.getByRole('navigation', { name: 'Navegación principal' });
  // El botón de la bandeja también lleva el número de correos: se busca por el comienzo del nombre.
  await user.click(within(navigation).getByRole('button', { name: new RegExp(`^${name}`) }));
}

/** Abre la hoja de filtros de la pantalla de movimientos. */
async function openFilters(user) {
  await user.click(screen.getByRole('button', { name: /^Filtros/ }));
  return within(screen.getByRole('dialog'));
}

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

    await goToTab(user, 'Movimientos'); // el inicio solo muestra los últimos; este es de enero
    expect(await screen.findByRole('button', { name: /Panaderia Prueba/ })).toBeInTheDocument();
  });

  test('la bandeja muestra los correos y permite ver lo que leyó Movo', async () => {
    const user = await openDemo();
    await goToTab(user, 'Bandeja');

    const mails = await screen.findAllByRole('button', { name: /BAC Credomatic|Banco Nacional|BCR/ });
    expect(mails.length).toBeGreaterThan(5);
    expect(screen.getByText('Sin movimiento')).toBeInTheDocument();

    await user.click(mails[0]);
    expect(await screen.findByText(/Lo que leyó Movo/)).toBeInTheDocument();
  });

  test('en ajustes se puede reiniciar o salir del demo', async () => {
    const user = await openDemo();
    await goToTab(user, 'Ajustes');
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
    await goToTab(user, 'Movimientos');
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
    await goToTab(user, 'Ajustes');
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
    await goToTab(user, 'Ajustes');
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

describe('movimientos', () => {
  beforeEach(() => localStorage.clear());

  /** Las filas de movimientos de una pantalla ("Inicio" o "Movimientos"). */
  const movementRows = (regionName = 'Movimientos') =>
    within(screen.getByRole('region', { name: regionName }))
      .queryAllByRole('button')
      .filter((button) => button.classList.contains('tx'));

  const openMovements = async (user) => {
    await goToTab(user, 'Movimientos');
    return movementRows().length;
  };

  test('el inicio muestra solo los últimos movimientos y "Ver todos" lleva a la pestaña Movimientos', async () => {
    const user = await openDemo();
    expect(screen.getByRole('heading', { name: 'Últimos movimientos' })).toBeInTheDocument();
    expect(movementRows('Inicio')).toHaveLength(5);

    await user.click(screen.getByRole('button', { name: /^Ver todos/ }));
    expect(screen.getByRole('heading', { name: 'Movimientos', level: 1 })).toBeInTheDocument();
    expect(movementRows().length).toBeGreaterThan(5);
  });

  test('buscar por texto deja los movimientos del comercio, y borrar la búsqueda los devuelve todos', async () => {
    const user = await openDemo();
    const all = await openMovements(user);

    await user.type(screen.getByRole('searchbox', { name: 'Buscar movimientos' }), 'netflix');
    const found = movementRows();
    expect(found.length).toBeGreaterThan(0);
    expect(found.length).toBeLessThan(all);
    expect(found.every((row) => /netflix/i.test(row.textContent))).toBe(true);
    expect(screen.getByText(/con estos filtros/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Borrar búsqueda' }));
    expect(movementRows()).toHaveLength(all);
  });

  test('los chips de tipo muestran solo los ingresos, o todo otra vez', async () => {
    const user = await openDemo();
    const all = await openMovements(user);
    const types = within(screen.getByRole('group', { name: 'Tipo de movimiento' }));

    await user.click(types.getByRole('button', { name: 'Ingresos' }));
    const income = movementRows();
    expect(income.length).toBeGreaterThan(0);
    expect(income.length).toBeLessThan(all);
    expect(income.every((row) => row.querySelector('.a.in'))).toBe(true);

    await user.click(types.getByRole('button', { name: 'Todos' }));
    expect(movementRows()).toHaveLength(all);
  });

  /** El botón de abajo de la hoja de filtros: "Ver 12 movimientos" o "Sin resultados". */
  const applyButton = (filters) => filters.getByRole('button', { name: /^(Ver \d+ movimiento|Sin resultados)/ });
  /** Elige una opción de una de las listas desplegables de la hoja de filtros. */
  const choose = (user, filters, label, value) => user.selectOptions(filters.getByLabelText(label), value);

  test('filtrar por categoría en la hoja muestra los que cumplen, y se conserva al cambiar de pestaña', async () => {
    const user = await openDemo();
    const all = await openMovements(user);
    const filters = await openFilters(user);
    await choose(user, filters, 'Categoría', 'ocio');
    expect(movementRows()).toHaveLength(all); // nada cambia hasta aplicar
    await user.click(applyButton(filters));

    const leisure = movementRows();
    expect(leisure.length).toBeGreaterThan(0);
    expect(leisure.every((row) => /Netflix|Spotify|Steam/i.test(row.textContent))).toBe(true);
    expect(screen.getByText(/con estos filtros/)).toBeInTheDocument();

    await goToTab(user, 'Ajustes');
    await goToTab(user, 'Movimientos');
    expect(screen.getByRole('button', { name: /^Filtros \(1\)/ })).toBeInTheDocument();
    expect(movementRows()).toHaveLength(leisure.length);

    await user.click(screen.getByRole('button', { name: 'Quitar filtros' }));
    expect(movementRows()).toHaveLength(all);
  });

  test('el botón de la hoja dice cuántos movimientos quedan mientras se eligen los filtros', async () => {
    const user = await openDemo();
    const all = await openMovements(user);
    const filters = await openFilters(user);
    expect(applyButton(filters)).toHaveTextContent(`Ver ${all} movimientos`);

    await choose(user, filters, 'Categoría', 'ocio');
    const leisureCount = Number(applyButton(filters).textContent.match(/\d+/)[0]);
    expect(leisureCount).toBeGreaterThan(0);
    expect(leisureCount).toBeLessThan(all);

    await choose(user, filters, 'Categoría', ''); // "Todas" quita el filtro
    expect(applyButton(filters)).toHaveTextContent(`Ver ${all} movimientos`);
  });

  test('el período elige las fechas, "Personalizado" las muestra y "Limpiar" deja la hoja sin filtros', async () => {
    const user = await openDemo();
    await openMovements(user);
    const filters = await openFilters(user);
    expect(filters.queryByRole('button', { name: 'Limpiar' })).not.toBeInTheDocument();
    expect(filters.queryByLabelText('Fecha desde')).not.toBeInTheDocument(); // los campos salen con "Personalizado"

    await choose(user, filters, 'Período', 'thisMonth');
    expect(filters.getByLabelText('Período').value).toBe('thisMonth');
    expect(filters.queryByLabelText('Fecha desde')).not.toBeInTheDocument();

    await choose(user, filters, 'Período', 'custom');
    expect(filters.getByLabelText('Fecha desde').value).toMatch(/^\d{4}-\d{2}-01$/); // conserva las del período
    expect(filters.getByLabelText('Fecha hasta').value).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    await user.click(filters.getByRole('button', { name: 'Limpiar' }));
    expect(filters.getByLabelText('Fecha desde').value).toBe('');
    expect(filters.queryByRole('button', { name: 'Limpiar' })).not.toBeInTheDocument();
  });

  test('filtrar por monto: solo "desde" deja los mayores, y un rango al revés avisa', async () => {
    const user = await openDemo();
    await openMovements(user);
    const filters = await openFilters(user);
    expect(filters.queryByLabelText('Monto desde')).not.toBeInTheDocument(); // plegado en "Más filtros"
    await user.click(filters.getByRole('button', { name: /^Más filtros/ }));
    await user.type(filters.getByLabelText('Monto desde'), '20000');
    await user.click(applyButton(filters));
    const large = movementRows();
    expect(large.length).toBeGreaterThan(0);
    expect(large.every((row) => Number(row.querySelector('.a').textContent.replace(/\D/g, '')) >= 20000)).toBe(true);

    const again = await openFilters(user);
    expect(again.getByLabelText('Monto desde').value).toBe('20000'); // con un monto puesto, se abre solo
    await user.type(again.getByLabelText('Monto hasta'), '100');
    expect(again.getByText(/El monto "desde" es mayor que el monto "hasta"/)).toBeInTheDocument();
    expect(applyButton(again)).toBeDisabled();
  });

  test('tocar una categoría del inicio abre Movimientos filtrado por ella en el mes', async () => {
    const user = await openDemo();
    const cards = screen.getAllByRole('button', { name: /: ver sus movimientos del mes$/ });
    expect(cards.length).toBeGreaterThan(2); // todas las categorías del mes, en la fila desplazable
    const category = cards[0].getAttribute('aria-label').split(':')[0];

    await user.click(cards[0]);
    expect(screen.getByRole('heading', { name: 'Movimientos', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Filtros \(3\)/ })).toBeInTheDocument();
    const filters = await openFilters(user);
    const selected = filters.getByLabelText('Categoría');
    expect(selected.options[selected.selectedIndex].text).toBe(category);
    expect(filters.getByLabelText('Período').value).toBe('thisMonth');
    await user.click(applyButton(filters));
    expect(movementRows().length).toBeGreaterThan(0);
  });
});

describe('exportar a CSV', () => {
  beforeEach(() => {
    localStorage.clear();
    downloadTextFile.mockClear();
  });

  const openExport = async (user) => {
    await goToTab(user, 'Movimientos');
    await user.click(screen.getByRole('button', { name: 'Exportar movimientos a CSV' }));
    return within(screen.getByRole('dialog'));
  };

  test('desde Movimientos se descargan todos los movimientos, y Ajustes ya no ofrece exportar', async () => {
    const user = await openDemo();
    await goToTab(user, 'Ajustes');
    expect(screen.queryByRole('button', { name: 'Exportar movimientos a CSV' })).not.toBeInTheDocument();

    const dialog = await openExport(user);
    expect(dialog.getByText('todos tus movimientos')).toBeInTheDocument();
    await user.click(dialog.getByRole('button', { name: 'Descargar CSV' }));

    expect(downloadTextFile).toHaveBeenCalledTimes(1);
    const [fileName, content] = downloadTextFile.mock.calls[0];
    expect(fileName).toMatch(/^movo-movimientos-inicio-a-hoy\.csv$/);
    expect(content.startsWith('﻿Fecha;Comercio;Monto;Moneda')).toBe(true);
    expect(await screen.findByText(/Se exportaron \d+ movimiento/)).toBeInTheDocument();
  });

  test('el archivo lleva solo lo que muestran los filtros de la pantalla', async () => {
    const user = await openDemo();
    await goToTab(user, 'Movimientos');
    await user.type(screen.getByRole('searchbox', { name: 'Buscar movimientos' }), 'netflix');
    await user.click(screen.getByRole('button', { name: 'Exportar movimientos a CSV' }));

    const dialog = within(screen.getByRole('dialog'));
    expect(dialog.getByText('con los filtros que tienes puestos')).toBeInTheDocument();
    expect(within(dialog.getByRole('list', { name: 'Filtros aplicados' })).getByText('“netflix”')).toBeInTheDocument();
    await user.click(dialog.getByRole('button', { name: 'Descargar CSV' }));

    const [, content] = downloadTextFile.mock.calls[0];
    const rows = content.trimEnd().split('\r\n').slice(1);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => /netflix/i.test(row))).toBe(true);
  });

  test('sin movimientos que cumplan los filtros, no deja descargar', async () => {
    const user = await openDemo();
    await goToTab(user, 'Movimientos');
    await user.type(screen.getByRole('searchbox', { name: 'Buscar movimientos' }), 'zzzz');
    expect(screen.getByRole('button', { name: 'Exportar movimientos a CSV' })).toBeDisabled();
    expect(downloadTextFile).not.toHaveBeenCalled();
  });
});

describe('barra de abajo', () => {
  beforeEach(() => localStorage.clear());

  test('muestra ícono y nombre de cada pantalla, y marca la actual', async () => {
    const user = await openDemo();
    const navigation = within(screen.getByRole('navigation', { name: 'Navegación principal' }));
    const buttons = navigation.getAllByRole('button');
    expect(buttons.map((button) => button.querySelector('span').textContent)).toEqual([
      'Inicio',
      'Movimientos',
      'Bandeja',
      'Ajustes',
    ]);
    expect(navigation.getByRole('button', { name: 'Inicio' })).toHaveAttribute('aria-current', 'page');

    await goToTab(user, 'Ajustes');
    expect(navigation.getByRole('button', { name: 'Ajustes' })).toHaveAttribute('aria-current', 'page');
    expect(navigation.getByRole('button', { name: 'Inicio' })).toHaveAttribute('aria-current', 'false');
  });
});
