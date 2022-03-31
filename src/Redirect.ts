import type CriiptoAuth from './index';
import type {RedirectAuthorizeParams, AuthorizeResponse} from './types';
import {parseAuthorizeResponseFromLocation} from './util';
import {generate as generatePKCE} from './pkce';

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
      this.store.setItem('pkce_redirect_uri', redirectUri!);
      this.store.setItem('pkce_code_verifier', pkce.code_verifier);

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

    const pkce_code_verifier = this.store.getItem('pkce_code_verifier');

    if (!pkce_code_verifier) return Promise.reject(new Error('No pkce_code_verifier available'));

    return this.criiptoAuth.processResponse(params, {
      code_verifier: pkce_code_verifier,
      redirect_uri: this.store.getItem('pkce_redirect_uri')!
    }).then(response => {
      if (response) {
        this.store.removeItem('pkce_redirect_uri');
        this.store.removeItem('pkce_code_verifier');
      }
      return response;
    }).catch(err => {
      this.store.removeItem('pkce_redirect_uri');
      this.store.removeItem('pkce_code_verifier');
      return Promise.reject(err);
    });
  }
}