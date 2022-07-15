import type {AuthorizeResponse, AuthorizeUrlParamsOptional, Prompt} from './types';

type GenericObject = { [key: string]: any };

export function parseQueryParams(input:string): GenericObject {
  if (!input || !input.length) return {};
  if (input.startsWith('?') || input.startsWith('#')) input = input.replace(/^(\?|\#)/, '');

  const memo:GenericObject = {};
  return input.split('&').reduce((memo:GenericObject, segment:string) => {
    const segments:string[] = segment.split('=');
  
    memo[segments[0]] = decodeURIComponent(segments[1]);
    return memo;
  }, memo);  
}

export function parseAuthorizeParamsFromUrl(input: string) : AuthorizeUrlParamsOptional & {domain: string, clientID: string} {
  const url = new URL(input);

  return {
    domain: url.host,
    clientID: url.searchParams.get('client_id')!,
    acrValues: url.searchParams.get('acr_values')?.split(' ') ?? undefined,
    redirectUri: url.searchParams.get('redirect_uri') ?? undefined,
    responseType: url.searchParams.get('response_type') ?? undefined,
    responseMode: url.searchParams.get('response_mode') ?? undefined,
    pkce: url.searchParams.get('code_challenge') ? {
      code_challenge: url.searchParams.get('code_challenge')!,
      code_challenge_method: url.searchParams.get('code_challenge_method')!
    } : undefined,
    state: url.searchParams.get('state') ?? undefined,
    loginHint: url.searchParams.get('login_hint') ?? undefined,
    uiLocales: url.searchParams.get('ui_locales') ?? undefined,
    scope: url.searchParams.get('scope') ?? undefined,
    nonce: url.searchParams.get('nonce') ?? undefined,
    prompt: (url.searchParams.get('prompt') ?? undefined) as Prompt
  };
}

export function parseQueryParamsFromLocation(location: Location): GenericObject {
  return {
    ...parseQueryParams(location.search),
    ...parseQueryParams(location.hash)
  };
}

export function parseAuthorizeResponseFromLocation(location: Location): AuthorizeResponse {
  return parseQueryParamsFromLocation(location);
}

export function parseAuthorizeResponseFromUrl(input: string): AuthorizeResponse {
  const url = new URL(input);
  return parseQueryParams(url.search);
}

export const CRIIPTO_AUTHORIZE_RESPONSE = 'CRIIPTO_AUTHORIZE_RESPONSE';
export const CRIIPTO_POPUP_ID = 'CRIIPTO_POPUP_ID';
export const CRIIPTO_POPUP_BACKDROP_ID = 'criipto_popup_backdrop';
export const CRIIPTO_POPUP_BACKDROP_BUTTON_OPEN_ID = 'criipto_popup_backdrop_button_open';
export const CRIIPTO_POPUP_BACKDROP_BUTTON_CLOSE_ID = 'criipto_popup_backdrop_button_close';