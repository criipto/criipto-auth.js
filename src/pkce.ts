function base64URLEncode(input : Uint8Array) {
  return window.btoa(String.fromCharCode(...input))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
}

export interface PKCE {
  code_verifier: string
  code_challenge: string
  code_challenge_method: string
}
export type PKCEPublicPart = Omit<PKCE, 'code_verifier'>;

export async function generate() : Promise<PKCE> {
  const encoder = new TextEncoder();
  const bytes = new Uint8Array(32);

  globalThis.crypto.getRandomValues(bytes);
  const code_verifier = base64URLEncode(bytes);
  const code_challenge_method = 'S256';
  const subtle = ((globalThis.crypto as any).webkitSubtle as SubtleCrypto) ?? globalThis.crypto.subtle;

  if (!subtle) throw new Error(`SubtleCrypto implementation required to generate PKCE values`);

  const arrayBuffer = await subtle.digest('SHA-256', encoder.encode(code_verifier));
  const code_challenge = base64URLEncode(new Uint8Array(arrayBuffer));
  return {code_verifier, code_challenge, code_challenge_method};
}

export const PKCE_STATE_KEY = '@criipto/verify-js:pkce:state';
type PKCE_STATE = {response_type: 'id_token', redirect_uri: string, pkce_code_verifier: string};
type RESPONSE_CODE_STATE = {response_type: 'code', redirect_uri: string};

export function savePKCEState(store: Storage, input: PKCE_STATE | RESPONSE_CODE_STATE) {
  store.setItem(PKCE_STATE_KEY, JSON.stringify(input));
}

export function getPKCEState(store: Storage) : PKCE_STATE | RESPONSE_CODE_STATE | null {
  const state = store.getItem(PKCE_STATE_KEY);
  if (!state) return null;

  return JSON.parse(state) as (PKCE_STATE | RESPONSE_CODE_STATE);
}

export function clearPKCEState(store: Storage) {
  store.removeItem(PKCE_STATE_KEY);
}