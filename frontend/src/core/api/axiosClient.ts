import axios from 'axios';

const axiosClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Interceptor for attaching tokens later
axiosClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

const onRefreshed = (token: string) => {
  refreshSubscribers.forEach((callback) => callback(token));
  refreshSubscribers = [];
};

const addRefreshSubscriber = (callback: (token: string) => void) => {
  refreshSubscribers.push(callback);
};

axiosClient.interceptors.response.use(
  (response) => {
    return response.data;
  },
  async (error) => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && originalRequest.url !== '/auth/login' && originalRequest.url !== '/auth/refresh-token') {
      if (!isRefreshing) {
        isRefreshing = true;
        try {
          const res = await axios.post(`${import.meta.env.VITE_API_URL || '/api'}/auth/refresh-token`, {}, { withCredentials: true });
          const newToken = res.data?.data?.accessToken;
          
          if (newToken) {
              localStorage.setItem('token', newToken);
              isRefreshing = false;
              onRefreshed(newToken);
              
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
              return axiosClient(originalRequest);
          } else {
              throw new Error("No token returned");
          }
        } catch (refreshError) {
          isRefreshing = false;
          refreshSubscribers = [];
          localStorage.removeItem('token');
          // Optional: clear user state in store if needed, or redirect
          window.location.href = '/login';
          return Promise.reject(refreshError);
        }
      } else {
        return new Promise((resolve) => {
          addRefreshSubscriber((token: string) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(axiosClient(originalRequest));
          });
        });
      }
    }
    
    // Handle error centrally
    return Promise.reject(error);
  }
);

export default axiosClient;
