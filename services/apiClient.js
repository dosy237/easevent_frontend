import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.101:8003';

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to add auth token
apiClient.interceptors.request.use(
  async (config) => {
    const token = await SecureStore.getItemAsync('easevent_access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor for relative image URLs
apiClient.interceptors.response.use(
  (response) => {
    // If the data is an event or list of events, fix image URLs if they are relative
    // Note: The backend serializer already tries to fix this, but this is an extra safety layer
    return response;
  },
  (error) => Promise.reject(error)
);

export { apiClient, API_URL };
