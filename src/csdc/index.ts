import SessionAPI from './session-api';
export {SessionAPI};

export interface WebsocketDirectMessageWrapper {
  type: 'DM'
  message: string
  recipientClientId: string
}

export interface AckMessage {
  type: 'ACK',
  sendingClientId: string
}
export function IsAckMessage(message: Message): message is AckMessage {
  return message.type === "ACK";
}

export interface CancelMessage {
  type: 'CANCEL'
}
export function IsCancelMessage(message: Message): message is CancelMessage {
  return message.type === "CANCEL";
}

export interface OAuth2CodeMessage {
  type: 'OAUTH2_CODE',
  code: string
}
export function IsOAuth2CodeMessage(message: Message): message is OAuth2CodeMessage {
  return message.type === "OAUTH2_CODE";
}

export interface OAuth2ErrorMessage {
  type: 'OAUTH2_ERROR',
  error: string,
  error_description: string | null
}
export function IsOAuth2ErrorMessage(message: Message): message is OAuth2ErrorMessage {
  return message.type === "OAUTH2_ERROR";
}

export type Message = AckMessage | OAuth2CodeMessage | OAuth2ErrorMessage | CancelMessage

export async function SendWebsocketDirectMessage(
  websocket: WebSocket,
  publicKey: CryptoKey,
  recipientClientId: string,
  message: Message
) {
  const encoder = new TextEncoder();
  const cipher : ArrayBuffer = await globalThis.crypto.subtle.encrypt({name: "RSA-OAEP"}, publicKey, encoder.encode(JSON.stringify(message)));
  const wrapper : WebsocketDirectMessageWrapper = {
    type: 'DM',
    recipientClientId: recipientClientId,
    message: arrayBufferToBase64(cipher)
  }

  websocket.send(JSON.stringify(wrapper));
}

export function WebsocketDMSender(
  websocket: WebSocket,
  publicKey: CryptoKey,
  recipientClientId: string,
) {
  return async (message: Message) => SendWebsocketDirectMessage(websocket, publicKey, recipientClientId, message);
}

export interface InitializeParams {
  csdc_wss: string,
  csdc_algo: 'RSA-OAEP',
  csdc_key: string,
  csdc_initiator_id: string
}

export type AuthorizationSession = InitializeParams & {
  action: {
    authorize: string
  }
}

export interface KeyPair {
  algorithm: 'RSA-OAEP',
  privateKey: CryptoKey,
  publicKey: CryptoKey
}

function dec2hex (dec: number) {
  let string = dec.toString(16);
  return string.length == 1 ? `0${string}` : string;
}
export function generateClientId() {
  if (typeof crypto.randomUUID === "undefined") {
    const arr = new Uint8Array(16);
    window.crypto.getRandomValues(arr);
    return Array.from(arr, dec2hex).join('');
  }
  return crypto.randomUUID().replace(/-/g, '');
}
export function generateSessionId() {
  return generateClientId();
}

export async function generateKeyPair() : Promise<KeyPair> {
  const params : RsaHashedKeyGenParams = {
    name: 'RSA-OAEP',
    modulusLength: 2048,
    publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
    hash: 'SHA-512'
  };
  const keyPair = await crypto.subtle.generateKey(params, true, ['encrypt', 'decrypt']);

  return {
    algorithm: 'RSA-OAEP',
    privateKey: keyPair.privateKey,
    publicKey: keyPair.publicKey
  };
}

export function arrayBufferToBase64(buffer: ArrayBuffer) : string {
	let binary = '';
	let bytes = new Uint8Array(buffer);
	let len = bytes.byteLength;
	for (let i = 0; i < len; i++) {
		binary += String.fromCharCode( bytes[ i ] );
	}
	return window.btoa( binary );
}

export function base64ToArrayBuffer(base64 : string) : ArrayBuffer {
    const binary_string = window.atob(base64);
    const buf = new ArrayBuffer(binary_string.length);
    const bufView = new Uint8Array(buf);
    for (let i = 0, strLen = binary_string.length; i < strLen; i++) {
      bufView[i] = binary_string.charCodeAt(i);
    }
    return buf;
}

export async function exportPublicKeyAsBase64(input: KeyPair) {
  const raw = await crypto.subtle.exportKey('spki', input.publicKey);
  return arrayBufferToBase64(raw);
}

export async function importPublicKeyFromBase64(input: string, algo: 'RSA-OAEP') {
  const buffer = base64ToArrayBuffer(input);
  const key = await crypto.subtle.importKey('spki', buffer, {
    name: algo,
    hash: 'SHA-512'
  }, false, ['encrypt']);
  return key;
}