import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RETURN_PATH,
  isSafeReturnPath,
  resolveSafeReturnPath,
} from './safeReturnPath';

describe('safe return paths', () => {
  it.each([
    '/',
    '/dashboard',
    '/vehicles/2dc6ce1b?tab=history#latest-record',
    '/vehicles/garage%20queen?filter=active%20only',
  ])('accepts the local application path %s', (returnPath) => {
    expect(isSafeReturnPath(returnPath)).toBe(true);
    expect(resolveSafeReturnPath(returnPath)).toBe(returnPath);
  });

  it.each([
    undefined,
    null,
    '',
    'dashboard',
    'https://attacker.example/garage',
    'http://attacker.example/garage',
    '//attacker.example/garage',
    '///attacker.example/garage',
    '/%2f%2fattacker.example/garage',
    '/%252f%252fattacker.example/garage',
    'javascript:alert(1)',
    '/javascript:alert(1)',
    '/https://attacker.example/garage',
    '\\attacker.example\\garage',
    '/vehicles\\attacker.example',
    '/vehicles\nprivate',
    '/vehicles%0aprivate',
    '/vehicles%00private',
    '/vehicles%',
    '/vehicles%zz',
  ])('rejects an unsafe or malformed value: %s', (returnPath) => {
    expect(isSafeReturnPath(returnPath)).toBe(false);
    expect(resolveSafeReturnPath(returnPath)).toBe(DEFAULT_RETURN_PATH);
  });

  it.each([
    '/auth/callback',
    '/auth/callback/',
    '/AUTH/CALLBACK',
    '/auth/callback?returnPath=/vehicles',
    '/auth/callback#complete',
    '/auth//callback',
    '/auth/./callback',
    '/auth/step/../callback',
    '/safe/../auth/callback',
    '/auth/%63allback',
    '/%61uth/callback',
    '/auth%2fcallback',
    '/auth%252fcallback',
  ])('rejects the authentication callback loop %s', (returnPath) => {
    expect(resolveSafeReturnPath(returnPath)).toBe(DEFAULT_RETURN_PATH);
  });
});
