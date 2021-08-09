import { mocked } from 'ts-jest/utils';
import {AuthorizeUrlParams} from '../src/types';
import CriiptoAuth from '../src/index';
import OpenIDConfiguration from '../src/OpenID';
import CriiptoAuthRedirect from '../src/Redirect';
import { MemoryStore } from './helper';

jest.mock('../src/OpenID');

const mockedOpenID = mocked(OpenIDConfiguration, true);

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
      expect(() => new CriiptoAuth({clientID, domain: undefined, store: new MemoryStore()})).toThrow('new criipto.Auth({domain, clientID, store}) required');
    });

    it('throws if domain is not provided', () => {
      expect(() => new CriiptoAuth({clientID: undefined, domain, store: new MemoryStore()})).toThrow('new criipto.Auth({domain, clientID, store}) required');
    });

    it('throws if store is not provided', () => {
      expect(() => new CriiptoAuth({clientID, domain, store: undefined})).toThrow('new criipto.Auth({domain, clientID, store}) required');
    });
  })

  describe('_setup', () => {
    beforeEach(() => {
      const fetchMetadataMock:jest.Mock = mockedOpenID.mock.instances[0].fetchMetadata as jest.Mock;
      fetchMetadataMock.mockImplementation(() => Promise.resolve());
    });

    it('tells OpenIDConfiguration to fetch metadata', async () => {
      await auth._setup();
      await auth._setup(); // Test cache

      expect(mockedOpenID).toHaveBeenCalledWith(`https://${domain}`);
      expect(mockedOpenID.mock.instances[0].fetchMetadata).toHaveBeenCalledTimes(1);
    });
  });

  describe('authorizeResponsive', () => {
    let matchMediaMock: jest.Mock, popupAuthorizeMock: jest.Mock, redirectAuthorizeMock: jest.Mock;

    beforeEach(() => {
      window.matchMedia = matchMediaMock = jest.fn();

      auth.popup.authorize = popupAuthorizeMock = jest.fn();
      auth.redirect.authorize = redirectAuthorizeMock = jest.fn();
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
      responseType: Math.random().toString(),
      redirectUri: Math.random().toString(),
      acrValues: Math.random().toString(),
      pkce: {
        code_challenge: Math.random().toString(),
        code_challenge_method: 'SHA-256',
        code_verifier: Math.random().toString()
      }
    };

    const authorization_endpoint:string = `https://${domain}/authorize`;

    beforeEach(() => {
      auth._setup = jest.fn().mockImplementation(() => Promise.resolve());

      auth._openIdConfiguration = new OpenIDConfiguration(domain);
      auth._openIdConfiguration.authority = domain;
      auth._openIdConfiguration.authorization_endpoint = authorization_endpoint;
      auth._openIdConfiguration.response_modes_supported = [values.responseMode];
      auth._openIdConfiguration.response_types_supported = [values.responseType];
      auth._openIdConfiguration.acr_values_supported = [values.acrValues];
    });

    it('throws an error if responseMode is not one of supported', async () => {
      auth._openIdConfiguration.response_modes_supported = [Math.random().toString()];

      expect.assertions(1);
      await auth.buildAuthorizeUrl({
        ...values,
        responseMode: Math.random().toString()
      }).catch(err => {
        expect(err.message).toMatch(`responseMode must be one of ${auth._openIdConfiguration.response_modes_supported.join(',')}`);
      });
    });

    it('throws an error if responseType is not one of supported', async () => {
      auth._openIdConfiguration.response_types_supported = [Math.random().toString()];

      expect.assertions(1);
      await auth.buildAuthorizeUrl({
        ...values,
        responseType: Math.random().toString()
      }).catch(err => {
        expect(err.message).toMatch(`responseType must be one of ${auth._openIdConfiguration.response_types_supported.join(',')}`);
      });
    });

    it('throws an error if acrValues is not one of supported', async () => {
      auth._openIdConfiguration.acr_values_supported = [Math.random().toString()];

      expect.assertions(1);
      await auth.buildAuthorizeUrl({
        ...values,
        acrValues: Math.random().toString()
      }).catch(err => {
        expect(err.message).toMatch(`acrValues must be one of ${auth._openIdConfiguration.acr_values_supported.join(',')}`);
      });
    });

    it('throws an error if redirectUri is not defined', async () => {
      expect.assertions(1);
      await auth.buildAuthorizeUrl({
        ...values,
        redirectUri: undefined
      }).catch(err => {
        expect(err.message).toMatch(`redirectUri must be defined`);
      });
    });

    it('builds url', async () => {
      const actual = await auth.buildAuthorizeUrl(values);

      expect(actual).toBe(`${authorization_endpoint}?scope=openid&client_id=${clientID}&acr_values=${values.acrValues}&redirect_uri=${encodeURIComponent(values.redirectUri)}&response_type=${values.responseType}&response_mode=${values.responseMode}&code_challenge=${values.pkce.code_challenge}&code_challenge_method=${values.pkce.code_challenge_method}`)
    });
  });

  describe('buildAuthorizeParams', () => {
    it('uses values provided to constructor', () => {
      const params = {
        acrValues: Math.random().toString(),
        redirectUri: Math.random().toString(),
        responseMode: 'fragment',
        responseType: 'id_token'
      };

      auth = new CriiptoAuth({
        domain,
        clientID,
        store: new MemoryStore(),
        ...params
      });

      const actual = auth.buildAuthorizeParams({

      });

      expect(actual).toStrictEqual({...params, pkce: undefined});
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

    it('throws an error if acrValues is not defined', () => {
      expect(() => auth.buildAuthorizeParams({
        acrValues: undefined,
        redirectUri: Math.random().toString(),
        pkce: {
          code_challenge: Math.random().toString(),
          code_challenge_method: 'SHA-256',
          code_verifier: Math.random().toString()
        }
      })).toThrow('acrValues must be defined');
    });
  });
});
