import type CriiptoAuth from './index';
import type {AuthorizeResponse, SilentAuthorizeParams} from './types';
import {parseAuthorizeResponseFromUrl} from './util';
import {generate as generatePKCE, savePKCEState} from './pkce';

export default class CriiptoAuthSilent {
  criiptoAuth: CriiptoAuth;
  iframe: HTMLIFrameElement;

  constructor(criiptoAuth: CriiptoAuth) {
    this.criiptoAuth = criiptoAuth;
  }

  open(url: string): HTMLIFrameElement {
    const iframe = document.createElement('iframe');
    iframe.style.width = '0px';
    iframe.style.height = '0px';
    iframe.style.visibility = 'hidden';
    iframe.src = url;

    document.body.appendChild(iframe);

    return iframe;
  }

  remove(iframe: HTMLIFrameElement) {
    if (iframe?.parentNode === document.body) {
      document.body.removeChild(iframe);
    }
  }

  listen(iframe: HTMLIFrameElement) {
    return new Promise<AuthorizeResponse>((resolve, reject) => {
      const receiveMessage = (event: MessageEvent) => {
        const allowed = 
          event.source === iframe!.contentWindow || 
          event.origin === `https://${this.criiptoAuth.domain}`;
        if (!allowed) return;
        
        if (event.data && (event.data.includes('code=') || event.data.includes('id_token=') || event.data.includes('error='))) {
          window.removeEventListener('message', receiveMessage);
          this.remove(iframe!);
          resolve(parseAuthorizeResponseFromUrl(event.data));
        }
      };
  
      window.addEventListener('message', receiveMessage);
    });
  }

  async authorize(params: SilentAuthorizeParams): Promise<AuthorizeResponse> {
    const redirectUri = params.redirectUri || this.criiptoAuth.options.redirectUri;
    const responseType = params.responseType ?? 'id_token';
    const pkce = await (
      responseType === 'id_token' ?
        generatePKCE() : Promise.resolve(undefined)
    );

    const url = await this.criiptoAuth.buildAuthorizeUrl(this.criiptoAuth.buildAuthorizeParams({
      ...params,
      responseMode: 'post_message',
      responseType: 'code',
      pkce,
      prompt: 'none'
    }));

    const timeout = params.timeout || 10000;
    const iframe = this.open(url);

    return Promise.race([
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject('Timed out')
        }, timeout);
    }),
      this.listen(iframe).then(response => {
        return this.criiptoAuth.processResponse(
          response,
          pkce && "code_verifier" in pkce ? 
            {code_verifier: pkce.code_verifier, redirect_uri: redirectUri!} :
            undefined
        ).then(response => response!)
      })
    ]).finally(() => this.remove(iframe));
  }
}
