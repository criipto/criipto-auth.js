import QRCode from 'qrcode';
import CriiptoConfiguration from './CriiptoConfiguration';

import { arrayBufferToBase64, base64ToArrayBuffer, exportPublicKeyAsBase64, generateClientId, generateKeyPair, generateSessionId, IsAckMessage, IsCancelMessage, IsOAuth2CodeMessage, IsOAuth2ErrorMessage, KeyPair, Message, SessionAPI } from './csdc/index';
import type CriiptoAuth from './index';
import { generatePKCE } from './index';
import OAuth2Error from './OAuth2Error';
import type {AuthorizeResponse, AuthorizeUrlParamsOptional} from './types';

type QrAuthorizeParams = Omit<AuthorizeUrlParamsOptional, 'redirectUri'>;

const REFRESH_INTERVAL = 2500;

type Session = {
  id: string
  keyPair: KeyPair
}

type PromiseReject = (reason?: any) => void
type PromiseResolve<T> = (value: T | PromiseLike<T>) => void

export class PromiseCancelledError extends Error {
  constructor() {
    super('Promise cancelled');
    Object.setPrototypeOf(this, PromiseCancelledError.prototype);
  }
}
export class UserCancelledError extends OAuth2Error {
  constructor(error: string, error_description?: string, state?: string) {
    super(error, error_description, state);
  }
}

export class CriiptoQrPromise<T = AuthorizeResponse> extends Promise<T> {
  public onCancel: () => void | PromiseLike<void>
  public onAcknowledged: () => void
  public cancelled = false
  public acknowledged = false
  #_reject: PromiseReject
  #_resolve: PromiseResolve<T>

  constructor(executor: (resolve: PromiseResolve<T>, reject: PromiseReject) => void) {
    let _resolve;
    let _reject : PromiseReject;
    super((resolve, reject) => {
      executor(resolve, reject);
      _resolve = resolve;
      _reject = reject;
    });

    this.#_reject = _reject!;
  }

  cancel() {
    this.cancelled = true;
    this.#_reject(new PromiseCancelledError());
    if (this.onCancel) this.onCancel();
  }

  acknowledge() {
    this.acknowledged = true;
    if (this.onAcknowledged) this.onAcknowledged();
  }
}

export default class CriiptoAuthQrCode {
  criiptoAuth: CriiptoAuth
  #_clientID: string;
  #_sessionAPI: SessionAPI
  #_websocket: WebSocket
  #_setupPromise: Promise<CriiptoConfiguration>

  constructor(criiptoAuth: CriiptoAuth) {
    this.criiptoAuth = criiptoAuth;
  }

  async setup() {
    if (!this.#_setupPromise) {
      this.#_clientID = generateClientId();
      this.#_setupPromise = this.criiptoAuth.fetchCriiptoConfiguration();
      const config = await this.#_setupPromise;
      this.#_sessionAPI = new SessionAPI(config.csdc_session_url);
      this.#_websocket = new WebSocket(`${config.csdc_wss_url}?clientId=${this.#_clientID}`);
    }

    return this.#_setupPromise;
  }

  #createCanvas(element: HTMLElement) {
    const canvas = document.createElement('canvas');
    canvas.setAttribute('data-criipto-id', 'criiptoqrcanvas');
    canvas.width = element.clientWidth;
    canvas.height = canvas.width;

    const existing = element.querySelector('[data-criipto-id="criiptoqrcanvas"]');
    if (existing) element.removeChild(existing);

    element.appendChild(canvas);
    return canvas;
  }

  authorize(element: HTMLElement, params?: QrAuthorizeParams) : CriiptoQrPromise<AuthorizeResponse> {
    const qrPromise = new CriiptoQrPromise(async (resolve, reject) => {
      const canvas = this.#createCanvas(element);
      const responseType = params?.responseType ?? 'id_token';
      let refreshInterval : any;
      let currentSession : Session | null = null;
      let sessionHistory : Session[] = [];
      let isAcked = false;
  
      const cleanup = () => {
        if (refreshInterval) clearInterval(refreshInterval);
        if (canvas.parentElement === element) element.removeChild(canvas);
      };
      
      try {
        const config = await this.setup();
        const redirectUri = config.qr_intermediary_url.replace('{id}', '');

        const pkce = await (
          params?.pkce ?
            Promise.resolve(params.pkce) :
            responseType === 'id_token' ?
              generatePKCE() : Promise.resolve(undefined)
        );

        const authorizeUrl = await this.criiptoAuth.buildAuthorizeUrl(this.criiptoAuth.buildAuthorizeParams({
          pkce,
          redirectUri,
          responseMode: 'query',
          responseType: 'code',
          prompt: 'login'
        }));

        const refresh = async () => {
          if (isAcked) {
            if (refreshInterval) clearInterval(refreshInterval);
            return;
          }

          currentSession = await this.#createSession({action: {authorize: authorizeUrl}});
          sessionHistory = sessionHistory.concat([currentSession]).slice(0, 5);

          const url = config.qr_intermediary_url.replace('{id}', currentSession!.id);
          QRCode.toCanvas(canvas, url, {
            errorCorrectionLevel: 'low',
            scale: 10,
            width: canvas.width
          });
        };

        await refresh();
        refreshInterval = setInterval(() => {
          refresh();
        }, REFRESH_INTERVAL);
        
        const handleMessage = async (message: MessageEvent<any>) => {
          if (qrPromise.cancelled) return;

          for (const session of sessionHistory) {
            const decrypted : ArrayBuffer | null = await crypto.subtle.decrypt(
              {
                name: session.keyPair.algorithm
              },
              session.keyPair.privateKey,
              base64ToArrayBuffer(message.data)
            ).catch(err => {
              return null; // Failed to decrypt, not the correct session
            });

            if (!decrypted) {
              continue;
            }
            
            const data : Message = JSON.parse(atob(arrayBufferToBase64(decrypted)));
                
            if (IsOAuth2CodeMessage(data)) {
              cleanup();

              await this.criiptoAuth.processResponse({
                code: data.code
              }, (pkce && "code_verifier" in pkce) ? {
                redirect_uri: redirectUri,
                code_verifier: pkce.code_verifier
              } : undefined).then(authorizeResponse => {
                resolve(authorizeResponse!);
                this.#_websocket.removeEventListener('message', handleMessage);
              }).catch((authorizeError : OAuth2Error | Error) => {
                reject(authorizeError);
                this.#_websocket.removeEventListener('message', handleMessage);
              });
            } else if (IsAckMessage(data)) {
              isAcked = true;
              sessionHistory = [session];
              currentSession = session;
              qrPromise.acknowledge();
            } else if (IsCancelMessage(data)) {
              reject(new OAuth2Error('access_denied', 'User cancelled login.'));
              cleanup();
            } else if (IsOAuth2ErrorMessage(data)) {
              reject(new OAuth2Error(data.error, data.error_description ?? undefined));
              this.#_websocket.removeEventListener('message', handleMessage);
              cleanup();
            }
          }
        }

        this.#_websocket.addEventListener('message', handleMessage);

        qrPromise.onCancel = () => {
          this.#_websocket.removeEventListener('message', handleMessage);
          cleanup();
        };
      } catch (error) {
        cleanup();
        reject(error);
      }
    });

    return qrPromise;
  }

  async #createSession(data?: {[key: string]: any}) : Promise<Session> {
    const config = await this.setup();
    const sessionId = generateSessionId();
    const keyPair = await generateKeyPair();
    const publicKey = await exportPublicKeyAsBase64(keyPair);

    await this.#_sessionAPI.save(sessionId, {
      csdc_algo: 'RSA-OAEP',
      csdc_initiator_id: this.#_clientID,
      csdc_wss: config.csdc_wss_url,
      csdc_key: publicKey,
      ...data
    });

    return {id: sessionId, keyPair};
  }
}