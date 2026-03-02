import type CriiptoAuth from "./index";
import type { RedirectAuthorizeParams, AuthorizeResponse } from "./types";
import { parseAuthorizeResponseFromLocation } from "./util";
import {
  clearPKCEState,
  generate as generatePKCE,
  getPKCEState,
  PKCE,
  PKCEPublicPart,
  PKCE_STATE_KEY,
  savePKCEState,
} from "./pkce";
import { OAuth2Error } from "./index";

const TRACEID_KEY = "@criipto/verify-js:traceId";
export default class CriiptoAuthRedirect {
  criiptoAuth: CriiptoAuth;
  store: Storage;

  constructor(criiptoAuth: CriiptoAuth) {
    this.criiptoAuth = criiptoAuth;
    this.store = this.criiptoAuth.store;
  }

  /**
   * Start a redirect based authorize request
   */
  async authorize(params: RedirectAuthorizeParams): Promise<void> {
    const redirectUri =
      params.redirectUri || this.criiptoAuth.options.redirectUri;
    const responseType = params.responseType ?? "id_token";
    const pkce = await (params.pkce
      ? Promise.resolve(params.pkce)
      : responseType === "id_token"
        ? generatePKCE()
        : Promise.resolve(undefined));

    savePKCEState(
      this.store,
      pkce && "code_verifier" in pkce
        ? {
            response_type: "id_token",
            redirect_uri: redirectUri!,
            pkce_code_verifier: pkce.code_verifier,
          }
        : {
            response_type: "code",
            redirect_uri: redirectUri!,
          },
    );

    const { authorizeUrl, traceId } =
      await this.criiptoAuth.pushAuthorizationRequest(
        this.criiptoAuth.buildAuthorizeParams({
          ...params,
          responseMode: "query",
          responseType: "code",
          pkce,
        }),
        params.traceParent,
      );

    this.store.setItem(TRACEID_KEY, traceId);

    globalThis.location.href = authorizeUrl.toString();
  }

  /*
   * Asynchronously check url for oauth2 response parameters and perform PKCE/token exchange
   */
  match(opts: { location?: URL } = {}): Promise<AuthorizeResponse | null> {
    const location =
      opts.location ??
      ("location" in globalThis ? globalThis.location : undefined);

    if (!location) return Promise.resolve(null);

    const params = parseAuthorizeResponseFromLocation(location);
    if (!params.code && !params.error && !params.id_token)
      return Promise.resolve(null);
    if (params.error)
      return Promise.reject(
        new OAuth2Error(params.error, params.error_description, params.state),
      );
    if (params.id_token) return Promise.resolve(params);

    const state = getPKCEState(this.store);
    if (!state) return Promise.reject(new Error("No redirect state available"));

    const clearState = () => {
      clearPKCEState(this.store);
      this.store.removeItem(TRACEID_KEY);
    };

    return this.criiptoAuth
      .processResponse(
        params,
        state.response_type === "id_token"
          ? {
              code_verifier: state.pkce_code_verifier,
              redirect_uri: state.redirect_uri,
            }
          : undefined,
      )
      .then((response) => {
        if (response) {
          response.traceId = this.store.getItem(TRACEID_KEY) ?? undefined;
          clearState();
        }
        return response;
      })
      .catch((err) => {
        clearState();
        return Promise.reject(err);
      });
  }

  /*
   * Synchronously check url for oauth2 response parameters, does not PKCE or token exchange.
   */
  hasMatch(opts: { location?: Location } = {}) {
    const location =
      opts.location ??
      ("location" in globalThis ? globalThis.location : undefined);

    if (!location) return false;
    const params = parseAuthorizeResponseFromLocation(location);
    if (!params.code && !params.error && !params.id_token) return false;
    return true;
  }
}
