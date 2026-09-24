import { useState } from 'react';
import { login } from '@/lib/tauri-api';

export default function LoginScreen({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password, tenantId);
      onLoggedIn();
    } catch (err) {
      setError(typeof err === 'string' ? err : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen flex items-center justify-center bg-gray-50">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-white border border-gray-200 rounded-lg p-6 space-y-4">
        <h1 className="text-lg font-bold text-gray-900">Sign in</h1>

        <div>
          <label className="text-sm text-gray-600">Tenant ID</label>
          <input
            className="w-full border border-gray-300 rounded px-3 py-2 mt-1"
            value={tenantId}
            onChange={e => setTenantId(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="text-sm text-gray-600">Email</label>
          <input
            type="email"
            className="w-full border border-gray-300 rounded px-3 py-2 mt-1"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="text-sm text-gray-600">Password</label>
          <input
            type="password"
            className="w-full border border-gray-300 rounded px-3 py-2 mt-1"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary-600 text-white rounded py-2 font-medium disabled:opacity-50"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
