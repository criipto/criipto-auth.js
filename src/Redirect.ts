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
   * Start redirect based authorize request via PAR
   */
  async par(params: RedirectAuthorizeParams) : Promise<{request_uri: string, trace_id: string | null}> {
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

    const authorizeParams = this.criiptoAuth.buildAuthorizeUrlParams(this.criiptoAuth.buildAuthorizeParams({
      ...params,
      responseMode: 'query',
      responseType: 'code',
      pkce
    }));

    const configuration = await this.criiptoAuth.fetchOpenIDConfiguration();
    const response = await fetch(configuration.pushed_authorization_request_endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
         // Prefer: 'return-trace-id',
      },
      body: authorizeParams
    });

    if (response.status !== 201) {
      // Left vague, developers should inspect dev tools for the full response
      throw new Error(`${configuration.pushed_authorization_request_endpoint} responded ${response.status}`);
    }

    const data = await response.json() as {request_uri: string};
    const traceId = response.headers.get('trace-id') ?? response.headers.get('Trace-Id');
    if (!data.request_uri) {
      // Left vague, developers should inspect dev tools for the full response
      throw new Error(`${configuration.pushed_authorization_request_endpoint} returned invalid response`);
    }
    return {request_uri: data.request_uri, trace_id: traceId}
  }

  /**
   * Start a redirect based authorize request
   */
  async authorize(params: RedirectAuthorizeParams | {request_uri: string}): Promise<void> {
    if ('request_uri' in params) {
      const url = await this.criiptoAuth.buildAuthorizeUrl(params);

      globalThis.location.href = url;
    } else {
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

      globalThis.location.href = url;
    }
  }

  /* 
   * Asynchronously check url for oauth2 response parameters and perform PKCE/token exchange
   */
  match(opts: {location?: URL} = {}): Promise<AuthorizeResponse | null> {
    const location =
      opts.location ??
      ("location" in globalThis ? globalThis.location : undefined);
    
    if (!location) return Promise.resolve(null);
    
    const params = parseAuthorizeResponseFromLocation(location);
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
  hasMatch(opts: {location?: Location} = {}) {
    const location =
      opts.location ??
      ("location" in globalThis ? globalThis.location : undefined);
    
    if (!location) return false;
    const params = parseAuthorizeResponseFromLocation(location);
    if (!params.code && !params.error && !params.id_token) return false;
    return true;
  }
}