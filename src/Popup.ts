import type CriiptoAuth from './index';
import type {PopupAuthorizeParams, AuthorizeResponse, GenericObject} from './types';
import {parseAuthorizeResponseFromLocation, CRIIPTO_AUTHORIZE_RESPONSE, CRIIPTO_POPUP_ID, CRIIPTO_POPUP_BACKDROP_ID, CRIIPTO_POPUP_BACKDROP_BUTTON_OPEN_ID, CRIIPTO_POPUP_BACKDROP_BUTTON_CLOSE_ID, parseAuthorizeResponseFromUrl} from './util';
import {generate as generatePKCE} from './pkce';

export default class CriiptoAuthPopup {
  criiptoAuth: CriiptoAuth;
  _latestParams: PopupAuthorizeParams;
  _latestUrl: string;
  backdrop: CriiptoAuthPopupBackdrop;
  window: Window;
  checker: number;

  constructor(criiptoAuth: CriiptoAuth) {
    this.criiptoAuth = criiptoAuth;
    this.backdrop = new CriiptoAuthPopupBackdrop(this);
  }

  open(url: string, params: PopupAuthorizeParams): Window {
    let {width, height} = params;

    width = width || 400;
    height = height || 660;

    const dualScreenLeft = window.screenLeft ?? window.screenX;
    const dualScreenTop = window.screenTop ?? window.screenY;

    const windowWidth = window.innerWidth ?? document.documentElement.clientWidth ?? screen.width;
    const windowHeight = window.innerHeight ?? document.documentElement.clientHeight ?? screen.height;

    const systemZoom = windowWidth / window.screen.availWidth;
    const left = (windowWidth - width) / 2 / systemZoom + dualScreenLeft
    const top = (windowHeight - height) / 2 / systemZoom + dualScreenTop

    const features = `width=${width},height=${height},top=${top},left=${left}`;
    this.window = window.open(url, CRIIPTO_POPUP_ID, features)!;

    if (params.backdrop !== false) {
      this._latestParams = params;
      this._latestUrl = url;
      this.backdrop.render(params);
    }

    return this.window;
  }

  listen(params: PopupAuthorizeParams) {
    return new Promise<AuthorizeResponse>((resolve, reject) => {
      if (this.checker) clearTimeout(this.checker);

      const respond = (response: AuthorizeResponse) => {
        if (!response.code && !response.error && !response.id_token) {
          // Empty/invalid response
          return false;
        }
        if (params.state && params.state !== response.state) {
          // Not the expected response
          return false;
        }

        window.removeEventListener('message', receiveMessage);
        if (this.checker) clearTimeout(this.checker);
        this.window.close();
        resolve(response);
        return true;
      }

      const receiveMessage = (event: MessageEvent) => {
        const allowed = 
          event.source === this.window || 
          event.origin === `https://${this.criiptoAuth.domain}`;
        if (!allowed) return;
        if (!event.data) return;
        if (typeof event.data !== 'string') return;

        const eventType : string | null = event.data.startsWith(CRIIPTO_AUTHORIZE_RESPONSE) ? CRIIPTO_AUTHORIZE_RESPONSE : null;
        // Deprecated
        if (eventType === CRIIPTO_AUTHORIZE_RESPONSE) {
          const eventData:GenericObject = JSON.parse(event.data.replace(CRIIPTO_AUTHORIZE_RESPONSE, ''));
          
          if (eventData && (eventData.code || eventData.id_token || eventData.error)) {
            respond(eventData as AuthorizeResponse);
          }
        } else if (event.data.includes('code=') || event.data.includes('id_token=') || event.data.includes('error=')) {
          const response = parseAuthorizeResponseFromUrl(event.data);
          respond(response);
        }
      };
      const checkWindow = () => {
        if (!this.checker) return;
        const retry = () => this.checker = window.setTimeout(checkWindow, 250);

        try {
          if (this.window.location.href.replace(this.window.location.search, '') === params.redirectUri) {
            const response = parseAuthorizeResponseFromUrl(this.window.location.href);
            const success = respond(response);
            if (success) return;
          }

          retry();
        } catch (err) {
          retry();
        }
      };

      this.checker = window.setTimeout(checkWindow, 250);
      window.addEventListener('message', receiveMessage);
    }).finally(() => {
      this.backdrop.remove();
    });
  }

  buildAuthorizeUrl(params: PopupAuthorizeParams) {
    const fullParams = this.criiptoAuth.buildAuthorizeParams({
      ...params,
      responseMode: 'post_message'
    });

    return this.criiptoAuth.buildAuthorizeUrl(fullParams).then(url => {
      return {url, params: fullParams};
    });
  }

  /*
   * Start customized login flow in a popup
   * You probably want to use `popup.authorize` instead.
   */
  trigger(initialParams: PopupAuthorizeParams): Promise<AuthorizeResponse> {
    return this.buildAuthorizeUrl(initialParams).then(({url, params}) => {
      this.open(url, initialParams);
      return this.listen(initialParams).then(response => {
        return this.criiptoAuth.processResponse(
          response,
          params.pkce && "code_verifier" in params.pkce ? 
            {code_verifier: params.pkce.code_verifier, redirect_uri: params.redirectUri} :
            undefined
        ).then(response => response!);
      });
    }).finally(() => {
      if (initialParams.backdrop !== false) this.backdrop.remove();
    });
  }

  /*
   * Start PKCE based login flow in a popup
   */
  async authorize(params: PopupAuthorizeParams): Promise<AuthorizeResponse> {
    const responseType = params.responseType ?? 'id_token';
    const pkce = await (
      params.pkce ?
        Promise.resolve(params.pkce) :
        responseType === 'id_token' ?
          generatePKCE() : Promise.resolve(undefined)
    );

    return this.trigger({
      ...params,
      responseType: 'code',
      pkce
    });
  }

  close() {
    this.window.close();
  }

  callback(origin: string | "*") {
    if (!origin) throw new Error('popup.callback required argument origin');
    const params = parseAuthorizeResponseFromLocation(window.location);
    window.opener.postMessage(CRIIPTO_AUTHORIZE_RESPONSE + JSON.stringify(params), origin);
    window.close();
  }
}

const EN_TEMPLATE = `
<div class="criipto-auth-popup-backdrop-background"></div>
<div class="criipto-auth-popup-backdrop-content">
  <p>Don't see the login popup?</p>
  <button id="${CRIIPTO_POPUP_BACKDROP_BUTTON_OPEN_ID}">Reopen popup</button>
  <button id="${CRIIPTO_POPUP_BACKDROP_BUTTON_CLOSE_ID}">Cancel</button>
</div>
`;
const DA_TEMPLATE = `
<div class="criipto-auth-popup-backdrop-background"></div>
<div class="criipto-auth-popup-backdrop-content">
  <p>Kan du ikke se pop-uppen?</p>
  <button id="${CRIIPTO_POPUP_BACKDROP_BUTTON_OPEN_ID}">Åben popup</button>
  <button id="${CRIIPTO_POPUP_BACKDROP_BUTTON_CLOSE_ID}">Fortryd</button>
</div>
`;
const SE_TEMPLATE = `
<div class="criipto-auth-popup-backdrop-background"></div>
<div class="criipto-auth-popup-backdrop-content">
  <p>Ser du inte inloggningspopupen?</p>
  <button id="${CRIIPTO_POPUP_BACKDROP_BUTTON_OPEN_ID}">Öppna popup igen</button>
  <button id="${CRIIPTO_POPUP_BACKDROP_BUTTON_CLOSE_ID}">Avbryt</button>
</div>
`;
const NO_TEMPLATE = `
<div class="criipto-auth-popup-backdrop-background"></div>
<div class="criipto-auth-popup-backdrop-content">
  <p>Ser du ikke popup-dialogboksen for pålogging?</p>
  <button id="${CRIIPTO_POPUP_BACKDROP_BUTTON_OPEN_ID}">Åpne popup på nytt</button>
  <button id="${CRIIPTO_POPUP_BACKDROP_BUTTON_CLOSE_ID}">Avbryt</button>
</div>
`;

export class CriiptoAuthPopupBackdrop {
  popup: CriiptoAuthPopup;
  enabled: boolean;
  template: string | null = null;
  
  constructor(popup: CriiptoAuthPopup) {
    this.popup = popup;
    this.enabled = true;
  }

  render(params: PopupAuthorizeParams) {
    const exists = document.getElementById(CRIIPTO_POPUP_BACKDROP_ID);
    const template =
      this.template ??
        params.uiLocales == 'da' ? DA_TEMPLATE :
        (params.uiLocales == 'se' || params.uiLocales == 'sv') ? SE_TEMPLATE : 
        params.uiLocales == 'nb' ? NO_TEMPLATE : 
        EN_TEMPLATE;
    
    if (!exists) {
      const element = document.createElement('div');
      element.id = CRIIPTO_POPUP_BACKDROP_ID;
      element.className = 'criipto-auth-popup-backdrop';
      element.innerHTML = template;

      document.body.appendChild(element);
      document.getElementById(CRIIPTO_POPUP_BACKDROP_BUTTON_OPEN_ID)?.addEventListener('click', () => this.handleOpen());
      document.getElementById(CRIIPTO_POPUP_BACKDROP_BUTTON_CLOSE_ID)?.addEventListener('click', () => this.handleCancel());
    }
  }

  handleOpen() {
    this.popup.open(this.popup._latestUrl, this.popup._latestParams);
  }

  handleCancel() {
    this.remove();
    this.popup.close();
  }

  remove() {
    const element = document.getElementById(CRIIPTO_POPUP_BACKDROP_ID);
    if (element) document.body.removeChild(element);
  }
}
