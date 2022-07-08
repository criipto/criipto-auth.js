import type {AuthorizeUrlParams, AuthorizeUrlParamsOptional, AuthorizeResponse, AuthorizeResponsiveParams, RedirectAuthorizeParams, PopupAuthorizeParams, Prompt} from './types';
import {ALL_VIA} from './types';
import {generate as generatePKCE, PKCE, PKCEPublicPart} from './pkce';
import {parseAuthorizeParamsFromUrl} from './util';

import OpenIDConfiguration from './OpenID';
import CriiptoAuthRedirect from './Redirect';
import CriiptoAuthPopup from './Popup';

export type {AuthorizeUrlParams, AuthorizeUrlParamsOptional, PKCE, PKCEPublicPart};
export {generatePKCE, OpenIDConfiguration, Prompt, AuthorizeResponse, parseAuthorizeParamsFromUrl};

interface CriiptoAuthOptions {
  domain: string;
  clientID: string;
  store: Storage;

  redirectUri?: string;
  responseMode?: string;
  responseType?: string;
  acrValues?: string | string[];
  scope?: string;
}

export class OAuth2Error extends Error {
  error: string;
  error_description?: string;

  constructor(error: string, error_description?: string) {
    super(`OAuth2Error: ${error} (${error_description})`);
    this.name = "OAuth2Error";
    this.error = error;
    this.error_description = error_description;
  }
}

export class CriiptoAuth {
  options: CriiptoAuthOptions;
  domain: string;
  clientID: string;
  popup: CriiptoAuthPopup;
  redirect: CriiptoAuthRedirect;
  store: Storage;
  _setupPromise: Promise<void>;
  _openIdConfiguration: OpenIDConfiguration;
  scope: string;

  constructor(options: CriiptoAuthOptions) {
    if (!options.domain || !options.clientID || !options.store) throw new Error('new criipto.Auth({domain, clientID, store}) required');

    this.options = options;
    this.domain = options.domain;
    this.clientID = options.clientID;
    this.store = options.store;

    this.popup = new CriiptoAuthPopup(this);
    this.redirect = new CriiptoAuthRedirect(this);
    this._openIdConfiguration = new OpenIDConfiguration(`https://${this.domain}`, this.clientID);
  }

  _setup() {
    if (!this._setupPromise) {
      this._setupPromise = this._openIdConfiguration.fetchMetadata();
    }
    return this._setupPromise;
  }

  fetchOpenIDConfiguration() {
    return this._setup().then(() => this._openIdConfiguration);
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
      const response_modes_supported = this._openIdConfiguration.response_modes_supported.concat(['json']);
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

  processResponse(params : AuthorizeResponse, pkce: {code_verifier: string, redirect_uri: string}) : Promise<AuthorizeResponse | null> {
    if (params.error) return Promise.reject(new OAuth2Error(params.error, params.error_description))
    if (params.id_token) return Promise.resolve(params);
    if (!params.code) return Promise.resolve(null);
    
    const state = params.state;
    const body = new URLSearchParams();
    body.append('grant_type', "authorization_code");
    body.append('code', params.code);
    body.append('client_id', this.clientID);
    body.append('redirect_uri', pkce.redirect_uri);
    body.append('code_verifier', pkce.code_verifier);

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
    const responseMode = params.responseMode || this.options.responseMode || 'query';
    const responseType = params.responseType || this.options.responseType || 'code';
    const acrValues = params.acrValues || this.options.acrValues;
    const scope = params.scope || this.options.scope || 'openid';

    if (!redirectUri) throw new Error(`redirectUri must be defined`);

    return {
      redirectUri: redirectUri!,
      responseMode: responseMode!,
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
