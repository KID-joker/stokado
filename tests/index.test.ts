// /**
//  * The implementation of local and session is the same.
//  * So just test local.
//  */
// import { local, session } from '../src/index';

// describe('proxy-web-storage', () => {
//   it('Can set, read and remove', () => {
//     expect(local.test).toBe(undefined);
//     local.test = 'Hello proxy-web-storage';
//     expect(local.test).toBe('Hello proxy-web-storage');
//     delete local.test;
//     expect(local.test).toBe(undefined);
//   })

//   it('localStorage methods', () => {
//     expect(local.getItem('local-test')).toBe(undefined);
//     local.setItem('local-test', 'Hello proxy-web-storage');
//     expect(local.getItem('local-test')).toBe('Hello proxy-web-storage');
//     local.removeItem('local-test');
//     expect(local.getItem('local-test')).toBe(undefined);

//     local.setItem('local-test1', '1');
//     local.setItem('local-test2', '2');
//     expect(local.length).toBe(2);
//     local.clear();
//     expect(local.length).toBe(0);
//   })

//   it('sessionStorage methods', () => {
//     expect(session.getItem('session-test')).toBe(undefined);
//     session.setItem('session-test', 'Hello proxy-web-storage');
//     expect(session.getItem('session-test')).toBe('Hello proxy-web-storage');
//     session.removeItem('session-test');
//     expect(session.getItem('session-test')).toBe(undefined);

//     session.setItem('session-test1', '1');
//     session.setItem('session-test2', '2');
//     expect(session.length).toBe(2);
//     session.clear();
//     expect(session.length).toBe(0);
//   })

//   it('Number', () => {
//     local.test = 0;
//     expect(local.test).toBe(0);

//     local.test = 1;
//     expect(local.test).toBe(1);

//     local.test = -1;
//     expect(local.test).toBe(-1);

//     local.test = 2.71;
//     expect(local.test).toBe(2.71);

//     local.test = NaN;
//     expect(local.test).toBe(NaN);

//     local.test = Infinity;
//     expect(local.test).toBe(Infinity);

//     local.test = -Infinity;
//     expect(local.test).toBe(-Infinity);

//     local.test = '0';
//     expect(local.test).toBe('0');

//     local.test = '1';
//     expect(local.test).toBe('1');

//     local.test = '-1';
//     expect(local.test).toBe('-1');

//     local.test = '2.71';
//     expect(local.test).toBe('2.71');

//     local.test = 'NaN';
//     expect(local.test).toBe('NaN');

//     local.test = 'Infinity';
//     expect(local.test).toBe('Infinity');

//     local.test = '-Infinity';
//     expect(local.test).toBe('-Infinity');

//     local.test = new Number(3.14);
//     expect(local.test).toBe(3.14);
//   })

//   it('BigInt', () => {
//     local.test = 1n;
//     expect(local.test).toBe(1n);

//     local.test = '1n';
//     expect(local.test).toBe('1n');
//   })

//   it('Boolean', () => {
//     local.test = true;
//     expect(local.test).toBe(true);

//     local.test = false;
//     expect(local.test).toBe(false);

//     local.test = 'true';
//     expect(local.test).toBe('true');

//     local.test = 'false';
//     expect(local.test).toBe('false');

//     local.test = new Boolean(false);
//     expect(local.test).toBe(false);
//   })

//   it('Null', () => {
//     local.test = null;
//     expect(local.test).toBe(null);

//     local.test = 'null';
//     expect(local.test).toBe('null');
//   })

//   it('Undefined', () => {
//     local.test = undefined;
//     expect(local.test).toBe(undefined);

//     local.test = 'undefined';
//     expect(local.test).toBe('undefined');
//   })

//   it('Object', () => {
//     // JSON.stringify don't know how to serialize a BigInt
//     local.test = {
//       '$string': 'Hello proxy-web-storage',
//       '$number': 0,
//       '$boolean': true,
//       '$null': null,
//       '$undefined': undefined
//     }
//     expect(local.test).toEqual({
//       '$string': 'Hello proxy-web-storage',
//       '$number': 0,
//       '$boolean': true,
//       '$null': null,
//       '$undefined': undefined
//     })
//   })

//   it('Array', () => {
//     local.test = [];
//     expect(local.test).toEqual([]);

//     local.test[0] = 'hello';
//     expect(local.test).toEqual(['hello']);

//     local.test.length = 0;
//     expect(local.test).toEqual([]);

//     local.test.push('hello', 'proxy-web-storage');
//     expect(local.test).toEqual(['hello', 'proxy-web-storage']);

//     expect(local.test.pop()).toBe('proxy-web-storage');
//   })

//   it('Date', () => {
//     local.test = new Date('2000-01-01T00:00:00.000Z');
//     expect(local.test).toEqual(new Date('2000-01-01T00:00:00.000Z'))
//   })

//   it('RegExp', () => {
//     local.test = new RegExp("ab+c");
//     expect(local.test).toEqual(new RegExp("ab+c"));

//     local.test = /ab+c/;
//     expect(local.test).toEqual(/ab+c/);
//   })

//   it('Function', () => {
//     local.test = function() {
//       return 'Hello proxy-web-storage!';
//     };
//     expect(local.test()).toEqual('Hello proxy-web-storage!');

//     local.test = () => {
//       return 'Hello proxy-web-storage!';
//     };
//     expect(local.test()).toEqual('Hello proxy-web-storage!');
//   })

//   it('Set', () => {
//     local.test = new Set(['Hello proxy-web-storage']);
//     expect(local.test).toEqual(new Set(['Hello proxy-web-storage']));
//   })

//   it('Map', () => {
//     local.test = new Map([['hello', 'proxy-web-storage'], ['foo', 'bar']]);
//     expect(local.test).toEqual(new Map([['hello', 'proxy-web-storage'], ['foo', 'bar']]));
//   })
// })
