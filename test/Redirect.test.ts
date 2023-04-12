import {describe, beforeEach, it, expect, jest} from '@jest/globals';
import * as crypto from 'crypto';
import {MemoryStore} from './helper';
import CriiptoAuth, { generatePKCE, OAuth2Error, savePKCEState } from '../src/index';
import CriiptoAuthRedirect from '../src/Redirect';

describe('CriiptoAuthRedirect', () => {
  let auth:CriiptoAuth, redirect:CriiptoAuthRedirect;

  beforeEach(() => {
    auth = new CriiptoAuth({
      domain: Math.random().toString(),
      clientID: Math.random().toString(),
      store: new MemoryStore()
    });

    redirect = new CriiptoAuthRedirect(auth);

    Object.defineProperty(global, 'window', {
      writable: true,
      value: {
        btoa: (input : string) => Buffer.from(input).toString('base64')
      }
    });
    Object.defineProperty(window, 'location', {
      writable: true,
      value: {}
    });
  });

  describe('authorize', () => {
    it('builds authorize url and redirects browser', async () => {
      const authorizeUrl = Math.random().toString();
      const redirectUri =  Math.random().toString();
      const acrValues = 'urn:grn:authn:dk:nemid:poces';

      (auth.buildAuthorizeUrl as any) = jest.fn().mockImplementation(() => {
        return new Promise((resolve) => {
          resolve(authorizeUrl);
        });
      });

      await redirect.authorize({
        redirectUri,
        acrValues
      });

      expect(auth.buildAuthorizeUrl).toHaveBeenCalledWith({
        redirectUri,
        acrValues,
        responseMode: 'query',
        responseType: 'code',
        pkce: expect.any(Object),
        scope: 'openid'
      });
      expect(auth.buildAuthorizeUrl).toHaveBeenCalledTimes(1);
      expect(window.location.href).toBe(authorizeUrl);
    });

    it('builds authorize url with existing PKCE values', async () => {
      const authorizeUrl = Math.random().toString();
      const redirectUri =  Math.random().toString();
      const acrValues = 'urn:grn:authn:dk:nemid:poces';
      const pkce = await generatePKCE();

      (auth.buildAuthorizeUrl as any) = jest.fn().mockImplementation(() => {
        return new Promise((resolve) => {
          resolve(authorizeUrl);
        });
      });

      await redirect.authorize({
        redirectUri,
        acrValues,
        pkce
      });

      expect(auth.buildAuthorizeUrl).toHaveBeenCalledWith({
        redirectUri,
        acrValues,
        responseMode: 'query',
        responseType: 'code',
        pkce,
        scope: 'openid'
      });
      expect(auth.buildAuthorizeUrl).toHaveBeenCalledTimes(1);
      expect(window.location.href).toBe(authorizeUrl);
    });
  });

  describe('match', () => {
    // it('returns auth response if we are currently on a redirect end uri', async () => {
    //   const code = Math.random().toString();
    //   const id_token = Math.random().toString();
    //   const state = Math.random().toString();
    //   let match;

    //   window.location = {
    //     ...window.location,
    //     hash: '',
    //     search: `?code=${code}`
    //   };

    //   auth.store.setItem('pkce_code_verifier', Math.random().toString());
    //   match = await redirect.match();
    //   expect(match?.code).toBe(code);

    //   window.location = {
    //     ...window.location,
    //     hash: '',
    //     search: `?code=${code}&state=${state}`
    //   };

    //   match = await redirect.match();
    //   expect(match?.code).toBe(code);
    //   expect(match?.state).toBe(state);

    //   window.location = {
    //     ...window.location,
    //     hash: '',
    //     search: `?id_token=${id_token}`
    //   };
    //   match = await redirect.match();
    //   expect(match?.id_token).toBe(id_token);

    //   window.location = {
    //     ...window.location,
    //     search: '',
    //     hash: `#code=${code}`
    //   };
    //   match = await redirect.match();
    //   expect(match?.code).toBe(code);

    //   window.location = {
    //     ...window.location,
    //     search: '',
    //     hash: `#id_token=${id_token}`
    //   };
    //   match = await redirect.match();
    //   expect(match?.id_token).toBe(id_token);
    // });

    it('returns null', async () => {
      const match = await redirect.match();
      expect(match).toBe(null);
    });

    it('rejects with error', async () => {
      const error = Math.random().toString();
      const error_description = Math.random().toString();

      window.location = {
        ...window.location,
        hash: '',
        search: `?error=${error}&error_description=${error_description}`
      };

      expect.assertions(1);

      savePKCEState(auth.store, {
        response_type: 'id_token',
        redirect_uri: Math.random().toString(),
        pkce_code_verifier: Math.random().toString(),
      });
      await redirect.match().catch(err => {
        expect(err).toStrictEqual(new OAuth2Error(error, error_description));
      });
    });
  });
});
