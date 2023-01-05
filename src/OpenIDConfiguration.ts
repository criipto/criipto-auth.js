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
  clientID: string

  constructor(authority: string, clientID: string) {
    super();
    this.authority = authority;
    this.clientID = clientID;
  }

  fetchMetadata(): Promise<OpenIDConfiguration> {
    return window.fetch(`${this.authority}/.well-known/openid-configuration?client_id=${this.clientID}`)
      .then(response => response.json())
      .then((metadata: OpenIDMetadata) => {
        Object.assign(this, metadata);
        return this;
      })
  }
}

export default OpenIDConfiguration;