class CriiptoMetadata {
  csdc_wss_url : string;
  csdc_session_url : string;
  clients : {
    client_id : string
    qr_branding : boolean
  }[];
}

class CriiptoConfiguration extends CriiptoMetadata {
  authority: string;
  clientID: string

  constructor(authority: string, clientID: string) {
    super();
    this.authority = authority;
    this.clientID = clientID;
  }

  fetchMetadata(): Promise<void> {
    return window.fetch(`${this.authority}/.well-known/criipto-configuration?client_id=${this.clientID}`)
      .then(response => response.json())
      .then((metadata: CriiptoMetadata) => {
        Object.assign(this, metadata);
      });
  }
}

export default CriiptoConfiguration;