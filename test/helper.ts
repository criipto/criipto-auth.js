
export class MemoryStore {
  data : {[key: string]: any} = {};

  constructor() {
    this.data = {};
  }

  key(i : number) { return 'asd' }
  length: 1
  setItem(key : string, value : any) {
    this.data[key] = value;
  }
  removeItem(key : string) {
    delete this.data[key]
  }
  clear() {
    console.log('clear');
    this.data = {};
  }
  getItem(key : string) {
    return this.data[key];
  }
}