import {describe, beforeEach, it, expect, jest} from '@jest/globals';
import {AuthorizeUrlParams, ResponseType} from '../src/types';
import CriiptoAuth from '../src/index';
import OpenIDConfiguration from '../src/OpenIDConfiguration';
import { MemoryStore } from './helper';

jest.mock('../src/OpenIDConfiguration');

const mockedOpenID = jest.mocked(OpenIDConfiguration, true);

describe('CriiptoAuth', () => {
  let domain:string, clientID:string, auth:CriiptoAuth;

  beforeEach(() => {
    mockedOpenID.mockClear();

    domain = Math.random().toString();
    clientID = Math.random().toString();

    auth = new CriiptoAuth({
      domain,
      clientID,
      store: new MemoryStore()
    });

    Object.defineProperty(global, 'window', {
      writable: true,
      value: {}
    });
  });

  describe('constructor', () => {
    it('throws if domain is not provided', () => {
      expect(() => new CriiptoAuth({clientID, domain: undefined as any, store: new MemoryStore()})).toThrow('new criipto.Auth({domain, clientID, store}) required');
    });

    it('throws if domain is not provided', () => {
      expect(() => new CriiptoAuth({clientID: undefined as any, domain, store: new MemoryStore()})).toThrow('new criipto.Auth({domain, clientID, store}) required');
    });

    it('throws if store is not provided', () => {
      expect(() => new CriiptoAuth({clientID, domain, store: undefined as any})).toThrow('new criipto.Auth({domain, clientID, store}) required');
    });
  })

  describe('_setup', () => {
    beforeEach(() => {
      const fetchMetadataMock:jest.Mock = mockedOpenID.mock.instances[0].fetchMetadata as jest.Mock;
      fetchMetadataMock.mockImplementation(() => Promise.resolve({
        issuer: 'https://example.com',
        jwks_uri: 'https://example.com',
      }));
    });

    it('tells OpenIDConfiguration to fetch metadata', async () => {
      await auth._setup();
      await auth._setup(); // Test cache

      expect(mockedOpenID).toHaveBeenCalledWith(`https://${domain}`, clientID);
      expect(mockedOpenID.mock.instances[0].fetchMetadata).toHaveBeenCalledTimes(1);
    });
  });

  describe('authorizeResponsive', () => {
    let matchMediaMock = jest.fn(), popupAuthorizeMock = jest.fn(), redirectAuthorizeMock = jest.fn();

    beforeEach(() => {
      (window.matchMedia as any) = matchMediaMock = jest.fn();
      (auth.popup.authorize as any) = popupAuthorizeMock = jest.fn();
      (auth.redirect.authorize as any)= redirectAuthorizeMock = jest.fn();
    });

    it('maps to popup', async () => {
      matchMediaMock.mockImplementation((query):{matches: boolean} => {
        if (query === '(min-width: 300px)') return {matches: true};
        return {matches: false};
      });

      const params = {
        redirectUri: Math.random().toString(),
        acrValues: Math.random().toString()
      };

      await auth.authorizeResponsive({
        '(min-width: 3000px)': {
          via: 'redirect',
          ...params
        },
        '(min-width: 300px)': {
          via: 'popup',
          ...params
        }
      });

      expect(popupAuthorizeMock).toHaveBeenCalledTimes(1);
      expect(popupAuthorizeMock).toHaveBeenCalledWith(params);
      expect(redirectAuthorizeMock).toHaveBeenCalledTimes(0);
    });

    it('maps to redirect', async () => {
      matchMediaMock.mockImplementation((query):{matches: boolean} => {
        if (query === '(max-width: 700px)') return {matches: true};
        return {matches: false};
      });

      const params = {
        redirectUri: Math.random().toString(),
        acrValues: Math.random().toString()
      };

      await auth.authorizeResponsive({
        '(max-width: 700px)': {
          via: 'redirect',
          ...params
        },
        '(min-width: 701px)': {
          via: 'popup',
          ...params
        }
      });

      expect(redirectAuthorizeMock).toHaveBeenCalledTimes(1);
      expect(redirectAuthorizeMock).toHaveBeenCalledWith(params);
      expect(popupAuthorizeMock).toHaveBeenCalledTimes(0);
    });

    it('throws if no media queries match', () => {
      matchMediaMock.mockImplementation(():any => ({
        matches: false
      }));

      expect(() => {
        auth.authorizeResponsive({
          '(min-width: 30000px)': {
            via: 'redirect',
            redirectUri: Math.random().toString(),
            acrValues: Math.random().toString()
          }
        });
      }).toThrow('No media queries matched');
    });

    it('throws if media query match has an invalid via', () => {
      expect(() => {
        auth.authorizeResponsive({
          '(min-width: 100px)': {
            // @ts-ignore
            via: Math.random().toString(),
            redirectUri: Math.random().toString(),
            acrValues: Math.random().toString()
          }
        })
      }).toThrow('Unknown match.via');
    });
  });

  describe('buildAuthorizeUrl', () => {
    const values:AuthorizeUrlParams = {
      responseMode: Math.random().toString(),
      responseType: "id_token",
      redirectUri: Math.random().toString(),
      acrValues: Math.random().toString(),
      scope: Math.random().toString(),
      prompt: undefined,
      pkce: {
        code_challenge: Math.random().toString(),
        code_challenge_method: 'SHA-256',
        code_verifier: Math.random().toString()
      },
      extraUrlParams: {
        criipto_sdk: "test"
      }
    };

    const authorization_endpoint:string = `https://${domain}/authorize`;

    beforeEach(() => {
      (auth._setup as any) = jest.fn().mockImplementation(() => Promise.resolve());

      auth._openIdConfiguration = new OpenIDConfiguration(domain, clientID);
      auth._openIdConfiguration.authority = domain;
      auth._openIdConfiguration.issuer = `https://${domain}`;
      auth._openIdConfiguration.authorization_endpoint = authorization_endpoint;
      auth._openIdConfiguration.response_modes_supported = [values.responseMode];
      auth._openIdConfiguration.response_types_supported = [values.responseType];
      auth._openIdConfiguration.acr_values_supported = [values.acrValues as string];
    });

    it('throws an error if responseMode is not one of supported', async () => {
      auth._openIdConfiguration.response_modes_supported = [Math.random().toString()];

      expect.assertions(1);
      await auth.buildAuthorizeUrl({
        ...values,
        responseMode: Math.random().toString()
      }).catch(err => {
        expect(err.message).toMatch(`responseMode must be one of ${auth._openIdConfiguration.response_modes_supported.join(',')},json`);
      });
    });

    it('throws an error if responseType is not one of supported', async () => {
      auth._openIdConfiguration.response_types_supported = [Math.random().toString()];

      expect.assertions(1);
      await auth.buildAuthorizeUrl({
        ...values,
        responseType: "id_token"
      }).catch(err => {
        expect(err.message).toMatch(`responseType must be one of ${auth._openIdConfiguration.response_types_supported.join(',')}`);
      });
    });

    it('throws an error if redirectUri is not defined', async () => {
      expect.assertions(1);
      await auth.buildAuthorizeUrl({
        ...values,
        redirectUri: undefined as any
      }).catch(err => {
        expect(err.message).toMatch(`redirectUri must be defined`);
      });
    });

    it('builds without acr value', async () => {
      const actual = await auth.buildAuthorizeUrl({
        ...values,
        acrValues: undefined,
        extraUrlParams: {
          criipto_sdk: "test"
        }
      });

      expect(actual).toBe(`${authorization_endpoint}?scope=${values.scope}&client_id=${clientID}&redirect_uri=${encodeURIComponent(values.redirectUri)}&response_type=${values.responseType}&response_mode=${values.responseMode}&code_challenge=${values.pkce!.code_challenge}&code_challenge_method=${values.pkce!.code_challenge_method}&criipto_sdk=test`)
    });

    it('builds without criipto_sdk', async () => {
      const actual = await auth.buildAuthorizeUrl({
        ...values,
        acrValues: undefined,
        extraUrlParams: {
          criipto_sdk: null
        }
      });

      expect(actual).toBe(`${authorization_endpoint}?scope=${values.scope}&client_id=${clientID}&redirect_uri=${encodeURIComponent(values.redirectUri)}&response_type=${values.responseType}&response_mode=${values.responseMode}&code_challenge=${values.pkce!.code_challenge}&code_challenge_method=${values.pkce!.code_challenge_method}`)
    });

    it('builds with login_hint', async () => {
      const loginHint = Math.random().toString();
      const actual = await auth.buildAuthorizeUrl({
        ...values,
        acrValues: undefined,
        loginHint,
        extraUrlParams: {
          criipto_sdk: "test"
        }
      });

      expect(actual).toBe(`${authorization_endpoint}?scope=${values.scope}&client_id=${clientID}&redirect_uri=${encodeURIComponent(values.redirectUri)}&response_type=${values.responseType}&response_mode=${values.responseMode}&code_challenge=${values.pkce!.code_challenge}&code_challenge_method=${values.pkce!.code_challenge_method}&login_hint=${loginHint}&criipto_sdk=test`)
    });

    it('builds with prompt', async () => {
      const prompt = 'login';
      const actual = await auth.buildAuthorizeUrl({
        ...values,
        acrValues: undefined,
        prompt,
        extraUrlParams: {
          criipto_sdk: "test"
        }
      });

      expect(actual).toBe(`${authorization_endpoint}?scope=${values.scope}&client_id=${clientID}&redirect_uri=${encodeURIComponent(values.redirectUri)}&response_type=${values.responseType}&response_mode=${values.responseMode}&code_challenge=${values.pkce!.code_challenge}&code_challenge_method=${values.pkce!.code_challenge_method}&prompt=${prompt}&criipto_sdk=test`)
    });

    it('builds with ui_locales', async () => {
      const uiLocales = Math.random().toString();
      const actual = await auth.buildAuthorizeUrl({
        ...values,
        acrValues: undefined,
        uiLocales,
        extraUrlParams: {
          criipto_sdk: "test"
        }
      });

      expect(actual).toBe(`${authorization_endpoint}?scope=${values.scope}&client_id=${clientID}&redirect_uri=${encodeURIComponent(values.redirectUri)}&response_type=${values.responseType}&response_mode=${values.responseMode}&code_challenge=${values.pkce!.code_challenge}&code_challenge_method=${values.pkce!.code_challenge_method}&ui_locales=${uiLocales}&criipto_sdk=test`)
    });

    it('builds url with extra url parameters (random)', async () => {
      const key = Math.random().toString();
      const val = Math.random().toString();
      const extraUrlParams = {[key]: val, criipto_sdk: "test"};
      const actual = await auth.buildAuthorizeUrl({
        ...values,
        extraUrlParams
      });

      expect(actual).toBe(`${authorization_endpoint}?scope=${values.scope}&client_id=${clientID}&acr_values=${values.acrValues}&redirect_uri=${encodeURIComponent(values.redirectUri)}&response_type=${values.responseType}&response_mode=${values.responseMode}&code_challenge=${values.pkce!.code_challenge}&code_challenge_method=${values.pkce!.code_challenge_method}&${key}=${val}&criipto_sdk=test`);
    });

    it('builds url with extra url parameters', async () => {
      const extraUrlParams = {connection: 'my-connection', criipto_sdk: 'test'};
      const actual = await auth.buildAuthorizeUrl({
        ...values,
        extraUrlParams,
      });

      expect(actual).toBe(`${authorization_endpoint}?scope=${values.scope}&client_id=${clientID}&acr_values=${values.acrValues}&redirect_uri=${encodeURIComponent(values.redirectUri)}&response_type=${values.responseType}&response_mode=${values.responseMode}&code_challenge=${values.pkce!.code_challenge}&code_challenge_method=${values.pkce!.code_challenge_method}&connection=my-connection&criipto_sdk=test`);
    });

    it('builds with custom scope', async () => {
      const scope ='openid profile';
      const actual = await auth.buildAuthorizeUrl({
        ...values,
        scope: scope,
        extraUrlParams: {
          criipto_sdk: "test"
        }
      });

      expect(actual).toBe(`${authorization_endpoint}?scope=${scope.replace(/ /, "+")}&client_id=${clientID}&acr_values=${values.acrValues}&redirect_uri=${encodeURIComponent(values.redirectUri)}&response_type=${values.responseType}&response_mode=${values.responseMode}&code_challenge=${values.pkce!.code_challenge}&code_challenge_method=${values.pkce!.code_challenge_method}&criipto_sdk=test`);
    });

    it('builds with custom json response_mode', async () => {
      const actual = await auth.buildAuthorizeUrl({
        ...values,
        responseMode: 'json',
        extraUrlParams: {
          criipto_sdk: "test"
        }
      });

      expect(actual).toBe(`${authorization_endpoint}?scope=${values.scope}&client_id=${clientID}&acr_values=${values.acrValues}&redirect_uri=${encodeURIComponent(values.redirectUri)}&response_type=${values.responseType}&response_mode=json&code_challenge=${values.pkce!.code_challenge}&code_challenge_method=${values.pkce!.code_challenge_method}&criipto_sdk=test`);
    });

    it('builds url', async () => {
      const actual = await auth.buildAuthorizeUrl(values);

      expect(actual).toBe(`${authorization_endpoint}?scope=${values.scope}&client_id=${clientID}&acr_values=${values.acrValues}&redirect_uri=${encodeURIComponent(values.redirectUri)}&response_type=${values.responseType}&response_mode=${values.responseMode}&code_challenge=${values.pkce!.code_challenge}&code_challenge_method=${values.pkce!.code_challenge_method}&criipto_sdk=test`)
    });

    it('builds url with multiple acr values as array', async () => {
      auth._openIdConfiguration.acr_values_supported = ['urn:grn:authn:dk:mitid:low', 'urn:grn:authn:se:bankid:another-device:qr'];

      const actual = await auth.buildAuthorizeUrl({
        ...values,
        acrValues: ['urn:grn:authn:dk:mitid:low', 'urn:grn:authn:se:bankid:another-device:qr'],
      });

      expect(actual).toBe(`${authorization_endpoint}?scope=${values.scope}&client_id=${clientID}&acr_values=${encodeURIComponent('urn:grn:authn:dk:mitid:low urn:grn:authn:se:bankid:another-device:qr').replace("%20", "+")}&redirect_uri=${encodeURIComponent(values.redirectUri)}&response_type=${values.responseType}&response_mode=${values.responseMode}&code_challenge=${values.pkce!.code_challenge}&code_challenge_method=${values.pkce!.code_challenge_method}&criipto_sdk=test`)
    });

    it('builds url with multiple acr values as space seperated', async () => {
      auth._openIdConfiguration.acr_values_supported = ['urn:grn:authn:dk:mitid:low', 'urn:grn:authn:se:bankid:another-device:qr'];

      const actual = await auth.buildAuthorizeUrl({
        ...values,
        acrValues: 'urn:grn:authn:dk:mitid:low urn:grn:authn:se:bankid:another-device:qr'
      });

      expect(actual).toBe(`${authorization_endpoint}?scope=${values.scope}&client_id=${clientID}&acr_values=${encodeURIComponent('urn:grn:authn:dk:mitid:low urn:grn:authn:se:bankid:another-device:qr').replace("%20", "+")}&redirect_uri=${encodeURIComponent(values.redirectUri)}&response_type=${values.responseType}&response_mode=${values.responseMode}&code_challenge=${values.pkce!.code_challenge}&code_challenge_method=${values.pkce!.code_challenge_method}&criipto_sdk=test`)
    });
  });

  describe('buildAuthorizeParams', () => {
    it('uses values provided to constructor', () => {
      const params = {
        acrValues: Math.random().toString(),
        redirectUri: Math.random().toString(),
        responseType: 'id_token' as ResponseType,
        scope: Math.random().toString()
      };

      auth = new CriiptoAuth({
        domain,
        clientID,
        store: new MemoryStore(),
        ...params
      });

      const actual = auth.buildAuthorizeParams({

      });

      expect(actual).toStrictEqual({...params, responseMode: "query", pkce: undefined, state: undefined, loginHint: undefined, uiLocales: undefined, extraUrlParams: undefined, prompt: undefined, nonce: undefined});
    });

    it('throws an error if redirectUri is not defined', () => {
      expect(() => auth.buildAuthorizeParams({
        acrValues: Math.random().toString(),
        redirectUri: undefined,
        pkce: {
          code_challenge: Math.random().toString(),
          code_challenge_method: 'SHA-256',
          code_verifier: Math.random().toString()
        }
      })).toThrow('redirectUri must be defined');
    });
  });
});
