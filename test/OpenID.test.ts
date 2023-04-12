import {describe, beforeEach, it, expect, jest} from '@jest/globals';
import OpenIDConfiguration from '../src/OpenIDConfiguration';

describe('OpenIDConfiguration', () => {
  let fetch = jest.fn();

  beforeEach(() => {
    Object.defineProperty(global, 'window', {
      writable: true,
      value: {}
    });

    (globalThis.fetch as any) = fetch = jest.fn();
  });

  it('fetches well-known metadata via authority', async () => {
    const metadata = {
      issuer: Math.random().toString(),
      jwks_uri: Math.random().toString(),
      authorization_endpoint: Math.random().toString(),
      token_endpoint: Math.random().toString(),
      userinfo_endpoint: Math.random().toString(),
      end_session_endpoint: Math.random().toString()
    };
    fetch.mockImplementationOnce(() => Promise.resolve({
      json: () => Promise.resolve(metadata)
    }));
    const authority = `https://abcasd${Math.round(Math.random() * 100000)}.com`;
    const clientID = Math.random().toString();
    const instance = new OpenIDConfiguration(authority, clientID);

    await instance.fetchMetadata();

    expect(fetch.mock.calls.length).toEqual(1)
    expect(fetch.mock.calls[0][0]).toEqual(`${authority}/.well-known/openid-configuration?client_id=${clientID}`);
    expect(instance.issuer).toBe(metadata.issuer);
    expect(instance.jwks_uri).toBe(metadata.jwks_uri);
    expect(instance.authorization_endpoint).toBe(metadata.authorization_endpoint);
    expect(instance.token_endpoint).toBe(metadata.token_endpoint);
    expect(instance.userinfo_endpoint).toBe(metadata.userinfo_endpoint);
    expect(instance.end_session_endpoint).toBe(metadata.end_session_endpoint);
  });
});