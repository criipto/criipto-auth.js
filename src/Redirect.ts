import type CriiptoAuth from './index';
import type {RedirectAuthorizeParams, AuthorizeResponse} from './types';
import {parseAuthorizeResponseFromLocation} from './util';
import {clearPKCEState, generate as generatePKCE, getPKCEState, PKCE, PKCEPublicPart, PKCE_STATE_KEY, savePKCEState} from './pkce';
import { OAuth2Error } from './index';

export default class CriiptoAuthRedirect {
  criiptoAuth: CriiptoAuth
  store: Storage

  constructor(criiptoAuth: CriiptoAuth) {
    this.criiptoAuth = criiptoAuth;
    this.store = this.criiptoAuth.store;
  }

  /**
   * Start a redirect based authorize request
   */
  async authorize(params: RedirectAuthorizeParams): Promise<void> {
    const redirectUri = params.redirectUri || this.criiptoAuth.options.redirectUri;
    const responseType = params.responseType ?? 'id_token';
    const pkce = await (
      params.pkce ?
        Promise.resolve(params.pkce) :
        responseType === 'id_token' ?
          generatePKCE() : Promise.resolve(undefined)
    );

    savePKCEState(this.store, pkce && "code_verifier" in pkce ? {
      response_type: 'id_token',
      redirect_uri: redirectUri!,
      pkce_code_verifier: pkce.code_verifier
    } : {
      response_type: 'code',
      redirect_uri: redirectUri!
    });

    const url = await this.criiptoAuth.buildAuthorizeUrl(this.criiptoAuth.buildAuthorizeParams({
      ...params,
      responseMode: 'query',
      responseType: 'code',
      pkce
    }));

    window.location.href = url;
  }

  /* 
   * Asynchronously check url for oauth2 response parameters and perform PKCE/token exchange
   */
  match(): Promise<AuthorizeResponse | null> {
    if (!("location" in globalThis)) return Promise.resolve(null);
    const params = parseAuthorizeResponseFromLocation(globalThis.location);
    if (!params.code && !params.error && !params.id_token) return Promise.resolve(null);
    if (params.error) return Promise.reject(new OAuth2Error(params.error, params.error_description, params.state))
    if (params.id_token) return Promise.resolve(params);

    const state = getPKCEState(this.store);
    if (!state) return Promise.reject(new Error('No redirect state available'));

    return this.criiptoAuth.processResponse(params, state.response_type === 'id_token' ? {
      code_verifier: state.pkce_code_verifier,
      redirect_uri: state.redirect_uri
    } : undefined).then(response => {
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
    if (!("location" in globalThis)) return false;
    const params = parseAuthorizeResponseFromLocation(globalThis.location);
    if (!params.code && !params.error && !params.id_token) return false;
    return true;
  }
}