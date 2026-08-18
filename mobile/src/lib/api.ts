import axios from 'axios';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { getSessionToken } from './secureStorage';

// Automatically detect host IP from Expo dev server or fallback to Android emulator host
const devHost = Constants.expoConfig?.hostUri?.split(':')[0];
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  (devHost ? `http://${devHost}:5001/api` : (Platform.OS === 'android' ? 'http://10.0.2.2:5001/api' : 'http://localhost:5001/api'));

const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
});

// Attach the ChainBudget JWT from hardware-backed SecureStore on every request.
// The old Asgardeo AsyncStorage tokens (cb_token, cb_id_token) are no longer used.
let csrfToken: string | null = null;

api.interceptors.request.use(async (config) => {
  const token = await getSessionToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Automatically fetch and attach CSRF token for state-changing requests
  if (config.method && ['post', 'put', 'patch', 'delete'].includes(config.method.toLowerCase())) {
    if (!csrfToken) {
      try {
        const res = await axios.get(`${API_URL}/auth/csrf-token`);
        csrfToken = res.data.csrfToken;
      } catch (err) {
        console.warn('Failed to fetch CSRF token:', err);
      }
    }
    if (csrfToken) {
      config.headers['X-CSRF-Token'] = csrfToken;
    }
  }

  return config;
});

export default api;
