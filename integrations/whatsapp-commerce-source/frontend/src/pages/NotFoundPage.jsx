import { Link } from 'react-router-dom'
import './NotFoundPage.css'

function NotFoundPage() {
  return (
    <div className="not-found-page">
      <div className="not-found-content">
        <span className="not-found-icon">🔍</span>
        <h1>404</h1>
        <h2>Page Not Found</h2>
        <p>The page you are looking for doesn't exist or has been moved.</p>
        <Link to="/" className="back-home-btn">
          ← Back to Dashboard
        </Link>
      </div>
    </div>
  )
}

export default NotFoundPage
