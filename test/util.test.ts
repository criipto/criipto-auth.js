import {describe, test, expect} from '@jest/globals';
import {parseQueryParams} from '../src/util';

describe('parseQueryParams', () => {
  test('parses empty', () => {
    expect(parseQueryParams('')).toStrictEqual({});
  });

  test('parses id_token fragment', () => {
    expect(parseQueryParams('#id_token=eyJ0eXAiOiJKV1QiLCJhbGci')).toStrictEqual({
      id_token: 'eyJ0eXAiOiJKV1QiLCJhbGci'
    });
  });

  test('parses code fragment', () => {
    expect(parseQueryParams('#code=ga8sdjzxcjasdasd')).toStrictEqual({
      code: 'ga8sdjzxcjasdasd'
    });
  });

  test('parses code querystring param', () => {
    expect(parseQueryParams('?code=123as9d8asdasd9asdasd')).toStrictEqual({
      code: '123as9d8asdasd9asdasd'
    });
  });

  test('parses id_token querystring param', () => {
    expect(parseQueryParams('?id_token=NHAPY4YFDRYcJ9yTouFkImBWXOR2scUBDeS')).toStrictEqual({
      id_token: 'NHAPY4YFDRYcJ9yTouFkImBWXOR2scUBDeS'
    });
  });
});
