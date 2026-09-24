const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'

class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

const handleResponse = async (response) => {
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new ApiError(data?.message || `HTTP ${response.status}: ${response.statusText}`, response.status)
  }
  return data
}

const request = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`
  const token = localStorage.getItem('token')
  const businessId = localStorage.getItem('businessId')

  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...(businessId && { 'X-Business-ID': businessId }),
      ...options.headers,
    },
    ...options,
  }

  if (config.body && typeof config.body === 'object') {
    config.body = JSON.stringify(config.body)
  }

  const response = await fetch(url, config)
  return handleResponse(response)
}

export const api = {
  get: (endpoint) => request(endpoint, { method: 'GET' }),
  post: (endpoint, body) => request(endpoint, { method: 'POST', body }),
  put: (endpoint, body) => request(endpoint, { method: 'PUT', body }),
  patch: (endpoint, body) => request(endpoint, { method: 'PATCH', body }),
  delete: (endpoint) => request(endpoint, { method: 'DELETE' }),
}

export const setBusinessId = (id) => {
  if (id) localStorage.setItem('businessId', id)
  else localStorage.removeItem('businessId')
}

export const getBusinessId = () => localStorage.getItem('businessId')

export const checkHealth = () => api.get('/health')

export default api
