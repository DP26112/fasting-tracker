// client/src/utils/tokenValidation.ts

/**
 * Token validation utilities for JWT tokens
 * Helps diagnose and prevent mobile browser token issues
 */

interface TokenPayload {
  userId?: string;
  email?: string;
  exp: number;
  iat?: number;
}

/**
 * Decodes a JWT token without verification (client-side check only)
 * Returns null if token is malformed
 */
export function decodeToken(token: string): TokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.error('Token validation: Invalid token format (expected 3 parts)');
      return null;
    }

    const payload = parts[1];
    const decoded = JSON.parse(atob(payload));
    return decoded;
  } catch (error) {
    console.error('Token validation: Failed to decode token', error);
    return null;
  }
}

/**
 * Check if a token is expired based on the 'exp' claim
 * Returns true if expired, false if still valid
 */
export function isTokenExpired(token: string): boolean {
  const decoded = decodeToken(token);
  if (!decoded || !decoded.exp) {
    console.error('Token validation: Cannot determine expiration (missing exp claim)');
    return true; // Treat as expired if we can't decode
  }

  const currentTime = Math.floor(Date.now() / 1000); // Current time in seconds
  const isExpired = decoded.exp < currentTime;
  
  if (isExpired) {
    const expiredAgo = currentTime - decoded.exp;
    console.warn(`Token validation: Token expired ${expiredAgo} seconds ago`);
  }

  return isExpired;
}

/**
 * Validates that localStorage is working properly
 * Some mobile browsers restrict localStorage in certain modes
 */
export function testLocalStorage(): boolean {
  try {
    const testKey = '__localStorage_test__';
    const testValue = 'test';
    
    localStorage.setItem(testKey, testValue);
    const retrieved = localStorage.getItem(testKey);
    localStorage.removeItem(testKey);
    
    if (retrieved !== testValue) {
      console.error('Token validation: localStorage read/write mismatch');
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Token validation: localStorage is not available', error);
    return false;
  }
}

/**
 * Get comprehensive debug information about the current token
 * Useful for troubleshooting mobile browser issues
 */
export function getTokenDebugInfo(): {
  exists: boolean;
  length: number;
  isValid: boolean;
  isExpired: boolean;
  payload: TokenPayload | null;
  localStorageWorks: boolean;
} {
  const localStorageWorks = testLocalStorage();
  const token = localStorage.getItem('token');
  
  if (!token) {
    return {
      exists: false,
      length: 0,
      isValid: false,
      isExpired: true,
      payload: null,
      localStorageWorks,
    };
  }

  const payload = decodeToken(token);
  const isValid = payload !== null;
  const expired = isValid ? isTokenExpired(token) : true;

  return {
    exists: true,
    length: token.length,
    isValid,
    isExpired: expired,
    payload,
    localStorageWorks,
  };
}

/**
 * Logs comprehensive token debug information to console
 * Call this during app initialization to help diagnose mobile issues
 */
export function logTokenDebugInfo(): void {
  const info = getTokenDebugInfo();
  
  console.group('🔐 Token Debug Information');
  console.log('Token exists:', info.exists);
  console.log('Token length:', info.length);
  console.log('Token is valid format:', info.isValid);
  console.log('Token is expired:', info.isExpired);
  console.log('localStorage working:', info.localStorageWorks);
  
  if (info.payload) {
    console.log('Token expiration:', new Date(info.payload.exp * 1000).toISOString());
    console.log('Current time:', new Date().toISOString());
    console.log('Time until expiration:', Math.floor((info.payload.exp * 1000 - Date.now()) / 1000 / 60), 'minutes');
    console.log('Token payload:', info.payload);
  }
  
  console.groupEnd();
}
