import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

export const TOKEN_KEY = 'pratibimba_token';

export async function setSecureToken(token: string): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(TOKEN_KEY, token),
    AsyncStorage.setItem(TOKEN_KEY, token),
  ]);
}

export async function getSecureToken(): Promise<string | null> {
  const secureToken = await SecureStore.getItemAsync(TOKEN_KEY);
  if (secureToken) {
    return secureToken;
  }
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function deleteSecureToken(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(TOKEN_KEY),
    AsyncStorage.removeItem(TOKEN_KEY),
  ]);
}
