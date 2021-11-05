import {PKCE} from './pkce';

export type GenericObject = { [key: string]: any };

export interface AuthorizeUrlParams {
  acrValues?: string;
  redirectUri: string;
  responseType: string;
  responseMode: string;
  pkce?: PKCE;
  state?: string;
};

export interface AuthorizeUrlParamsOptional {
  acrValues?: string;
  redirectUri?: string;
  responseType?: string;
  responseMode?: string;
  pkce?: PKCE;
  state?: string
};

export interface AuthorizeResponse extends GenericObject {
  code?: string;
  id_token?: string;
  error?: string;
  state?: string
};

export const ALL_VIA = ['redirect', 'popup'] as const; // TS 3.4
type ViaTuple = typeof ALL_VIA;
type Via = ViaTuple[number];

export interface AuthorizeParams extends Partial<AuthorizeUrlParams> {
  via: Via,
  acrValues?: string;
  redirectUri?: string;
  responseType?: string;
  responseMode?: string;
}

export interface RedirectAuthorizeParams extends Partial<AuthorizeParams> {
  acrValues?: string;
  redirectUri?: string;
};

export interface PopupAuthorizeParams extends Partial<AuthorizeParams> {
  acrValues?: string;
  redirectUri?: string;
  width?: number;
  height?: number;
};

export interface AuthorizeResponsiveParams {
  [key: string]: AuthorizeParams | PopupAuthorizeParams
}