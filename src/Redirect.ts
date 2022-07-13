import type CriiptoAuth from './index';
import type {RedirectAuthorizeParams, AuthorizeResponse} from './types';
import {parseAuthorizeResponseFromLocation} from './util';
import {generate as generatePKCE, PKCE_STATE_KEY} from './pkce';

export default class CriiptoAuthRedirect {
  criiptoAuth: CriiptoAuth
  store: Storage

  constructor(criiptoAuth: CriiptoAuth) {
    this.criiptoAuth = criiptoAuth;
    this.store = this.criiptoAuth.store;
  }

  authorize(params: RedirectAuthorizeParams): Promise<void> {
    let redirectUri = params.redirectUri || this.criiptoAuth.options.redirectUri;
    return generatePKCE().then(pkce => {
      this.store.setItem(PKCE_STATE_KEY, JSON.stringify({
        redirect_uri: redirectUri!,
        pkce_code_verifier: pkce.code_verifier
      }));

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

  match(): Promise<AuthorizeResponse | null> {
    const params = parseAuthorizeResponseFromLocation(window.location);
    if (!params.code && !params.error && !params.id_token) return Promise.resolve(null);

    const state = this.store.getItem(PKCE_STATE_KEY);
    if (!state) return Promise.reject(new Error('No pkce_code_verifier available'));

    const {pkce_code_verifier, redirect_uri} = JSON.parse(state);

    return this.criiptoAuth.processResponse(params, {
      code_verifier: pkce_code_verifier,
      redirect_uri
    }).then(response => {
      if (response) {
        this.store.removeItem(PKCE_STATE_KEY);
      }
      return response;
    }).catch(err => {
      this.store.removeItem(PKCE_STATE_KEY);
      return Promise.reject(err);
    });
  }
}