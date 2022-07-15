export default class SessionAPI {
  // Something like: https://criipto-myphone-coordinator-test.azurewebsites.net/v1/sessions/{id}
  private URL: string;
  constructor(URL: string) {
    this.URL = URL;

    if (!URL.includes('{id}')) throw new Error('Expected URL to include {id} template arg.');
  }

  async get<T = object>(id: string) : Promise<T | null> {
    const url = this.URL.replace('{id}', id);
    const response = await fetch(url);

    if (response.ok) return await response.json();
    if (response.status === 404) return null;
    const message = await response.text();
    throw new Error(message);
  }

  async save(id: string, session: object) {
    const url = this.URL.replace('{id}', id);
    const response = await fetch(url, {
      method: 'POST',
      body: JSON.stringify(session),
      headers: {
        "Content-Type": "application/json"
      }
    });

    if (response.ok) return;
    const message = await response.text();
    throw new Error(message);
  }

  async delete(id: string) {
    const url = this.URL.replace('{id}', id);
    const response = await fetch(url, {
      method: 'DELETE'
    });

    if (response.ok) return;
    const message = await response.text();
    throw new Error(message);
  }
}