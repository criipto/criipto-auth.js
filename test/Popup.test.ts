import CriiptoAuth from '../src/Auth';
import CriiptoAuthPopup from '../src/Popup';
import {CRIIPTO_POPUP_ID, CRIIPTO_POPUP_BACKDROP_ID, CRIIPTO_AUTHORIZE_RESPONSE} from '../src/util';

describe('CriiptoAuthPopup', () => {
  let auth:CriiptoAuth, popup:CriiptoAuthPopup, windowAddEventListener: jest.Mock, windowClose: jest.Mock;

  beforeEach(() => {
    auth = new CriiptoAuth({
      domain: Math.random().toString(),
      clientID: Math.random().toString()
    });

    popup = new CriiptoAuthPopup(auth);

    windowAddEventListener = jest.fn();
    windowClose = jest.fn();
    Object.defineProperty(global, 'window', {
      writable: true,
      value: {
        addEventListener: windowAddEventListener,
        removeEventListener: jest.fn(),
        close: windowClose
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

    global.document.getElementById = jest.fn().mockImplementation((id) => {
      if (id === CRIIPTO_POPUP_BACKDROP_ID) return null;
      return {
        addEventListener: jest.fn()
      };
    });
    global.document.createElement = jest.fn().mockImplementation(() => ({
      addEventListener: jest.fn()
    }));
  });

  describe('open', () => {
    it('builds authorize url and opens window', async () => {
      const authorizeUrl = Math.random().toString();
      const redirectUri =  Math.random().toString();
      const acrValues = 'urn:grn:authn:dk:nemid:poces';
      const createdWindow = {};

      window.open = jest.fn().mockImplementation(() => createdWindow);
      auth.buildAuthorizeUrl = jest.fn().mockImplementation(() => {
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
        responseMode: 'fragment',
        responseType: 'id_token'
      });
      expect(auth.buildAuthorizeUrl).toHaveBeenCalledTimes(1);
      expect(window.open).toHaveBeenCalledTimes(1);
      expect(window.open).toHaveBeenCalledWith(authorizeUrl, CRIIPTO_POPUP_ID, `width=400,height=600`);
    });

    it('builds authorize url and opens window with custom args', async () => {
      const authorizeUrl = Math.random().toString();
      const redirectUri =  Math.random().toString();
      const acrValues = 'urn:grn:authn:dk:nemid:poces';
      const responseMode = 'code';
      const responseType = 'query';
      const createdWindow = {};
      const width = Math.ceil(Math.random() * 9000);
      const height = Math.ceil(Math.random() * 9000);

      window.open = jest.fn().mockImplementation(() => createdWindow);
      auth.buildAuthorizeUrl = jest.fn().mockImplementation(() => {
        return new Promise((resolve) => {
          resolve(authorizeUrl);
        });
      });

      const actual = await popup.open({
        redirectUri,
        acrValues,
        responseMode,
        responseType,
        width,
        height
      });

      expect(actual).toBe(createdWindow);
      expect(popup.window).toBe(actual);
      expect(auth.buildAuthorizeUrl).toHaveBeenCalledWith({
        redirectUri,
        acrValues,
        responseMode,
        responseType
      });
      expect(auth.buildAuthorizeUrl).toHaveBeenCalledTimes(1);
      expect(window.open).toHaveBeenCalledTimes(1);
      expect(window.open).toHaveBeenCalledWith(authorizeUrl, CRIIPTO_POPUP_ID, `width=${width},height=${height}`);
    });
  });

  describe('authorize', () => {
    let createdWindow: Window;

    beforeEach(() => {
      createdWindow = {} as Window;
      popup.open = jest.fn().mockImplementation(() => Promise.resolve());
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
      expect(popup.open).toHaveBeenCalledTimes(1);
      expect(popup.open).toHaveBeenCalledWith(params);
      expect(popup._latestParams).toBe(params); 

      await Promise.resolve(); // Wait for a promise cycle
      const messageEventListener = windowAddEventListener.mock.calls.find(listener => listener[0] === 'message');
      expect(messageEventListener).toBeDefined();

      // An ignored event, not prefixed correctly
      messageEventListener[1]({
        source: createdWindow,
        data: Math.random().toString()
      });

      messageEventListener[1](messageEvent);
      const result = await authorizePromise;
      expect(result.id_token).toBe(id_token);
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
      const messageEventListener = windowAddEventListener.mock.calls.find(listener => listener[0] === 'message');

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
      window.open = jest.fn().mockImplementation(() => createdWindow);
      auth.buildAuthorizeUrl = jest.fn().mockImplementation(() => {
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
      window.opener = {
        postMessage: jest.fn()
      };

      const code = Math.random().toString();
      const id_token = Math.random().toString();

      // code/query
      windowClose.mockClear();
      window.opener.postMessage.mockClear();
      window.location = {
        ...window.location,
        hash: undefined,
        search: `?code=${code}`
      };
      popup.callback();
      expect(window.opener.postMessage).toHaveBeenCalledTimes(1);
      expect(window.opener.postMessage).toHaveBeenCalledWith(CRIIPTO_AUTHORIZE_RESPONSE+JSON.stringify({
        code
      }));
      expect(windowClose).toHaveBeenCalledTimes(1);

      // id_token/fragment
      windowClose.mockClear();
      window.opener.postMessage.mockClear();
      window.location = {
        ...window.location,
        hash: `#id_token=${id_token}`,
        search: undefined
      };
      popup.callback();
      expect(window.opener.postMessage).toHaveBeenCalledTimes(1);
      expect(window.opener.postMessage).toHaveBeenCalledWith(CRIIPTO_AUTHORIZE_RESPONSE+JSON.stringify({
        id_token
      }));
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