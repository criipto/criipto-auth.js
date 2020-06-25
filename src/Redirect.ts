import type {CriiptoAuth} from './Auth';
import type {RedirectAuthorizeParams, AuthorizeResponse} from './types';
import {parseAuthorizeResponseFromLocation} from './util';

export default class CriiptoAuthRedirect {
  criiptoAuth: CriiptoAuth

  constructor(criiptoAuth: CriiptoAuth) {
    this.criiptoAuth = criiptoAuth;
  }

  authorize(params: RedirectAuthorizeParams): Promise<void> {
    return this.criiptoAuth.buildAuthorizeUrl(this.criiptoAuth.buildAuthorizeParams(params)).then(url => {
      window.location.href = url;
    });
  }

  match(): AuthorizeResponse {
    const params = parseAuthorizeResponseFromLocation(window.location);
    if (params.code || params.id_token) return params;
    return null;
  }
}