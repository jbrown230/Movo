// El primer arranque con muchos correos: cuándo empieza la lectura y cuándo se redibuja la pantalla mientras avanza.
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { act, render, renderHook } from '@testing-library/react';

const { session } = vi.hoisted(() => ({ session: {} }));
vi.mock('../../web/src/presentation/state/SessionProvider.jsx', () => ({ useSession: () => session }));
vi.mock('../../web/src/presentation/state/NavigationProvider.jsx', () => ({
  useNavigation: () => ({ flashTransaction: vi.fn() }),
}));
vi.mock('../../web/src/presentation/state/ToastProvider.jsx', () => ({ useToast: () => vi.fn() }));
vi.mock('../../web/src/composition/platform.js', () => ({
  getSavedToken: () => 'token-de-prueba-0123456789',
  clearSavedToken: vi.fn(),
  startGoogleSignIn: vi.fn(),
}));

const { GmailProvider } = await import('../../web/src/presentation/state/GmailProvider.jsx');
const { useInboxScan } = await import('../../web/src/presentation/state/useInboxScan.js');

const EMPTY_SUMMARY = { found: 0, newTransactions: 0, firstTransaction: null };

beforeEach(() => {
  vi.useFakeTimers();
  session.profile = { demo: false, email: 'prueba@example.test' };
  session.config = { cloudSync: false, googleClientId: 'cliente-de-prueba' };
  session.refresh = vi.fn();
  session.services = {
    scanInbox: vi.fn(async () => EMPTY_SUMMARY),
    preferences: { isCloudBackupEnabled: () => false, lastScanAt: () => 0 },
  };
});

afterEach(() => vi.useRealTimers());

describe('al entrar, la primera lectura espera a que se dibuje la pantalla', () => {
  test('no empieza de golpe: arranca pasados 600 ms', async () => {
    render(
      <GmailProvider>
        <span />
      </GmailProvider>,
    );
    expect(session.services.scanInbox).not.toHaveBeenCalled();

    await act(() => vi.advanceTimersByTimeAsync(599));
    expect(session.services.scanInbox).not.toHaveBeenCalled();

    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(session.services.scanInbox).toHaveBeenCalledTimes(1);
  });

  test('si se sale antes de que empiece, no se lee nada', async () => {
    const { unmount } = render(
      <GmailProvider>
        <span />
      </GmailProvider>,
    );
    unmount();

    await act(() => vi.advanceTimersByTimeAsync(2000));
    expect(session.services.scanInbox).not.toHaveBeenCalled();
  });

  test('en el modo demo no se lee Gmail', async () => {
    session.profile = { demo: true };
    render(
      <GmailProvider>
        <span />
      </GmailProvider>,
    );
    await act(() => vi.advanceTimersByTimeAsync(2000));
    expect(session.services.scanInbox).not.toHaveBeenCalled();
  });
});

describe('mientras se leen los correos, la pantalla se actualiza sin pasarse', () => {
  test('el primer correo se muestra enseguida y después cada 2 segundos', async () => {
    session.services.scanInbox = vi.fn(async ({ onProgress }) => {
      onProgress(1, 6); // se muestra enseguida
      onProgress(2, 6); // muy pronto: no se redibuja otra vez
      onProgress(3, 6);
      vi.setSystemTime(Date.now() + 2500);
      onProgress(4, 6); // pasaron 2 segundos: se actualiza
      onProgress(5, 6);
      return { ...EMPTY_SUMMARY, found: 6 };
    });
    const { result } = renderHook(() => useInboxScan({ reconnect: vi.fn(), syncBackup: vi.fn() }));

    await act(() => result.current.scan({ quiet: true }));

    // 2 durante la lectura (correo 1 y correo 4) y 1 al terminar.
    expect(session.refresh).toHaveBeenCalledTimes(3);
  });

  test('con pocos correos no se redibuja de más: el primero y el final', async () => {
    session.services.scanInbox = vi.fn(async ({ onProgress }) => {
      onProgress(1, 2);
      onProgress(2, 2);
      return EMPTY_SUMMARY;
    });
    const { result } = renderHook(() => useInboxScan({ reconnect: vi.fn(), syncBackup: vi.fn() }));

    await act(() => result.current.scan({ quiet: true }));

    expect(session.refresh).toHaveBeenCalledTimes(2);
  });
});
