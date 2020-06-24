import type {AuthorizeResponse} from './types';

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

export function parseQueryParamsFromLocation(location: Location): GenericObject {
  return {
    ...parseQueryParams(location.search),
    ...parseQueryParams(location.hash)
  };
}

export function parseAuthorizeResponseFromLocation(location: Location): AuthorizeResponse {
  return parseQueryParamsFromLocation(location);
}

export const CRIIPTO_AUTHORIZE_RESPONSE = 'CRIIPTO_AUTHORIZE_RESPONSE';
export const CRIIPTO_POPUP_ID = 'CRIIPTO_POPUP_ID';
export const CRIIPTO_POPUP_BACKDROP_ID = 'criipto_popup_backdrop';
export const CRIIPTO_POPUP_BACKDROP_BUTTON_OPEN_ID = 'criipto_popup_backdrop_button_open';
export const CRIIPTO_POPUP_BACKDROP_BUTTON_CLOSE_ID = 'criipto_popup_backdrop_button_close';