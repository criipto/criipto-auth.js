import { describe, beforeEach, it, expect, vi } from "vitest";
import * as crypto from "crypto";
import { MemoryStore } from "./helper";
import * as pkce from "../src/pkce";
import CriiptoAuth, { OAuth2Error, OpenIDConfiguration } from "../src/index";
import CriiptoAuthPopup from "../src/Popup";
import {
  CRIIPTO_POPUP_ID,
  CRIIPTO_POPUP_BACKDROP_ID,
  CRIIPTO_AUTHORIZE_RESPONSE,
} from "../src/util";
import { jwtVerify } from "jose";

vi.mock("../src/pkce");
vi.mock("jose");
(pkce.generate as any).mockImplementation(() => {
  return Promise.resolve({
    code_verifier: Math.random().toString(),
    code_challenge: Math.random().toString(),
    code_challenge_method: "S256",
  });
});

(jwtVerify as any).mockResolvedValue({
  payload: {},
});

const metadata_example = {
  issuer: "https://example.com",
  authorization_endpoint: "https://example.com",
  pushed_authorization_request_endpoint: "https://example.com/oauth2/par",
  jwks_uri: "https://example.com",
  response_modes_supported: ["query", "form_post", "fragment", "post_message"],
  response_types_supported: ["code", "id_token", "code id_token"],
};

describe("CriiptoAuthPopup", () => {
  let auth: CriiptoAuth,
    popup: CriiptoAuthPopup,
    windowAddEventListener = vi.fn(),
    windowClose = vi.fn();

  beforeEach(() => {
    auth = new CriiptoAuth({
      domain: `${Math.random().toString()}.com`,
      clientID: Math.random().toString(),
      store: new MemoryStore(),
    });

    popup = new CriiptoAuthPopup(auth);

    vi.spyOn(popup.backdrop, "render");
    vi.spyOn(popup.backdrop, "remove");

    windowAddEventListener = vi.fn();
    windowClose = vi.fn();
    Object.defineProperty(global, "window", {
      writable: true,
      value: {
        addEventListener: windowAddEventListener,
        removeEventListener: vi.fn(),
        close: windowClose,
        btoa: (input: string) => Buffer.from(input).toString("base64"),
        screenLeft: 0,
        screenTop: 0,
        innerWidth: 1000,
        innerHeight: 1000,
        screen: {
          availWidth: 1000,
        },
      },
    });

    Object.defineProperty(global, "document", {
      writable: true,
      value: {},
    });

    Object.defineProperty(global.document, "body", {
      writable: true,
      value: {
        appendChild: vi.fn(),
        removeChild: vi.fn(),
      },
    });

    (global.document.getElementById as any) = vi
      .fn()
      .mockImplementation((id) => {
        if (id === CRIIPTO_POPUP_BACKDROP_ID) return null;
        return {
          addEventListener: vi.fn(),
        };
      });
    (global.document.createElement as any) = vi.fn().mockImplementation(() => ({
      addEventListener: vi.fn(),
    }));
  });

  describe("open", () => {
    it("opens window", async () => {
      const authorizeUrl = Math.random().toString();
      const redirectUri = Math.random().toString();
      const acrValues = "urn:grn:authn:dk:nemid:poces";
      const createdWindow = {};

      (window.open as any) = vi.fn().mockImplementation(() => createdWindow);

      const actual = await popup.open(authorizeUrl, {});

      expect(actual).toBe(createdWindow);
      expect(popup.window).toBe(actual);
      expect(window.open).toHaveBeenCalledTimes(1);
      expect(window.open).toHaveBeenCalledWith(
        authorizeUrl,
        CRIIPTO_POPUP_ID,
        `width=400,height=660,top=170,left=300`,
      );
    });

    it("allows disabling backdrop", async () => {
      const createdWindow = {};

      (window.open as any) = vi.fn().mockImplementation(() => createdWindow);

      const params = {
        redirectUri: Math.random().toString(),
        acrValues: "urn:grn:authn:dk:nemid:poces",
        backdrop: false,
      };

      popup.open(Math.random().toString(), params);
      expect(popup.backdrop.render).toHaveBeenCalledTimes(0);
    });
  });

  describe("trigger", () => {
    let createdWindow: Window;

    beforeEach(() => {
      createdWindow = { close: vi.fn() } as any as Window;
      (window as any).open = vi.fn().mockImplementation(() => createdWindow);
      (window as any).setTimeout = vi.fn();
      vi.spyOn(popup, "open");
    });

    it("opens popup, receives callback with id_token redirectUri", async () => {
      (globalThis.fetch as any) = vi
        .fn<typeof globalThis.fetch>()
        .mockImplementation(async (url: RequestInfo | URL) => {
          if (url.toString().includes(".well-known/openid-configuration")) {
            return new Response(JSON.stringify(metadata_example));
          }
          if (
            url
              .toString()
              .endsWith(metadata_example.pushed_authorization_request_endpoint)
          ) {
            return new Response(JSON.stringify({}), { status: 201 });
          }
          throw new Error("Unexpected url");
        });

      const id_token = Math.random().toString();
      const params = {
        redirectUri: Math.random().toString(),
        acrValues: "urn:grn:authn:dk:nemid:poces",
      };
      const messageEvent = {
        source: createdWindow,
        data: `https://example.com/?id_token=${id_token}`,
      };

      const triggerPromise = popup.trigger(params);
      await new Promise((resolve) => setImmediate(resolve));
      expect(popup.open).toHaveBeenCalledTimes(1);
      expect(popup._latestParams.acrValues).toEqual(params.acrValues);
      expect(popup._latestParams.redirectUri).toEqual(params.redirectUri);

      await Promise.resolve(); // Wait for a promise cycle
      const messageEventListener = windowAddEventListener.mock.calls.find(
        (listener) => listener[0] === "message",
      ) as any;
      expect(messageEventListener).toBeDefined();

      // An ignored event, not prefixed correctly
      messageEventListener[1]({
        source: createdWindow,
        data: Math.random().toString(),
      });

      messageEventListener[1](messageEvent);
      const result = await triggerPromise;
      expect(result.id_token).toBe(id_token);
    });

    it("respects state", async () => {
      (globalThis.fetch as any) = vi
        .fn<typeof globalThis.fetch>()
        .mockImplementation(async (url: RequestInfo | URL) => {
          if (url.toString().includes(".well-known/openid-configuration")) {
            return new Response(JSON.stringify(metadata_example));
          }
          if (
            url
              .toString()
              .endsWith(metadata_example.pushed_authorization_request_endpoint)
          ) {
            return new Response(JSON.stringify({}), {
              status: 201,
            });
          }
          throw new Error("Unexpected url");
        });

      const id_token = Math.random().toString();
      const state = Math.random().toString();
      const params = {
        redirectUri: Math.random().toString(),
        acrValues: "urn:grn:authn:dk:nemid:poces",
        state,
      };
      const messageEvent = {
        source: createdWindow,
        data: `https://example.com/?id_token=${id_token}&state=${state}`,
      };

      const triggerPromise = popup.trigger(params);
      await new Promise((resolve) => setImmediate(resolve));
      expect(popup.open).toHaveBeenCalledTimes(1);
      expect(popup._latestParams.acrValues).toEqual(params.acrValues);
      expect(popup._latestParams.redirectUri).toEqual(params.redirectUri);

      await Promise.resolve(); // Wait for a promise cycle
      const messageEventListener = windowAddEventListener.mock.calls.find(
        (listener) => listener[0] === "message",
      ) as any;
      expect(messageEventListener).toBeDefined();

      /** ignored events, bad state */
      messageEventListener[1]({
        ...messageEvent,
        data: `https://example.com/?id_token=${id_token}&state=${Math.random().toString()}`,
      });
      messageEventListener[1]({
        ...messageEvent,
        data: `https://example.com/?id_token=${id_token}&state=${Math.random().toString()}`,
      });
      messageEventListener[1]({
        ...messageEvent,
        data: `https://example.com/?id_token=${id_token}&state=${Math.random().toString()}`,
      });
      messageEventListener[1](messageEvent);
      const result = await triggerPromise;
      expect(result.id_token).toBe(id_token);
    });

    it("opens popup, receives callback with code redirectUri", async () => {
      (globalThis.fetch as any) = vi
        .fn<typeof globalThis.fetch>()
        .mockImplementation(async (url: RequestInfo | URL) => {
          if (url.toString().includes(".well-known/openid-configuration")) {
            return new Response(JSON.stringify(metadata_example));
          }
          if (
            url
              .toString()
              .endsWith(metadata_example.pushed_authorization_request_endpoint)
          ) {
            return new Response(JSON.stringify({}), { status: 201 });
          }
          throw new Error("Unexpected url");
        });

      const code = Math.random().toString();
      const params = {
        redirectUri: Math.random().toString(),
        acrValues: "urn:grn:authn:dk:nemid:poces",
      };
      const messageEvent = {
        source: createdWindow,
        data: `https://example.com/?code=${code}`,
      };

      const triggerPromise = popup.trigger(params);
      await new Promise((resolve) => setImmediate(resolve));
      expect(popup.open).toHaveBeenCalledTimes(1);
      expect(popup._latestParams.acrValues).toEqual(params.acrValues);
      expect(popup._latestParams.redirectUri).toEqual(params.redirectUri);

      await Promise.resolve(); // Wait for a promise cycle
      const messageEventListener = windowAddEventListener.mock.calls.find(
        (listener) => listener[0] === "message",
      ) as any;
      expect(messageEventListener).toBeDefined();

      // An ignored event, not prefixed correctly
      messageEventListener[1]({
        source: createdWindow,
        data: Math.random().toString(),
      });

      messageEventListener[1](messageEvent);
      const result = await triggerPromise;
      expect(result.code).toBe(code);
    });
  });

  describe("authorize", () => {
    let createdWindow: Window;

    beforeEach(() => {
      createdWindow = { close: vi.fn() } as any as Window;
      (window as any).open = vi.fn().mockImplementation(() => createdWindow);
      vi.spyOn(popup, "open");
      (window as any).setTimeout = vi.fn();
    });

    it("opens popup, receives callback with JSON and does PKCE token exchange", async () => {
      const metadata = {
        ...metadata_example,
        token_endpoint: Math.random().toString(),
      };
      const id_token = Math.random().toString();

      (globalThis.fetch as any) = vi
        .fn<typeof globalThis.fetch>()
        .mockImplementation(async (url: RequestInfo | URL) => {
          if (url.toString().includes(".well-known/openid-configuration")) {
            return new Response(JSON.stringify(metadata));
          }
          if (
            url
              .toString()
              .endsWith(metadata_example.pushed_authorization_request_endpoint)
          ) {
            return new Response(JSON.stringify({}), { status: 201 });
          }
          if (url === metadata.token_endpoint) {
            return new Response(JSON.stringify({ id_token }));
          }
          throw new Error("Unexpected url");
        });

      const code = Math.random().toString();
      const params = {
        redirectUri: "abc" + Math.random().toString(),
        acrValues: "urn:grn:authn:dk:nemid:poces",
      };
      const messageEvent = {
        source: createdWindow,
        data:
          CRIIPTO_AUTHORIZE_RESPONSE +
          JSON.stringify({
            code,
          }),
      };

      const authorizePromise = popup.authorize(params);
      await new Promise((resolve) => setImmediate(resolve));
      expect(popup.open).toHaveBeenCalledTimes(1);
      expect(popup._latestParams.acrValues).toEqual(params.acrValues);
      expect(popup._latestParams.redirectUri).toEqual(params.redirectUri);
      expect(popup._latestUrl).toBeDefined();

      await new Promise((resolve) => setImmediate(resolve));
      const messageEventListener = windowAddEventListener.mock.calls.find(
        (listener) => listener[0] === "message",
      ) as any;
      expect(messageEventListener).toBeDefined();

      // An ignored event, not prefixed correctly
      messageEventListener[1]({
        source: createdWindow,
        data: Math.random().toString(),
      });

      messageEventListener[1](messageEvent);
      const result = await authorizePromise;
      expect(result.id_token).toBe(id_token);

      const fetchCall = (globalThis.fetch as any).mock.calls.find(
        ([url]: string[]) => url === metadata.token_endpoint,
      );
      expect(fetchCall[1].body).toContain(`code_verifier=`);
    });

    it("opens popup, receives callback with redirectUri and does PKCE token exchange", async () => {
      const metadata = {
        ...metadata_example,
        token_endpoint: Math.random().toString(),
      };
      const id_token = Math.random().toString();

      (globalThis.fetch as any) = vi
        .fn<typeof globalThis.fetch>()
        .mockImplementation(async (url: RequestInfo | URL) => {
          if (url.toString().includes(".well-known/openid-configuration")) {
            return new Response(JSON.stringify(metadata));
          }
          if (
            url
              .toString()
              .endsWith(metadata_example.pushed_authorization_request_endpoint)
          ) {
            return new Response(JSON.stringify({}), { status: 201 });
          }
          if (url === metadata.token_endpoint) {
            return new Response(JSON.stringify({ id_token }));
          }
          throw new Error("Unexpected url");
        });

      const code = Math.random().toString();
      const params = {
        redirectUri: Math.random().toString(),
        acrValues: "urn:grn:authn:dk:nemid:poces",
      };
      const messageEvent = {
        source: createdWindow,
        data: `https://example.com/?code=${code}`,
      };

      const authorizePromise = popup.authorize(params);
      await new Promise((resolve) => setImmediate(resolve));
      expect(popup.open).toHaveBeenCalledTimes(1);
      expect(popup._latestParams.acrValues).toEqual(params.acrValues);
      expect(popup._latestParams.redirectUri).toEqual(params.redirectUri);

      await Promise.resolve(); // Wait for a promise cycle
      const messageEventListener = windowAddEventListener.mock.calls.find(
        (listener) => listener[0] === "message",
      ) as any;
      expect(messageEventListener).toBeDefined();

      // An ignored event, not prefixed correctly
      messageEventListener[1]({
        source: createdWindow,
        data: Math.random().toString(),
      });

      messageEventListener[1](messageEvent);
      const result = await authorizePromise;
      expect(result.id_token).toBe(id_token);

      const fetchCall = (globalThis.fetch as any).mock.calls.find(
        ([url]: string[]) => url === metadata.token_endpoint,
      );
      expect(fetchCall[1].body).toContain(`code_verifier=`);
    });

    it("receives error message from popup window", async () => {
      const metadata = {
        ...metadata_example,
        token_endpoint: Math.random().toString(),
      };

      (globalThis.fetch as any) = vi
        .fn<typeof globalThis.fetch>()
        .mockImplementation(async (url: RequestInfo | URL) => {
          if (url.toString().includes(".well-known/openid-configuration")) {
            return new Response(JSON.stringify(metadata));
          }
          if (
            url
              .toString()
              .endsWith(metadata_example.pushed_authorization_request_endpoint)
          ) {
            return new Response(JSON.stringify({}), { status: 201 });
          }
          throw new Error("Unexpected url");
        });

      const error = Math.random().toString();
      const error_description = Math.random().toString();
      const messageEvent = {
        source: createdWindow,
        data:
          CRIIPTO_AUTHORIZE_RESPONSE +
          JSON.stringify({
            error,
            error_description,
          }),
      };

      const authorizePromise = popup.authorize({
        redirectUri: Math.random().toString(),
        acrValues: "urn:grn:authn:dk:nemid:poces",
      });

      await new Promise((resolve) => setImmediate(resolve));
      const messageEventListener = windowAddEventListener.mock.calls.find(
        (listener) => listener[0] === "message",
      ) as any;

      // An ignored event, not correct osurce
      messageEventListener[1]({
        source: {},
        data: Math.random().toString(),
      });

      messageEventListener[1](messageEvent);
      expect.assertions(1);
      await authorizePromise.catch((err) => {
        expect(err).toStrictEqual(new OAuth2Error(error, error_description));
      });
    });
  });

  describe("close", () => {
    it("closes the window opened by open", async () => {
      const createdWindow = {
        close: vi.fn(),
      };
      (window.open as any) = vi.fn().mockImplementation(() => createdWindow);
      (auth.buildAuthorizeUrl as any) = vi.fn().mockImplementation(() => {
        return new Promise((resolve) => {
          resolve(Math.random().toString());
        });
      });
      await popup.open(Math.random().toString(), {});

      popup.close();

      expect(createdWindow.close).toHaveBeenCalledTimes(1);
    });
  });

  describe("callback", () => {
    it("parses params from location and messages back to opener", () => {
      (window as any).opener = {
        postMessage: vi.fn(),
      };

      const code = Math.random().toString();
      const id_token = Math.random().toString();

      // code/query
      windowClose.mockClear();
      (window.opener.postMessage as any).mockClear();
      window.location = {
        ...window.location,
        hash: "",
        // @ts-expect-error
        search: `?code=${code}`,
        origin: Math.random().toString(),
      };
      popup.callback(window.location.origin);
      expect(window.opener.postMessage).toHaveBeenCalledTimes(1);
      expect(window.opener.postMessage).toHaveBeenCalledWith(
        CRIIPTO_AUTHORIZE_RESPONSE +
          JSON.stringify({
            code,
          }),
        window.location.origin,
      );
      expect(windowClose).toHaveBeenCalledTimes(1);

      // id_token/fragment
      windowClose.mockClear();
      (window.opener.postMessage as any).mockClear();
      window.location = {
        ...window.location,
        hash: `#id_token=${id_token}`,
        // @ts-expect-error
        search: "",
        origin: Math.random().toString(),
      };
      popup.callback(window.location.origin);
      expect(window.opener.postMessage).toHaveBeenCalledTimes(1);
      expect(window.opener.postMessage).toHaveBeenCalledWith(
        CRIIPTO_AUTHORIZE_RESPONSE +
          JSON.stringify({
            id_token,
          }),
        window.location.origin,
      );
      expect(windowClose).toHaveBeenCalledTimes(1);
    });
  });

  describe("CriiptoAuthPopupBackdrop", () => {
    describe("handleOpen", () => {
      it("reopens popup with last known params", () => {
        const url = Math.random().toString();
        const params = {
          redirectUri: Math.random().toString(),
          acrValues: "urn:grn:authn:dk:nemid:poces",
        };
        popup._latestUrl = url;
        popup._latestParams = params;
        (popup as any).open = vi.fn();

        popup.backdrop.handleOpen();

        expect(popup.open).toHaveBeenCalledTimes(1);
        expect(popup.open).toHaveBeenCalledWith(url, params);
      });
    });

    describe("handleCancel", () => {
      it("tells popup to close", () => {
        popup.close = vi.fn();

        popup.backdrop.handleCancel();

        expect(popup.close).toHaveBeenCalledTimes(1);
      });
    });
  });
});
