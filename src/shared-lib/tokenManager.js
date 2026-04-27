// plattr/client/src/shared-lib/tokenManager.js
// Save tokens to localStorage
export const setToken = (tokenData) => {
  localStorage.setItem('accessToken', tokenData.access);
  localStorage.setItem('refreshToken', tokenData.refresh);
};

// Get access token
export const getAccessToken = () => localStorage.getItem('accessToken');

// Clear all tokens
export const clearToken = () => {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
};