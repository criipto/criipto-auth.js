import {describe, test, expect} from '@jest/globals';
import { AuthorizeUrlParamsOptional, Prompt } from '../src/types';
import {parseQueryParams, parseAuthorizeParamsFromUrl} from '../src/util';

describe('parseQueryParams', () => {
  test('parses empty', () => {
    expect(parseQueryParams('')).toStrictEqual({});
  });

  test('parses id_token fragment', () => {
    expect(parseQueryParams('#id_token=eyJ0eXAiOiJKV1QiLCJhbGci')).toStrictEqual({
      id_token: 'eyJ0eXAiOiJKV1QiLCJhbGci'
    });
  });

  test('parses code fragment', () => {
    expect(parseQueryParams('#code=ga8sdjzxcjasdasd')).toStrictEqual({
      code: 'ga8sdjzxcjasdasd'
    });
  });

  test('parses code querystring param', () => {
    expect(parseQueryParams('?code=123as9d8asdasd9asdasd')).toStrictEqual({
      code: '123as9d8asdasd9asdasd'
    });
  });

  test('parses id_token querystring param', () => {
    expect(parseQueryParams('?id_token=NHAPY4YFDRYcJ9yTouFkImBWXOR2scUBDeS')).toStrictEqual({
      id_token: 'NHAPY4YFDRYcJ9yTouFkImBWXOR2scUBDeS'
    });
  });
});

describe('parseAuthorizeParamsFromUrl', function () {
  test('parses url', () => {
    const expected : AuthorizeUrlParamsOptional & {domain: string, clientID: string} = {
      domain: 'mick-gauss-mitid-test.criipto.io',
      clientID: 'urn:application:example',
      redirectUri: 'https://jwt.io/',
      scope: 'openid',
      responseType: 'id_token',
      responseMode: 'fragment',
      nonce: 'ecnon',
      state: undefined,
      uiLocales: undefined,
      pkce: undefined,
      prompt: undefined as Prompt,
      loginHint: undefined,
      acrValues: undefined
    };

    expect(
      parseAuthorizeParamsFromUrl('https://mick-gauss-mitid-test.criipto.io/oauth2/authorize?client_id=urn:application:example&redirect_uri=https://jwt.io/&scope=openid&response_type=id_token&response_mode=fragment&nonce=ecnon')
    ).toStrictEqual(expected);
  });
});