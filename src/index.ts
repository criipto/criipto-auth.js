import type {
  AuthorizeUrlParams,
  AuthorizeUrlParamsOptional,
  AuthorizeResponse,
  AuthorizeResponsiveParams,
  RedirectAuthorizeParams,
  PopupAuthorizeParams,
  Prompt,
  ResponseType,
  SilentAuthorizeParams,
  Claims,
} from "./types";
import { ALL_VIA } from "./types";
import { generate as generatePKCE, PKCE, PKCEPublicPart } from "./pkce";
import OAuth2Error from "./OAuth2Error";
import { createRemoteJWKSet, jwtVerify } from "jose";

import OpenIDConfiguration from "./OpenIDConfiguration";
import CriiptoConfiguration from "./CriiptoConfiguration";
import CriiptoAuthRedirect from "./Redirect";
import CriiptoAuthPopup from "./Popup";
import CriiptoAuthQrCode from "./QrCode";
import CriiptoAuthSilent from "./Silent";

import { version } from "../package.json";

export {
  parseAuthorizeParamsFromUrl,
  parseAuthorizeResponseFromLocation,
} from "./util";
export { savePKCEState, getPKCEState, clearPKCEState } from "./pkce";

export {
  PromiseCancelledError,
  UserCancelledError,
  QrNotEnabledError,
} from "./QrCode";

export type { CriiptoConfiguration } from "./CriiptoConfiguration";

export * as CSDC from "./csdc/index";

export { IduraSDKError } from "./errors";

export type {
  AuthorizeUrlParams,
  AuthorizeUrlParamsOptional,
  RedirectAuthorizeParams,
  PopupAuthorizeParams,
  ResponseType,
  PKCE,
  PKCEPublicPart,
};
export {
  generatePKCE,
  OpenIDConfiguration,
  Prompt,
  AuthorizeResponse,
  OAuth2Error,
};

interface CriiptoAuthOptions {
  domain: string;
  clientID: string;
  store: Storage;

  redirectUri?: string;
  responseType?: ResponseType;
  acrValues?: string | string[];
  scope?: string;

  /**
   * @deprecated Development use only
   */
  protocol?: "https" | "http";
}
export class CriiptoAuth {
  // Private class fields aren't yet supported in all browsers so this is simply removed by the compiler for now.
  #_setupPromise: Promise<OpenIDConfiguration>;
  _openIdConfiguration: OpenIDConfiguration;

  #_criiptoConfigurationPromise: Promise<CriiptoConfiguration>;
  #_criiptoConfiguration: CriiptoConfiguration;
  #_jwks: ReturnType<typeof createRemoteJWKSet>;

  options: CriiptoAuthOptions;
  domain: string;
  clientID: string;
  popup: CriiptoAuthPopup;
  redirect: CriiptoAuthRedirect;
  qr: CriiptoAuthQrCode;
  silent: CriiptoAuthSilent;
  store: Storage;
  scope: string;

  constructor(options: CriiptoAuthOptions) {
    if (!options.domain || !options.clientID || !options.store)
      throw new Error("new criipto.Auth({domain, clientID, store}) required");

    this.options = options;
    this.domain = options.domain;
    this.clientID = options.clientID;
    this.store = options.store;

    this.popup = new CriiptoAuthPopup(this);
    this.redirect = new CriiptoAuthRedirect(this);
    this.qr = new CriiptoAuthQrCode(this);
    this.silent = new CriiptoAuthSilent(this);

    const protocol = options.protocol ?? "https";
    this._openIdConfiguration = new OpenIDConfiguration(
      `${protocol}://${this.domain}`,
      this.clientID,
    );
    this.#_criiptoConfiguration = new CriiptoConfiguration(
      `${protocol}://${this.domain}`,
      this.clientID,
    );
  }

  _setup() {
    if (!this.#_setupPromise) {
      this.#_setupPromise = this._openIdConfiguration
        .fetchMetadata()
        .then((metadata) => {
          this.#_jwks = createRemoteJWKSet(new URL(metadata.jwks_uri));
          return metadata;
        });
    }
    return this.#_setupPromise;
  }

  fetchOpenIDConfiguration() {
    return this._setup().then(() => this._openIdConfiguration);
  }

  fetchCriiptoConfiguration() {
    if (!this.#_criiptoConfigurationPromise) {
      this.#_criiptoConfigurationPromise =
        this.#_criiptoConfiguration.fetchMetadata();
    }
    return this.#_criiptoConfigurationPromise;
  }

  /**
   * Logout the user, clearing any SSO state
   * Will redirect the user to clear the session and then redirect back to `redirectUri`
   */
  async logout(options: { redirectUri: string; state?: string }) {
    const { redirectUri, state } = options;
    const configuration = await this.fetchOpenIDConfiguration();

    const url = new URL(configuration.end_session_endpoint);
    url.searchParams.set("post_logout_redirect_uri", redirectUri);
    if (state) url.searchParams.set("state", state);

    window.location.href = url.href;
  }

  /**
   * Start a redirect based authorize request
   */
  authorize(options: RedirectAuthorizeParams) {
    return this.redirect.authorize(options);
  }

  /*
   * Performs an iframe-based authorize to see if there is an existing SSO session
   */
  async checkSession(params: SilentAuthorizeParams) {
    return this.silent.authorize(params);
  }

  authorizeResponsive(
    queries: AuthorizeResponsiveParams,
  ): Promise<AuthorizeResponse | void> {
    let match: RedirectAuthorizeParams | PopupAuthorizeParams | undefined =
      undefined;

    for (let [query, params] of Object.entries(queries)) {
      if (!ALL_VIA.includes(params.via!)) {
        throw new Error(`Unknown match.via`);
      }

      if (window.matchMedia(query).matches) {
        match = params;
        break;
      }
    }

    if (match === undefined) throw new Error("No media queries matched");
    const { via, ...params } = match;
    if (via === "redirect")
      return this.redirect.authorize(params as RedirectAuthorizeParams);
    if (via === "popup")
      return this.popup.authorize(params as PopupAuthorizeParams);
    throw new Error("Invalid media query");
  }

  async buildAuthorizeUrlSearchParams(params: AuthorizeUrlParams) {
    await this._setup();

    // Criipto offers a `json` embrace-and-extend response-mode to support certain native app flows
    // Criipto also offers a `post_message` response-mode to support popup flows
    const response_modes_supported =
      this._openIdConfiguration.response_modes_supported.concat([
        "json",
        "post_message",
      ]);
    if (!response_modes_supported.includes(params.responseMode))
      throw new Error(
        `responseMode must be one of ${response_modes_supported.join(",")}`,
      );
    if (
      !this._openIdConfiguration.response_types_supported.includes(
        params.responseType,
      )
    )
      throw new Error(
        `responseType must be one of ${this._openIdConfiguration.response_types_supported.join(",")}`,
      );

    if (!params.redirectUri) throw new Error(`redirectUri must be defined`);

    const searchParams = new URLSearchParams();
    searchParams.append("scope", params.scope);
    searchParams.append("client_id", this.clientID);

    const acrValues = params.acrValues
      ? Array.isArray(params.acrValues)
        ? params.acrValues
        : params.acrValues.includes(" ")
          ? params.acrValues.split(" ")
          : params.acrValues
      : undefined;

    if (acrValues) {
      searchParams.append(
        "acr_values",
        Array.isArray(acrValues) ? acrValues.join(" ") : acrValues,
      );
    }
    searchParams.append("redirect_uri", params.redirectUri);
    searchParams.append("response_type", params.responseType);
    searchParams.append("response_mode", params.responseMode);

    if (params.pkce) {
      searchParams.append("code_challenge", params.pkce.code_challenge);
      searchParams.append(
        "code_challenge_method",
        params.pkce.code_challenge_method,
      );
    }

    if (params.state) {
      searchParams.append("state", params.state);
    }

    if (params.nonce) {
      searchParams.append("nonce", params.nonce);
    }

    if (params.loginHint) {
      searchParams.append("login_hint", params.loginHint);
    }

    if (params.uiLocales) {
      searchParams.append("ui_locales", params.uiLocales);
    }

    if (params.prompt) {
      searchParams.append("prompt", params.prompt);
    }

    if (params.extraUrlParams) {
      for (let entry of Object.entries(params.extraUrlParams)) {
        if (!entry[1]) continue;
        searchParams.append(entry[0], entry[1]);
      }
    }

    searchParams.set("criipto_sdk", `@criipto/auth-js@${version}`);
    if (params.extraUrlParams?.criipto_sdk !== undefined) {
      if (params.extraUrlParams?.criipto_sdk === null) {
        searchParams.delete("criipto_sdk");
      } else {
        searchParams.set("criipto_sdk", params.extraUrlParams?.criipto_sdk);
      }
    }

    return searchParams;
  }

  async buildAuthorizeUrl(params: AuthorizeUrlParams) {
    await this._setup();
    const url = new URL(this._openIdConfiguration.authorization_endpoint);
    for (const [key, value] of (
      await this.buildAuthorizeUrlSearchParams(params)
    ).entries()) {
      url.searchParams.set(key, value);
    }
    return url.toString();
  }

  async pushAuthorizationRequest(
    params: AuthorizeUrlParams,
    traceParent?: string,
  ): Promise<{ authorizeUrl: URL; traceId: string }> {
    await this._setup();
    const parUrl = new URL(
      this._openIdConfiguration.pushed_authorization_request_endpoint,
    );

    const headers: Record<string, any> = {
      Prefer: "return-trace-id",
    };

    if (traceParent) {
      headers.traceparent = traceParent;
    }

    const response = await fetch(parUrl, {
      body: await this.buildAuthorizeUrlSearchParams(params),
      method: "POST",
      headers,
    });

    if (response.status !== 201) {
      let errorDescription = response.statusText;
      try {
        const errorResponse = (await response.json()) as {
          error_description?: string;
        };
        errorDescription = errorResponse.error_description ?? "";
      } catch {
        // This space intentionally left blank. In case we cannot parse the JSON from the response,
        // we want to throw par initialization error, not a JSON parsing error.
      }
      throw new Error(
        `Error during PAR request (code: ${response.status}) (description: ${errorDescription})`,
      );
    }

    const body = await response.json();

    const authorizeUrl = new URL(
      this._openIdConfiguration.authorization_endpoint,
    );
    authorizeUrl.searchParams.append("request_uri", body["request_uri"]);
    authorizeUrl.searchParams.append("client_id", this.clientID);

    return { authorizeUrl, traceId: response.headers.get("Trace-Id")! };
  }

  processResponse(
    params: AuthorizeResponse,
    pkce?: { code_verifier: string; redirect_uri: string },
  ): Promise<AuthorizeResponse | null> {
    if (params.error)
      return Promise.reject(
        new OAuth2Error(params.error, params.error_description, params.state),
      );
    if (params.id_token) return Promise.resolve(params);
    if (!params.code) return Promise.resolve(null);
    if (params.code && !pkce) return Promise.resolve(params);

    const state = params.state;
    const body = new URLSearchParams();
    body.append("grant_type", "authorization_code");
    body.append("code", params.code);
    body.append("client_id", this.clientID);
    body.append("redirect_uri", pkce!.redirect_uri);
    body.append("code_verifier", pkce!.code_verifier);

    return this._setup().then(() => {
      return globalThis
        .fetch(this._openIdConfiguration.token_endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          credentials: "omit",
          body: body.toString(),
        })
        .then((response: any) => {
          return response.json();
        })
        .then((params: AuthorizeResponse) => {
          if (params.id_token) {
            return jwtVerify(params.id_token!, this.#_jwks, {
              issuer: this._openIdConfiguration.issuer,
              audience: this.clientID,
              clockTolerance: 5 * 60,
            }).then(({ payload }) => {
              return {
                ...params,
                state,
                claims: payload as Claims,
              };
            });
          }
          return { ...params, state };
        });
    });
  }

  buildAuthorizeParams(params: AuthorizeUrlParamsOptional): AuthorizeUrlParams {
    const redirectUri = params.redirectUri || this.options.redirectUri;
    const responseType =
      params.responseType || this.options.responseType || "code";
    const acrValues = params.acrValues || this.options.acrValues;
    const scope = params.scope || this.options.scope || "openid";

    if (!redirectUri) throw new Error(`redirectUri must be defined`);

    return {
      redirectUri: redirectUri!,
      responseMode: params.responseMode || "query",
      responseType: responseType!,
      acrValues: acrValues,
      pkce: params.pkce,
      state: params.state,
      loginHint: params.loginHint,
      uiLocales: params.uiLocales,
      extraUrlParams: params.extraUrlParams,
      scope: scope,
      prompt: params.prompt,
      nonce: params.nonce,
    };
  }
}

export default CriiptoAuth;
