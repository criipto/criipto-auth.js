import {describe, beforeEach, it, expect, jest} from '@jest/globals';
import * as crypto from 'crypto';
import {MemoryStore} from './helper';
import {generate as generatePKCE} from '../src/pkce';
import CriiptoAuth from '../src/index';
import CriiptoAuthPopup from '../src/Popup';
import {CRIIPTO_POPUP_ID, CRIIPTO_POPUP_BACKDROP_ID, CRIIPTO_AUTHORIZE_RESPONSE} from '../src/util';

describe('CriiptoAuthPopup', () => {
  let auth:CriiptoAuth, popup:CriiptoAuthPopup, windowAddEventListener = jest.fn(), windowClose = jest.fn();

  beforeEach(() => {
    auth = new CriiptoAuth({
      domain: Math.random().toString(),
      clientID: Math.random().toString(),
      store: new MemoryStore()
    });

    popup = new CriiptoAuthPopup(auth);

    jest.spyOn(popup.backdrop, 'render');
    jest.spyOn(popup.backdrop, 'remove');

    windowAddEventListener = jest.fn();
    windowClose = jest.fn();
    Object.defineProperty(global, 'window', {
      writable: true,
      value: {
        addEventListener: windowAddEventListener,
        removeEventListener: jest.fn(),
        close: windowClose,
        crypto: {
          getRandomValues: (arr : any) => crypto.randomBytes(arr.length),
          subtle: {
            digest: (algo : string, value : Uint8Array) => {
              const hash = crypto.createHash('sha256');
              hash.update(value);

              return hash.digest('hex');
            }
          }
        },
        btoa: (input : string) => Buffer.from(input).toString('base64'),
        screenLeft: 0,
        screenTop: 0,
        innerWidth: 1000,
        innerHeight: 1000,
        screen: {
          availWidth: 1000
        }
      }
    });

    Object.defineProperty(global, 'document', {
      writable: true,
      value: {}
    });

    Object.defineProperty(global.document, 'body', {
      writable: true,
      value: {
        appendChild: jest.fn(),
        removeChild: jest.fn()
      }
    });

    (global.document.getElementById as any) = jest.fn().mockImplementation((id) => {
      if (id === CRIIPTO_POPUP_BACKDROP_ID) return null;
      return {
        addEventListener: jest.fn()
      };
    });
    (global.document.createElement as any) = jest.fn().mockImplementation(() => ({
      addEventListener: jest.fn()
    }));
  });

  describe('open', () => {
    it('builds authorize url and opens window', async () => {
      const authorizeUrl = Math.random().toString();
      const redirectUri =  Math.random().toString();
      const acrValues = 'urn:grn:authn:dk:nemid:poces';
      const createdWindow = {};

      (window.open as any) = jest.fn().mockImplementation(() => createdWindow);
      (auth.buildAuthorizeUrl as any) = jest.fn().mockImplementation(() => {
        return new Promise((resolve) => {
          resolve(authorizeUrl);
        });
      });

      const actual = await popup.open({
        redirectUri,
        acrValues
      });

      expect(actual).toBe(createdWindow);
      expect(popup.window).toBe(actual);
      expect(auth.buildAuthorizeUrl).toHaveBeenCalledWith({
        redirectUri,
        acrValues,
        responseMode: 'query',
        responseType: 'code',
        scope: 'openid',
        pkce: expect.any(Object)
      });
      expect(auth.buildAuthorizeUrl).toHaveBeenCalledTimes(1);
      expect(window.open).toHaveBeenCalledTimes(1);
      expect(window.open).toHaveBeenCalledWith(authorizeUrl, CRIIPTO_POPUP_ID, `width=330,height=600,top=200,left=335`);
    });
  });

  describe('authorize', () => {
    let createdWindow: Window;

    beforeEach(() => {
      createdWindow = {} as Window;
      (popup.open as any) = jest.fn().mockImplementation(() => Promise.resolve());
      popup.window = createdWindow;
    });

    it('opens popup and receives success message from popup window', async () => {
      const id_token = Math.random().toString();
      const params = {
        redirectUri: Math.random().toString(),
        acrValues: 'urn:grn:authn:dk:nemid:poces'
      };
      const messageEvent = {
        source: createdWindow,
        data: CRIIPTO_AUTHORIZE_RESPONSE+JSON.stringify({
          id_token
        })
      };

      const authorizePromise = popup.authorize(params);
      expect(popup.backdrop.render).toHaveBeenCalledTimes(1);
      expect(popup.open).toHaveBeenCalledTimes(1);
      expect(popup.open).toHaveBeenCalledWith(params);
      expect(popup._latestParams).toBe(params); 

      await Promise.resolve(); // Wait for a promise cycle
      const messageEventListener = windowAddEventListener.mock.calls.find(listener => listener[0] === 'message') as any;
      expect(messageEventListener).toBeDefined();

      // An ignored event, not prefixed correctly
      messageEventListener[1]({
        source: createdWindow,
        data: Math.random().toString()
      });

      messageEventListener[1](messageEvent);
      const result = await authorizePromise;
      expect(result.id_token).toBe(id_token);

      
      expect(popup.backdrop.remove).toHaveBeenCalledTimes(1);
    });

    it('opens popup and does PKCE token exchange', async () => {
      const metadata = {
        token_endpoint: Math.random().toString()
      };
      const id_token = Math.random().toString();

      (window.fetch as any) = jest.fn<Promise<any>, string[]>().mockImplementation(async (url : string) => {
        if (url.includes('.well-known/openid-configuration')) {
          return {
            json: () => Promise.resolve(metadata)
          };
        }
        if (url === metadata.token_endpoint) {
          return {
            json: () => Promise.resolve({id_token})
          };
        }
        throw new Error('Unexpected url');
      });

      const code = Math.random().toString();
      const params = {
        redirectUri: Math.random().toString(),
        acrValues: 'urn:grn:authn:dk:nemid:poces'
      };
      const messageEvent = {
        source: createdWindow,
        data: CRIIPTO_AUTHORIZE_RESPONSE+JSON.stringify({
          code
        })
      };

      const pkce = await auth.generatePKCE(params.redirectUri);

      const authorizePromise = popup.authorize(params);
      expect(popup.open).toHaveBeenCalledTimes(1);
      expect(popup.open).toHaveBeenCalledWith(params);
      expect(popup._latestParams).toBe(params); 

      await Promise.resolve(); // Wait for a promise cycle
      const messageEventListener = windowAddEventListener.mock.calls.find(listener => listener[0] === 'message') as any;
      expect(messageEventListener).toBeDefined();

      // An ignored event, not prefixed correctly
      messageEventListener[1]({
        source: createdWindow,
        data: Math.random().toString()
      });

      messageEventListener[1](messageEvent);
      const result = await authorizePromise;
      expect(result.id_token).toBe(id_token);

      const fetchCall = (window.fetch as any).mock.calls.find(([url] : string[]) => url === metadata.token_endpoint);
      expect(fetchCall[1].body).toContain(`code_verifier=${pkce.code_verifier}`);
    });

    it('allows disabling backdrop', async () => {
      const params = {
        redirectUri: Math.random().toString(),
        acrValues: 'urn:grn:authn:dk:nemid:poces',
        backdrop: false
      };

      popup.authorize(params);
      expect(popup.backdrop.render).toHaveBeenCalledTimes(0);
    });

    it('receives error message from popup window', async () => {
      const error = Math.random().toString();
      const messageEvent = {
        source: createdWindow,
        data: CRIIPTO_AUTHORIZE_RESPONSE+JSON.stringify({
          error
        })
      };

      const authorizePromise = popup.authorize({
        redirectUri: Math.random().toString(),
        acrValues: 'urn:grn:authn:dk:nemid:poces'
      });

      await Promise.resolve(); // Wait for a promise cycle
      const messageEventListener = windowAddEventListener.mock.calls.find(listener => listener[0] === 'message') as any;

      // An ignored event, not correct osurce
      messageEventListener[1]({
        source: {},
        data: Math.random().toString()
      });

      messageEventListener[1](messageEvent);
      expect.assertions(1);
      await authorizePromise.catch(err => {
        expect(err).toBe(error);
      });
    });
  });

  describe('close', () => {
    it('closes the window opened by open', async () => {
      const createdWindow = {
        close: jest.fn()
      };
      (window.open as any) = jest.fn().mockImplementation(() => createdWindow);
      (auth.buildAuthorizeUrl as any) = jest.fn().mockImplementation(() => {
        return new Promise((resolve) => {
          resolve(Math.random().toString());
        });
      });
      await popup.open({
        redirectUri: Math.random().toString(),
        acrValues: Math.random().toString(),
      });

      popup.close();

      expect(createdWindow.close).toHaveBeenCalledTimes(1);
    });
  });

  describe('callback', () => {
    it('parses params from location and messages back to opener', () => {
      (window as any).opener = {
        postMessage: jest.fn()
      };

      const code = Math.random().toString();
      const id_token = Math.random().toString();

      // code/query
      windowClose.mockClear();
      (window.opener.postMessage as any).mockClear();
      window.location = {
        ...window.location,
        hash: '',
        search: `?code=${code}`,
        origin: Math.random().toString()
      };
      popup.callback(window.location.origin);
      expect(window.opener.postMessage).toHaveBeenCalledTimes(1);
      expect(window.opener.postMessage).toHaveBeenCalledWith(CRIIPTO_AUTHORIZE_RESPONSE+JSON.stringify({
        code
      }), window.location.origin);
      expect(windowClose).toHaveBeenCalledTimes(1);

      // id_token/fragment
      windowClose.mockClear();
      (window.opener.postMessage as any).mockClear();
      window.location = {
        ...window.location,
        hash: `#id_token=${id_token}`,
        search: '',
        origin: Math.random().toString()
      };
      popup.callback(window.location.origin);
      expect(window.opener.postMessage).toHaveBeenCalledTimes(1);
      expect(window.opener.postMessage).toHaveBeenCalledWith(CRIIPTO_AUTHORIZE_RESPONSE+JSON.stringify({
        id_token
      }), window.location.origin);
      expect(windowClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('CriiptoAuthPopupBackdrop', () => {
    describe('handleOpen', () => {
      it('reopens popup with last known params', () => {
        const params = {
          redirectUri: Math.random().toString(),
          acrValues: 'urn:grn:authn:dk:nemid:poces'
        };
        popup._latestParams = params;
        popup.open = jest.fn();

        popup.backdrop.handleOpen();
        
        expect(popup.open).toHaveBeenCalledTimes(1);
        expect(popup.open).toHaveBeenCalledWith(params);
      });
    });

    describe('handleCancel', () => {
      it('tells popup to close', () => {
        popup.close = jest.fn();

        popup.backdrop.handleCancel();
        
        expect(popup.close).toHaveBeenCalledTimes(1);
      });
    });
  });
});
