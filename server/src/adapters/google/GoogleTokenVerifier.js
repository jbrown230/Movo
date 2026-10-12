// Comprueba un token de acceso de Google preguntándole a Google (endpoint "tokeninfo").

const TOKEN_INFO_URL = 'https://oauth2.googleapis.com/tokeninfo';

/** @returns {import('../../application/ports.js').TokenVerifier} */
export function createGoogleTokenVerifier() {
  return {
    async verifyAccessToken(token) {
      const response = await fetch(`${TOKEN_INFO_URL}?access_token=${encodeURIComponent(token)}`);
      if (!response.ok) return null; // Google rechazó el token

      const info = await response.json();
      return {
        userId: info.sub,
        audience: info.aud,
        authorizedParty: info.azp,
        expiresInSeconds: Number(info.expires_in),
      };
    },
  };
}
