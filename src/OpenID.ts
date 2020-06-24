class OpenIDMetadata {
  issuer: string;
  jwks_uri: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
  end_session_endpoint: string;
  response_types_supported: string[];
  response_modes_supported: string[];
  subject_types_supported: string[];
  acr_values_supported: string[];
  id_token_signing_alg_values_supported: string[];
}

class OpenIDConfiguration extends OpenIDMetadata {
  authority: string;

  constructor(authority: string) {
    super();
    this.authority = authority;
  }

  fetchMetadata(): Promise<void> {
    return window.fetch(`${this.authority}/.well-known/openid-configuration`)
      .then(response => response.json())
      .then((metadata: OpenIDMetadata) => {
        Object.assign(this, metadata);
      })
  }
}

export default OpenIDConfiguration;