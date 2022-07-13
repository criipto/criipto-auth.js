import type CriiptoAuth from './index';
import type {RedirectAuthorizeParams, AuthorizeResponse} from './types';
import {parseAuthorizeResponseFromLocation} from './util';
import {clearPKCEState, generate as generatePKCE, getPKCEState, PKCE_STATE_KEY, savePKCEState} from './pkce';
import { OAuth2Error } from './index';

export default class CriiptoAuthRedirect {
  criiptoAuth: CriiptoAuth
  store: Storage

  constructor(criiptoAuth: CriiptoAuth) {
    this.criiptoAuth = criiptoAuth;
    this.store = this.criiptoAuth.store;
  }

  authorize(params: RedirectAuthorizeParams): Promise<void> {
    let redirectUri = params.redirectUri || this.criiptoAuth.options.redirectUri;
    return (params.pkce && "code_verifier" in params.pkce ? Promise.resolve(params.pkce) : generatePKCE()).then(pkce => {
      savePKCEState(this.store, {
        redirect_uri: redirectUri!,
        pkce_code_verifier: pkce.code_verifier
      });

      return this.criiptoAuth.buildAuthorizeUrl(this.criiptoAuth.buildAuthorizeParams({
        ...params,
        responseMode: 'query',
        responseType: 'code',
        pkce
      })).then(url => {
        window.location.href = url;
      });
    });
  }

  /* 
   * Asynchronously check url for oauth2 response parameters and perform PKCE/token exchange
   */
  match(): Promise<AuthorizeResponse | null> {
    const params = parseAuthorizeResponseFromLocation(window.location);
    if (!params.code && !params.error && !params.id_token) return Promise.resolve(null);
    if (params.error) return Promise.reject(new OAuth2Error(params.error, params.error_description, params.state))
    if (params.id_token) return Promise.resolve(params);

    const state = getPKCEState(this.store);
    if (!state) return Promise.reject(new Error('No pkce_code_verifier available'));

    const {pkce_code_verifier, redirect_uri} = state;

    return this.criiptoAuth.processResponse(params, {
      code_verifier: pkce_code_verifier,
      redirect_uri
    }).then(response => {
      if (response) {
        clearPKCEState(this.store);
      }
      return response;
    }).catch(err => {
      clearPKCEState(this.store);
      return Promise.reject(err);
    });
  }

  /*
   * Synchronously check url for oauth2 response parameters, does not PKCE or token exchange.
   */
  hasMatch() {
    const params = parseAuthorizeResponseFromLocation(window.location);
    if (!params.code && !params.error && !params.id_token) return false;
    return true;
  }
}