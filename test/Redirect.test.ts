import CriiptoAuth from '../src/Auth';
import CriiptoAuthRedirect from '../src/Redirect';

describe('CriiptoAuthRedirect', () => {
  let auth:CriiptoAuth, redirect:CriiptoAuthRedirect;

  beforeEach(() => {
    auth = new CriiptoAuth({
      domain: Math.random().toString(),
      clientID: Math.random().toString()
    });

    redirect = new CriiptoAuthRedirect(auth);

    Object.defineProperty(global, 'window', {
      writable: true,
      value: {}
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

      auth.buildAuthorizeUrl = jest.fn().mockImplementation(() => {
        return new Promise((resolve) => {
          resolve(authorizeUrl);
        });
      });

      await redirect.authorize({
        redirectUri,
        acrValues,
        responseMode: undefined,
        responseType: undefined
      });

      expect(auth.buildAuthorizeUrl).toHaveBeenCalledWith({
        redirectUri,
        acrValues,
        responseMode: 'query',
        responseType: 'code'
      });
      expect(auth.buildAuthorizeUrl).toHaveBeenCalledTimes(1);
      expect(window.location.href).toBe(authorizeUrl);
    });

    it('builds authorize url with custom response mode/type', async () => {
      const authorizeUrl = Math.random().toString();
      const redirectUri =  Math.random().toString();
      const responseMode = 'id_token';
      const responseType = 'fragment';
      const acrValues = 'urn:grn:authn:dk:nemid:poces';

      auth.buildAuthorizeUrl = jest.fn().mockImplementation(() => {
        return new Promise((resolve) => {
          resolve(authorizeUrl);
        });
      });

      await redirect.authorize({
        redirectUri,
        acrValues,
        responseMode,
        responseType
      });

      expect(auth.buildAuthorizeUrl).toHaveBeenCalledWith({
        redirectUri,
        acrValues,
        responseMode,
        responseType
      });
      expect(auth.buildAuthorizeUrl).toHaveBeenCalledTimes(1);
      expect(window.location.href).toBe(authorizeUrl);
    });
  });

  describe('match', () => {
    it('returns auth response if we are currently on a redirect end uri', () => {
      const code = Math.random().toString();
      const id_token = Math.random().toString();

      window.location = {
        ...window.location,
        hash: undefined,
        search: `?code=${code}`
      };
      expect(redirect.match().code).toBe(code);

      window.location = {
        ...window.location,
        hash: undefined,
        search: `?id_token=${id_token}`
      };
      expect(redirect.match().id_token).toBe(id_token);

      window.location = {
        ...window.location,
        search: undefined,
        hash: `#code=${code}`
      };
      expect(redirect.match().code).toBe(code);

      window.location = {
        ...window.location,
        search: undefined,
        hash: `#id_token=${id_token}`
      };
      expect(redirect.match().id_token).toBe(id_token);
    });

    it('returns null', () => {
      expect(redirect.match()).toBe(null);
    });
  });
});