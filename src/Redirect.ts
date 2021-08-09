import type CriiptoAuth from './index';
import type {RedirectAuthorizeParams, AuthorizeResponse} from './types';
import {parseAuthorizeResponseFromLocation} from './util';

export default class CriiptoAuthRedirect {
  criiptoAuth: CriiptoAuth

  constructor(criiptoAuth: CriiptoAuth) {
    this.criiptoAuth = criiptoAuth;
  }

  authorize(params: RedirectAuthorizeParams): Promise<void> {
    return this.criiptoAuth.generatePKCE(params.redirectUri || this.criiptoAuth.options.redirectUri).then(pkce => {
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

  match(): Promise<AuthorizeResponse> {
    const params = parseAuthorizeResponseFromLocation(window.location);
    return this.criiptoAuth.processResponse(params);
  }
}