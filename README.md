# criipto-auth.js

Javascript toolkit for Criipto Verify OIDC

## Index

- [Install](#install])
- [Usage](#usage])
- [Auth](#auth)
- [Auth.popup](#authpopup)
- [Auth.redirect](#authredirect)

## Install

From CDN:

```html
<script src="https://criipto-cdn-url/criipto-auth.js"></script>
```

## Usage

```javascript
var criiptoAuth = new criipto.Auth({
  domain: '{YOUR_CRIIPTO_DOMAIN}',
  clientID: '{YOUR_CRIIPTO_APPLICATION_ID}'
});

criiptoAuth.popup.authorize({
  width: 300,
  height: 400,
  redirectUri: 'http://localhost:8000/example/popup-callback.html',
  acrValues: 'urn:grn:authn:dk:nemid:poces'
});

criiptoAuth.redirect.authorize({
  redirectUri: 'http://localhost:8000/example/index.html',
  acrValues: 'urn:grn:authn:dk:nemid:poces'
});
```

## Auth

### Initialize/Constructor

```javascript
var criiptoAuth = new criipto.Auth({
  domain: '{YOUR_CRIIPTO_DOMAIN}',
  clientID: '{YOUR_CRIIPTO_APPLICATION_ID}'
});

var criiptoAuth = new criipto.Auth({
  domain: '{YOUR_CRIIPTO_DOMAIN}',
  clientID: '{YOUR_CRIIPTO_APPLICATION_ID}',
  redirectUri: 'http://localhost:8000/example/index.html',
  acrValues: 'urn:grn:authn:dk:nemid:poces',
  responseType: 'id_token',
  responseMode: 'fragment'
});
```

Parameters:

- **domain (required, string)**: The domain which your Criipto Application belongs to, such as `example.criipto.id`.
- **clientID (required, string)**: The Client ID/realm for your Criipto Application.
- **additional authorization parameters**: See [Authorization parameters](#authorization-parameters)

### Authorization parameters

All authorization methods like `criiptoAuth.popup.authorize`, `criiptoAuth.redirect.authorize` and `criiptoAuth.authorizeResponsive` take a set of authorization parameters. These authorization parameters can also be provided by default via the `criipto.Auth` constructor.

- **redirectUri (string)**: The URL where Auth0 will call back to with the result of a successful or failed authentication. It must be whitelisted in the "Callback URLs" in your Criipto application settings.
- **acrValues (string)**: What EID to use for authentication, such as `urn:grn:authn:dk:nemid:poces`, a list of acceptable values can be found at `https://{YOUR_CRIIPTO_DOMAIN}/.well-known/openid-configuration`
- **responseType (string)**: Response type for authentication requests. It can be one of `code`, `id_token`.
- **responseMode (string)**: Supported values are `query`, `fragment`.

`popup` defaults to `fragment`/`id_token` and `redirect` defaults to `code`/`query` (if not overwritten by the `criipto.Auth` constructor).

### authorizeResponsive

```javascript
criiptoAuth.authorizeResponsive({
  '(min-width: 768px)': {
    via: 'popup',
    redirectUri: 'http://localhost:8000/example/popup-callback.html',
    acrValues: 'urn:grn:authn:dk:nemid:poces',
    width: 320,
    height: 460
  },
  '(max-width: 767px)': {
    via: 'redirect',
    redirectUri: 'http://localhost:8000/example/index.html',
    acrValues: 'urn:grn:authn:dk:nemid:poces'
  }
});
```

Provides a convenient way to pick authorization method (`popup` or `redirect`) based on a CSS media query (screen size).

- **{[mediaQuery: string]: {via: 'popup' | 'redirect', [Authorization parameters](#authorization-parameters)}}** 

## Auth.popup

### authorize

```javascript
criiptoAuth.popup.authorize({
  width: 300,
  height: 400,
  redirectUri: 'http://localhost:8000/example/popup-callback.html',
  acrValues: 'urn:grn:authn:dk:nemid:poces'
});
```

- **width (optional, number)**: Width of the popup.
- **height (optional, number)**: Height of the popup
- **[Authorization parameters](#authorization-parameters)**

### callback
```javascript
criiptoAuth.popup.callback();
```

Communications with the parent window to send back `code` or `id_token` from `window.location` query/hash.

## Auth.redirect

### authorize

```javascript
criiptoAuth.redirect.authorize({
  redirectUri: 'http://localhost:8000/example/index.html',
  acrValues: 'urn:grn:authn:dk:nemid:poces'
});
```

Redirects the users browser tab to the authorization url. After authorization the user will be redirected back to the provided `redirectUri`.

- **[Authorization parameters](#authorization-parameters)**

### match

```javascript
const match = criiptoAuth.redirect.match();
console.log(match.code);
console.log(match.id_token);
```

Returns an object with a code or id_token key if present in the `window.location` search (query params) or hash.