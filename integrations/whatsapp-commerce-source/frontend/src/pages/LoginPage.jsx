import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import './LoginPage.css'

function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [isRegister, setIsRegister] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      if (isRegister) {
        await login.register(email, password, fullName)
      } else {
        await login(email, password)
      }
      navigate('/')
    } catch (err) {
      setError(err.message || 'Authentication failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <span className="login-logo">💬</span>
          <h1>WhatsApp Commerce</h1>
          <p>{isRegister ? 'Create your account' : 'Sign in to your account'}</p>
        </div>

        {error && <div className="error-banner">{error}</div>}

        <form onSubmit={handleSubmit} className="login-form">
          {isRegister && (
            <div className="form-group">
              <label htmlFor="fullName">Full Name</label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="John Doe"
                required
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>

          <button
            type="submit"
            className="login-btn"
            disabled={isLoading}
          >
            {isLoading
              ? (isRegister ? 'Creating account...' : 'Signing in...')
              : (isRegister ? 'Create Account' : 'Sign In')
            }
          </button>
        </form>

        <div className="login-footer">
          {isRegister ? (
            <p>Already have an account?{' '}
              <button className="link-btn" onClick={() => { setIsRegister(false); setError(''); }}>
                Sign in
              </button>
            </p>
          ) : (
            <p>Don't have an account?{' '}
              <button className="link-btn" onClick={() => { setIsRegister(true); setError(''); }}>
                Get started
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export default LoginPage
