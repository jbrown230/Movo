import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ServiceUnavailableError, TooManyRequestsError, UnauthorizedError } from '../../src/application/errors.js';
import { createTestUseCases, TOKENS } from '../helpers/fakes.js';

test('un token válido de esta aplicación devuelve el id de la persona', async () => {
  const { useCases } = createTestUseCases();
  assert.equal(await useCases.authenticateUser(TOKENS.ana), 'ana');
});

test('un token que Google no reconoce se rechaza', async () => {
  const { useCases } = createTestUseCases();
  await assert.rejects(useCases.authenticateUser(TOKENS.unknown), UnauthorizedError);
});

test('un token emitido para OTRA aplicación se rechaza', async () => {
  const { useCases } = createTestUseCases();
  await assert.rejects(useCases.authenticateUser(TOKENS.otherApp), /otra aplicación/);
});

test('sin id de cliente configurado no se comprueba para qué aplicación es el token', async () => {
  const { useCases } = createTestUseCases({ settings: { googleClientId: '' } });
  assert.equal(await useCases.authenticateUser(TOKENS.otherApp), 'eva');
});

test('el token se valida una sola vez y luego sale de la caché', async () => {
  const { useCases, tokenVerifier } = createTestUseCases();
  for (let attempt = 0; attempt < 3; attempt++) await useCases.authenticateUser(TOKENS.ana);
  assert.equal(tokenVerifier.callCount, 1);
});

test('si no se puede consultar a Google, se avisa que el servicio no está disponible', async () => {
  const brokenVerifier = {
    verifyAccessToken: async () => {
      throw new Error('sin red');
    },
  };
  const { useCases } = createTestUseCases({ tokenVerifier: brokenVerifier });
  await assert.rejects(useCases.authenticateUser(TOKENS.ana), ServiceUnavailableError);
});

test('límite de solicitudes por persona y por minuto', async () => {
  const { useCases } = createTestUseCases({ settings: { requestsPerMinute: 3 } });
  const outcomes = [];
  for (let attempt = 0; attempt < 5; attempt++) {
    outcomes.push(
      await useCases.authenticateUser(TOKENS.beto).then(
        () => 'ok',
        (error) => error.constructor,
      ),
    );
  }
  assert.deepEqual(outcomes, ['ok', 'ok', 'ok', TooManyRequestsError, TooManyRequestsError]);
});

test('el límite de una persona no afecta a otra', async () => {
  const { useCases } = createTestUseCases({ settings: { requestsPerMinute: 1 } });
  await useCases.authenticateUser(TOKENS.ana);
  assert.equal(await useCases.authenticateUser(TOKENS.beto), 'beto');
});
