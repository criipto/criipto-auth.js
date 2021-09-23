import type CriiptoAuth from './index';
import type {RedirectAuthorizeParams, AuthorizeResponse} from './types';
import {parseAuthorizeResponseFromLocation} from './util';

export default class CriiptoAuthRedirect {
  criiptoAuth: CriiptoAuth

  constructor(criiptoAuth: CriiptoAuth) {
    this.criiptoAuth = criiptoAuth;
  }

  authorize(params: RedirectAuthorizeParams): Promise<void> {
    let redirectUri = params.redirectUri || this.criiptoAuth.options.redirectUri;
    return this.criiptoAuth.generatePKCE(redirectUri!).then(pkce => {
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
    return this.criiptoAuth.processResponse(params);
  }
}