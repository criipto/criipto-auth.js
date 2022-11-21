import {PKCE, PKCEPublicPart} from './pkce';

export type GenericObject = { [key: string]: any };

export type Prompt = undefined | 'none' | 'login';
export type ResponseType = 'code' | 'id_token';

export interface AuthorizeUrlParams {
  acrValues?: string | string[];
  redirectUri: string;
  responseType: ResponseType;
  responseMode: string;
  pkce?: PKCE | PKCEPublicPart;
  state?: string;
  loginHint?: string;
  uiLocales?: string;
  extraUrlParams?: {[key: string]: string | null};
  scope: string;
  prompt?: Prompt;
  nonce?: string
};

export interface AuthorizeUrlParamsOptional {
  acrValues?: string | string[];
  redirectUri?: string;
  responseType?: ResponseType;
  responseMode?: string;
  pkce?: PKCE | PKCEPublicPart;
  state?: string
  loginHint?: string;
  uiLocales?: string;
  extraUrlParams?: {[key: string]: string | null};
  scope?: string;
  prompt?: Prompt;
  nonce?: string
};

export interface AuthorizeResponse extends GenericObject {
  code?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
  state?: string;
};

export const ALL_VIA = ['redirect', 'popup'] as const; // TS 3.4
type ViaTuple = typeof ALL_VIA;
type Via = ViaTuple[number];

export interface AuthorizeParams extends Partial<Omit<AuthorizeUrlParams, 'responseMode'>> {
  via: Via,
  acrValues?: string | string[];
  redirectUri?: string;
  responseType?: ResponseType;
}

export interface RedirectAuthorizeParams extends Partial<AuthorizeParams> {
  acrValues?: string | string[];
  redirectUri?: string;
};

export type SilentAuthorizeParams = Partial<Omit<AuthorizeParams, 'prompt' | 'pkce'>> & {timeout?: number};

export interface PopupAuthorizeParams extends Partial<AuthorizeParams> {
  acrValues?: string | string[];
  redirectUri?: string;
  width?: number;
  height?: number;
  backdrop?: boolean;
};

export interface AuthorizeResponsiveParams {
  [key: string]: AuthorizeParams | PopupAuthorizeParams
}
