import type CriiptoAuth from './index';
import type {PopupAuthorizeParams, AuthorizeResponse, GenericObject} from './types';
import {parseAuthorizeResponseFromLocation, CRIIPTO_AUTHORIZE_RESPONSE, CRIIPTO_POPUP_ID, CRIIPTO_POPUP_BACKDROP_ID, CRIIPTO_POPUP_BACKDROP_BUTTON_OPEN_ID, CRIIPTO_POPUP_BACKDROP_BUTTON_CLOSE_ID} from './util';
import {generate as generatePKCE} from './pkce';

export default class CriiptoAuthPopup {
  criiptoAuth: CriiptoAuth;
  _latestParams: PopupAuthorizeParams;
  _latestUrl: string;
  backdrop: CriiptoAuthPopupBackdrop;
  window: Window;

  constructor(criiptoAuth: CriiptoAuth) {
    this.criiptoAuth = criiptoAuth;
    this.backdrop = new CriiptoAuthPopupBackdrop(this);
  }

  open(url: string, params: PopupAuthorizeParams): Window {
    let {width, height} = params;

    width = width || 330;
    height = height || 600;

    const dualScreenLeft = window.screenLeft ?? window.screenX;
    const dualScreenTop = window.screenTop ?? window.screenY;

    const windowWidth = window.innerWidth ?? document.documentElement.clientWidth ?? screen.width;
    const windowHeight = window.innerHeight ?? document.documentElement.clientHeight ?? screen.height;

    const systemZoom = windowWidth / window.screen.availWidth;
    const left = (windowWidth - width) / 2 / systemZoom + dualScreenLeft
    const top = (windowHeight - height) / 2 / systemZoom + dualScreenTop

    const features = `width=${width},height=${height},top=${top},left=${left}`;
    this.window = window.open(url, CRIIPTO_POPUP_ID, features)!;
    return this.window;
  }

  buildAuthorizeUrl(params: PopupAuthorizeParams) {
    return generatePKCE().then(pkce => {
      const fullParams = this.criiptoAuth.buildAuthorizeParams({
        ...params,
        responseMode: 'query',
        responseType: 'code',
        pkce
      });

      return this.criiptoAuth.buildAuthorizeUrl(fullParams).then(url => {
        return {url, pkce, params: fullParams};
      });
    });
  }

  authorize(params: PopupAuthorizeParams): Promise<AuthorizeResponse> {
    this._latestParams = params;

    if (params.backdrop !== false) this.backdrop.render(params);
    
    return this.buildAuthorizeUrl(params).then(({url, pkce, params}) => {
      this._latestUrl = url;
      const popupWindow = this.open(url, params);
      
      return new Promise<AuthorizeResponse>((resolve, reject) => {
        const receiveMessage = (event: MessageEvent) => {
          if (event.source !== popupWindow) return;

          const eventType:string | null = event.data.startsWith(CRIIPTO_AUTHORIZE_RESPONSE) ? CRIIPTO_AUTHORIZE_RESPONSE : null;
          const eventData:GenericObject = eventType === CRIIPTO_AUTHORIZE_RESPONSE ? JSON.parse(event.data.replace(CRIIPTO_AUTHORIZE_RESPONSE, '')) : null;
          
          if (eventData && (eventData.code || eventData.id_token || eventData.error)) {
            this.criiptoAuth.processResponse(eventData, {code_verifier: pkce.code_verifier, redirect_uri: params.redirectUri}).then(resolve, reject);
            window.removeEventListener('message', receiveMessage);
          }
        };
    
        window.addEventListener('message', receiveMessage);
      });
    }).finally(() => {
      if (params.backdrop !== false) this.backdrop.remove();
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

    this.handleOpen = this.handleOpen.bind(this);
    this.handleCancel = this.handleCancel.bind(this);
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
      document.getElementById(CRIIPTO_POPUP_BACKDROP_BUTTON_OPEN_ID)?.addEventListener('click', this.handleOpen);
      document.getElementById(CRIIPTO_POPUP_BACKDROP_BUTTON_CLOSE_ID)?.addEventListener('click', this.handleCancel);
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
    document.body.removeChild(document.getElementById(CRIIPTO_POPUP_BACKDROP_ID)!);
  }
}
