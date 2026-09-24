import { createContext, useContext, useState, useEffect } from 'react'
import api, { setBusinessId, getBusinessId } from '../services/api.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [businesses, setBusinesses] = useState([])
  const [selectedBusiness, setSelectedBusiness] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      fetchUser(token)
    } else {
      setIsLoading(false)
    }
  }, [])

  const fetchUser = async (token) => {
    try {
      const response = await api.get('/auth/me')
      setUser(response.data.user)
      setBusinesses(response.data.user.businesses || [])
      // Restore selected business from localStorage if valid
      const savedBizId = getBusinessId()
      if (savedBizId && response.data.user.businesses?.some(b => b.business_id === savedBizId)) {
        setSelectedBusiness(savedBizId)
      } else if (response.data.user.businesses?.length > 0) {
        const firstBiz = response.data.user.businesses[0].business_id
        setSelectedBusiness(firstBiz)
        setBusinessId(firstBiz)
      }
    } catch {
      localStorage.removeItem('token')
      setBusinessId(null)
    } finally {
      setIsLoading(false)
    }
  }

  const selectBusiness = (businessId) => {
    setSelectedBusiness(businessId)
    setBusinessId(businessId)
  }

  const login = async (email, password) => {
    const response = await api.post('/auth/login', { email, password })
    const { user, token } = response.data
    localStorage.setItem('token', token)
    setUser(user)
    setBusinesses(user.businesses || [])
    if (user.businesses?.length > 0) {
      const firstBiz = user.businesses[0].business_id
      setSelectedBusiness(firstBiz)
      setBusinessId(firstBiz)
    }
    return user
  }

  const register = async (email, password, fullName) => {
    const response = await api.post('/auth/register', { email, password, fullName })
    const { user, token } = response.data
    localStorage.setItem('token', token)
    setUser(user)
    return user
  }

  const logout = () => {
    localStorage.removeItem('token')
    setBusinessId(null)
    setUser(null)
    setBusinesses([])
    setSelectedBusiness(null)
  }

  const value = {
    user,
    businesses,
    selectedBusiness,
    isLoading,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    selectBusiness,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
