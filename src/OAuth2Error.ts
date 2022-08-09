export default class OAuth2Error extends Error {
  error: string;
  error_description?: string;
  state?: string;

  constructor(error: string, error_description?: string, state?: string) {
    super(error + (error_description ? ` (${error_description})` : ''));
    this.name = "OAuth2Error";
    this.error = error;
    this.error_description = error_description;
    this.state = state;
  }
}
