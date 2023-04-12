type CriiptoMetadataClient = {
  client_id : string
  qr_branding : boolean
  qr_enabled : boolean
  qr_intermediary_url? : string
}
class CriiptoMetadata {
  csdc_wss_url : string;
  csdc_session_url : string;
  qr_intermediary_url : string;
  clients : CriiptoMetadataClient[];
}

class CriiptoConfiguration extends CriiptoMetadata {
  authority: string;
  clientID: string;
  client: CriiptoMetadataClient;

  constructor(authority: string, clientID: string) {
    super();
    this.authority = authority;
    this.clientID = clientID;
  }

  fetchMetadata(): Promise<CriiptoConfiguration> {
    return globalThis.fetch(`${this.authority}/.well-known/criipto-configuration?client_id=${this.clientID}`)
      .then(response => response.json())
      .then((metadata: CriiptoMetadata) => {
        Object.assign(this, metadata);
        this.client = this.clients.find(c => c.client_id === this.clientID)!;

        return this;
      });
  }
}

export default CriiptoConfiguration;