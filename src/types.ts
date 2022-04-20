import {PKCE} from './pkce';

export type GenericObject = { [key: string]: any };

export type Prompt = undefined | 'none' | 'login';

export interface AuthorizeUrlParams {
  acrValues?: string | string[];
  redirectUri: string;
  responseType: string;
  responseMode: string;
  pkce?: PKCE;
  state?: string;
  loginHint?: string;
  uiLocales?: string;
  extraUrlParams?: {[key: string]: string};
  scope: string;
  prompt?: Prompt;
};

export interface AuthorizeUrlParamsOptional {
  acrValues?: string | string[];
  redirectUri?: string;
  responseType?: string;
  responseMode?: string;
  pkce?: PKCE;
  state?: string
  loginHint?: string;
  uiLocales?: string;
  extraUrlParams?: {[key: string]: string};
  scope?: string;
  prompt?: Prompt;
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

export interface AuthorizeParams extends Partial<AuthorizeUrlParams> {
  via: Via,
  acrValues?: string | string[];
  redirectUri?: string;
  responseType?: string;
  responseMode?: string;
}

export interface RedirectAuthorizeParams extends Partial<AuthorizeParams> {
  acrValues?: string | string[];
  redirectUri?: string;
};

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
