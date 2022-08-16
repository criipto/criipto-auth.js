import type {AuthorizeUrlParams, AuthorizeUrlParamsOptional, AuthorizeResponse, AuthorizeResponsiveParams, RedirectAuthorizeParams, PopupAuthorizeParams, Prompt, ResponseType, SilentAuthorizeParams} from './types';
import {ALL_VIA} from './types';
import {generate as generatePKCE, PKCE, PKCEPublicPart, savePKCEState} from './pkce';
export {parseAuthorizeParamsFromUrl, parseAuthorizeResponseFromLocation} from './util';
export {savePKCEState, getPKCEState, clearPKCEState} from './pkce';
import OAuth2Error from './OAuth2Error';

import OpenIDConfiguration from './OpenIDConfiguration';
import CriiptoConfiguration from './CriiptoConfiguration';
import CriiptoAuthRedirect from './Redirect';
import CriiptoAuthPopup from './Popup';
import CriiptoAuthQrCode from './QrCode';
import CriiptoAuthSilent from './Silent';

export {PromiseCancelledError, UserCancelledError, QrNotEnabledError} from './QrCode';

export * as CSDC from './csdc/index';

export type {AuthorizeUrlParams, AuthorizeUrlParamsOptional, PKCE, PKCEPublicPart};
export {generatePKCE, OpenIDConfiguration, Prompt, AuthorizeResponse, OAuth2Error};

declare var __VERSION__: string;
export const VERSION = typeof __VERSION__ === "undefined" ? "N/A" : __VERSION__;

interface CriiptoAuthOptions {
  domain: string;
  clientID: string;
  store: Storage;

  redirectUri?: string;
  responseType?: ResponseType;
  acrValues?: string | string[];
  scope?: string;
}
export class CriiptoAuth {
  // Private class fields aren't yet supported in all browsers so this is simply removed by the compiler for now.
  #_setupPromise: Promise<void>;
  _openIdConfiguration: OpenIDConfiguration;

  #_criiptoConfigurationPromise: Promise<CriiptoConfiguration>;
  #_criiptoConfiguration: CriiptoConfiguration;

  options: CriiptoAuthOptions;
  domain: string;
  clientID: string;
  popup: CriiptoAuthPopup;
  redirect: CriiptoAuthRedirect;
  qr: CriiptoAuthQrCode;
  silent: CriiptoAuthSilent;
  store: Storage;
  scope: string;

  constructor(options: CriiptoAuthOptions) {
    if (!options.domain || !options.clientID || !options.store) throw new Error('new criipto.Auth({domain, clientID, store}) required');

    this.options = options;
    this.domain = options.domain;
    this.clientID = options.clientID;
    this.store = options.store;

    this.popup = new CriiptoAuthPopup(this);
    this.redirect = new CriiptoAuthRedirect(this);
    this.qr = new CriiptoAuthQrCode(this);
    this.silent = new CriiptoAuthSilent(this);
    this._openIdConfiguration = new OpenIDConfiguration(`https://${this.domain}`, this.clientID);
    this.#_criiptoConfiguration = new CriiptoConfiguration(`https://${this.domain}`, this.clientID);
  }

  _setup() {
    if (!this.#_setupPromise) {
      this.#_setupPromise = this._openIdConfiguration.fetchMetadata();
    }
    return this.#_setupPromise;
  }

  fetchOpenIDConfiguration() {
    return this._setup().then(() => this._openIdConfiguration);
  }

  fetchCriiptoConfiguration() {
    if (!this.#_criiptoConfigurationPromise) {
      this.#_criiptoConfigurationPromise = this.#_criiptoConfiguration.fetchMetadata();
    }
    return this.#_criiptoConfigurationPromise;
  }

  /**
   * Logout the user, clearing any SSO state
   * Will redirect the user to clear the session and then redirect back to `redirectUri`
   */
  async logout(options: {redirectUri: string}) {
    const {redirectUri} = options;
    const configuration = await this.fetchOpenIDConfiguration();

    const url = `${configuration.end_session_endpoint}?post_logout_redirect_uri=${encodeURIComponent(redirectUri)}`;

    window.location.href = url;
  }

  /**
   * Start a redirect based authorize request
   */
  authorize(options: RedirectAuthorizeParams) {
    return this.redirect.authorize(options);
  }

  /*
   * Performs an iframe-based authorize to see if there is an existing SSO session
   */
  async checkSession(params: SilentAuthorizeParams) {
    return this.silent.authorize(params);
  }

  authorizeResponsive(queries:AuthorizeResponsiveParams): Promise<AuthorizeResponse | void> {
    let match:RedirectAuthorizeParams | PopupAuthorizeParams | undefined = undefined;

    for (let [query, params] of Object.entries(queries)) {
      if (!ALL_VIA.includes(params.via!)) {
        throw new Error(`Unknown match.via`);
      }

      if (window.matchMedia(query).matches) {
        match = params;
        break;
      }
    }

    if (match === undefined) throw new Error('No media queries matched');
    const {via, ...params} = match;
    if (via === 'redirect') return this.redirect.authorize(params as RedirectAuthorizeParams);
    if (via === 'popup') return this.popup.authorize(params as PopupAuthorizeParams);
    throw new Error('Invalid media query');
  }

  buildAuthorizeUrl(params: AuthorizeUrlParams) {
    return this._setup().then(() => {
      // Criipto offers a `json` embrace-and-extend response-mode to support certain native app flows
      // Criipto also offers a `post_message` response-mode to support popup flows
      const response_modes_supported = this._openIdConfiguration.response_modes_supported.concat(['json', 'post_message']);
      if (!response_modes_supported.includes(params.responseMode)) throw new Error(`responseMode must be one of ${response_modes_supported.join(',')}`);
      if (!this._openIdConfiguration.response_types_supported.includes(params.responseType)) throw new Error(`responseType must be one of ${this._openIdConfiguration.response_types_supported.join(',')}`);

      const acrValues =
        params.acrValues ?
          Array.isArray(params.acrValues) ?
            params.acrValues :
              params.acrValues.includes(" ") ? params.acrValues.split(" ") : params.acrValues
          : undefined
      if (this._openIdConfiguration.acr_values_supported && acrValues) {
        if (Array.isArray(acrValues)) {
          if (acrValues.some(v => !this._openIdConfiguration.acr_values_supported.includes(v))) {
            throw new Error(`acrValues must all be one of ${this._openIdConfiguration.acr_values_supported.join(',')}`);
          }
        } else if (!this._openIdConfiguration.acr_values_supported.includes(acrValues)) {
          throw new Error(`acrValues must be one of ${this._openIdConfiguration.acr_values_supported.join(',')}`);
        }
      }

      if (!params.redirectUri) throw new Error(`redirectUri must be defined`);

      const url = new URL(this._openIdConfiguration.authorization_endpoint);

      url.searchParams.append('scope', params.scope);
      url.searchParams.append('client_id', this.clientID);
      if (acrValues) {
        url.searchParams.append('acr_values', Array.isArray(acrValues) ? acrValues.join(' ') : acrValues);
      }
      url.searchParams.append('redirect_uri', params.redirectUri);
      url.searchParams.append('response_type', params.responseType);
      url.searchParams.append('response_mode', params.responseMode);

      if (params.pkce) {
        url.searchParams.append('code_challenge', params.pkce.code_challenge);
        url.searchParams.append('code_challenge_method', params.pkce.code_challenge_method);
      }

      if (params.state) {
        url.searchParams.append('state', params.state);
      }

      if (params.nonce) {
        url.searchParams.append('nonce', params.nonce);
      }

      if (params.loginHint) {
        url.searchParams.append('login_hint', params.loginHint);
      }

      if (params.uiLocales) {
        url.searchParams.append('ui_locales', params.uiLocales);
      }

      if (params.prompt) {
        url.searchParams.append('prompt', params.prompt);
      }

      if (params.extraUrlParams) {
        for (let entry of Object.entries(params.extraUrlParams)) {
          url.searchParams.append(entry[0], entry[1]);
        }
      }

      return url.toString();
    });
  }

  processResponse(params : AuthorizeResponse, pkce?: {code_verifier: string, redirect_uri: string}) : Promise<AuthorizeResponse | null> {
    if (params.error) return Promise.reject(new OAuth2Error(params.error, params.error_description, params.state))
    if (params.id_token) return Promise.resolve(params);
    if (!params.code) return Promise.resolve(null);
    if (params.code && !pkce) return Promise.resolve(params);
    
    const state = params.state;
    const body = new URLSearchParams();
    body.append('grant_type', "authorization_code");
    body.append('code', params.code);
    body.append('client_id', this.clientID);
    body.append('redirect_uri', pkce!.redirect_uri);
    body.append('code_verifier', pkce!.code_verifier);

    return this._setup().then(() => {
      return window.fetch(this._openIdConfiguration.token_endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        credentials: 'omit',
        body: body.toString()
      }).then((response : any) => {
        return response.json();
      }).then((params : AuthorizeResponse) => {
        return {...params, state};
      })
    });    
  }

  buildAuthorizeParams(params: AuthorizeUrlParamsOptional): AuthorizeUrlParams {
    const redirectUri = params.redirectUri || this.options.redirectUri;
    const responseType = params.responseType || this.options.responseType || 'code';
    const acrValues = params.acrValues || this.options.acrValues;
    const scope = params.scope || this.options.scope || 'openid';

    if (!redirectUri) throw new Error(`redirectUri must be defined`);

    return {
      redirectUri: redirectUri!,
      responseMode: params.responseMode || 'query',
      responseType: responseType!,
      acrValues: acrValues,
      pkce: params.pkce,
      state: params.state,
      loginHint: params.loginHint,
      uiLocales: params.uiLocales,
      extraUrlParams: params.extraUrlParams,
      scope: scope,
      prompt: params.prompt,
      nonce: params.nonce
    };
  }
};

export default CriiptoAuth;
