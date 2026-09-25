import { IduraSDKConfigurationError } from "./errors";

type CriiptoMetadataClient = {
  client_id: string;
};
class CriiptoMetadata {
  clients: CriiptoMetadataClient[];
}

export class CriiptoConfiguration extends CriiptoMetadata {
  authority: string;
  clientID: string;
  client: CriiptoMetadataClient;

  constructor(authority: string, clientID: string) {
    super();
    this.authority = authority;
    this.clientID = clientID;
  }

  async fetchMetadata(): Promise<CriiptoConfiguration> {
    const response = await globalThis
      .fetch(
        `${this.authority}/.well-known/criipto-configuration?client_id=${this.clientID}`,
      )
      .catch((err) => {
        throw new IduraSDKConfigurationError(
          `Failed to fetch '${this.authority}/.well-known/criipto-configuration?client_id=${this.clientID}': ${err.toString()}`,
        );
      });

    if (response.status === 404) {
      throw new IduraSDKConfigurationError(
        "Client ID does not exist, or is not configured for this domain.",
      );
    } else if (response.status !== 200) {
      throw new IduraSDKConfigurationError(
        "Could not fetch Criipto metadata. This is probably not a Criipto domain.",
      );
    }

    const metadata = (await response.json()) as CriiptoMetadata;

    if (!metadata.clients) {
      throw new IduraSDKConfigurationError(
        "Unexpected Criipto metadata. This is probably not a Criipto domain.",
      );
    }

    Object.assign(this, metadata);
    const client = this.clients.find((c) => c.client_id === this.clientID);

    if (!client) {
      throw new IduraSDKConfigurationError(
        "Client ID does not exist, or is not configured for this domain.",
      );
    }

    this.client = client;
    return this;
  }
}

export default CriiptoConfiguration;
