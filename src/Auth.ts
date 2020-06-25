import type {AuthorizeUrlParams, AuthorizeUrlParamsOptional, AuthorizeResponse, AuthorizeResponsiveParams, RedirectAuthorizeParams, PopupAuthorizeParams} from './types';
import {ALL_VIA} from './types';

import OpenIDConfiguration from './OpenID';
import CriiptoAuthRedirect from './Redirect';
import CriiptoAuthPopup from './Popup';

interface CriiptoAuthOptions {
  domain: string;
  clientID: string;

  redirectUri?: string;
  responseMode?: string;
  responseType?: string;
  acrValues?: string;
}

export class CriiptoAuth {
  options: CriiptoAuthOptions;
  domain: string;
  clientID: string;
  popup: CriiptoAuthPopup;
  redirect: CriiptoAuthRedirect;
  _setupPromise: Promise<void>;
  _openIdConfiguration: OpenIDConfiguration;

  constructor(options:CriiptoAuthOptions) {
    if (!options.domain || !options.clientID) throw new Error('new criipto.Auth({domain, clientID}) required');

    this.options = options;
    this.domain = options.domain;
    this.clientID = options.clientID;

    this.popup = new CriiptoAuthPopup(this);
    this.redirect = new CriiptoAuthRedirect(this);
    this._openIdConfiguration = new OpenIDConfiguration(`https://${this.domain}`);
  }

  _setup() {
    if (!this._setupPromise) {
      this._setupPromise = this._openIdConfiguration.fetchMetadata();
    }
    return this._setupPromise;
  }

  authorizeResponsive(queries:AuthorizeResponsiveParams): Promise<AuthorizeResponse | void> {
    let match:RedirectAuthorizeParams | PopupAuthorizeParams;

    for (let [query, params] of Object.entries(queries)) {
      if (!ALL_VIA.includes(params.via)) {
        throw new Error(`Unknown match.via`);
      }

      if (window.matchMedia(query).matches) {
        match = params;
        break;
      }
    }

    if (!match) throw new Error('No media queries matched');
    const {via, ...params} = match;
    if (via === 'redirect') return this.redirect.authorize(params as RedirectAuthorizeParams);
    if (via === 'popup') return this.popup.authorize(params as PopupAuthorizeParams);
  }

  buildAuthorizeUrl(params: AuthorizeUrlParams) {
    return this._setup().then(() => {
      if (!this._openIdConfiguration.response_modes_supported.includes(params.responseMode)) throw new Error(`responseMode must be one of ${this._openIdConfiguration.response_modes_supported.join(',')}`);
      if (!this._openIdConfiguration.response_types_supported.includes(params.responseType)) throw new Error(`responseType must be one of ${this._openIdConfiguration.response_types_supported.join(',')}`);
      if (!this._openIdConfiguration.acr_values_supported.includes(params.acrValues)) throw new Error(`acrValues must be one of ${this._openIdConfiguration.acr_values_supported.join(',')}`);
      if (!params.redirectUri) throw new Error(`redirectUri must be defined`);

      return `${this._openIdConfiguration.authorization_endpoint}?client_id=${this.clientID}&acr_values=${params.acrValues}&redirect_uri=${encodeURIComponent(params.redirectUri)}&response_type=${params.responseType}&scope=openid&response_mode=${params.responseMode}`;  
    });
  }

  buildAuthorizeParams(params: AuthorizeUrlParamsOptional):AuthorizeUrlParams {
    const redirectUri = params.redirectUri || this.options.redirectUri;
    const responseMode = params.responseMode || this.options.responseMode || 'query';
    const responseType = params.responseType || this.options.responseType || 'code';
    const acrValues = params.acrValues || this.options.acrValues;

    if (!redirectUri) throw new Error(`redirectUri must be defined`);
    if (!acrValues) throw new Error(`acrValues must be defined`);

    return {
      redirectUri: redirectUri!,
      responseMode: responseMode!,
      responseType: responseType!,
      acrValues: acrValues!
    };
  }
};

export default CriiptoAuth;