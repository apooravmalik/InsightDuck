import React, { useState } from 'react';
import { Eye, EyeOff, Mail, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import logo from '../assets/id-logo.png';
import { API_URL } from '../config/config';

const AuthPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!formData.email || !formData.password) {
      setError('Please fill in all fields');
      setLoading(false);
      return;
    }

    if (!isLogin && formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    try {
      const endpoint = isLogin ? '/login' : '/register';
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email, password: formData.password })
      });
      const data = await response.json();

      if (response.ok) {
        if (isLogin) {
          if (data.session) {
            login(data.session); // Pass the entire session object
            navigate('/dashboard');
          } else {
            setError('Authentication successful but no session received');
          }
        } else {
          // After registration, prompt user to sign in
          setIsLogin(true);
          setError('Registration successful! Please sign in.');
        }
      } else {
        setError(data.detail || data.message || 'Authentication failed');
      }
    } catch (err) {
      setError('Network error. Please try again.');
      console.error('Auth error:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const toggleAuthMode = () => {
    setIsLogin(!isLogin);
    setFormData({ email: '', password: '', confirmPassword: '' });
    setError('');
  };

  return (
    <div className="min-h-screen bg-[#1E1C1C] text-[#E8E8E8] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 rounded-2xl mb-4">
            <img src={logo} alt="InsightDuck Logo" className="w-full h-auto" />
          </div>
          <h1 className="text-3xl font-bold text-[#F5D742] mb-2">InsightDuck</h1>
          <p className="text-[#A1A1A1]">Clean and prepare your CSV data with AI</p>
        </div>

        <div className="bg-[#2A2828] rounded-2xl shadow-xl p-8 border border-[#3F3F3F]">
          <div className="flex bg-[#1E1C1C] rounded-lg p-1 mb-6">
            <button
              onClick={() => isLogin || toggleAuthMode()}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                isLogin
                  ? 'bg-[#F5D742] text-[#1E1C1C] shadow-sm'
                  : 'text-[#A1A1A1] hover:text-[#E8E8E8]'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => !isLogin || toggleAuthMode()}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                !isLogin
                  ? 'bg-[#F5D742] text-[#1E1C1C] shadow-sm'
                  : 'text-[#A1A1A1] hover:text-[#E8E8E8]'
              }`}
            >
              Sign Up
            </button>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-900/50 border border-red-500/50 rounded-lg">
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-[#A1A1A1] mb-2">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-[#A1A1A1]" />
                </div>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full pl-10 pr-4 py-3 bg-[#1E1C1C] border border-[#3F3F3F] rounded-lg focus:ring-2 focus:ring-[#E0C53B] focus:border-[#E0C53B] transition-colors"
                  placeholder="Enter your email"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-[#A1A1A1] mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-[#A1A1A1]" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className="w-full pl-10 pr-12 py-3 bg-[#1E1C1C] border border-[#3F3F3F] rounded-lg focus:ring-2 focus:ring-[#E0C53B] focus:border-[#E0C53B] transition-colors"
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-[#A1A1A1] hover:text-[#E8E8E8]" />
                  ) : (
                    <Eye className="h-5 w-5 text-[#A1A1A1] hover:text-[#E8E8E8]" />
                  )}
                </button>
              </div>
            </div>

            {!isLogin && (
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-[#A1A1A1] mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock className="h-5 w-5 text-[#A1A1A1]" />
                    </div>
                    <input
                        type={showPassword ? "text" : "password"}
                        id="confirmPassword"
                        name="confirmPassword"
                        value={formData.confirmPassword}
                        onChange={handleInputChange}
                        className="w-full pl-10 pr-4 py-3 bg-[#1E1C1C] border border-[#3F3F3F] rounded-lg focus:ring-2 focus:ring-[#E0C53B] focus:border-[#E0C53B] transition-colors"
                        placeholder="Confirm your password"
                        required
                    />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#F5D742] text-[#1E1C1C] font-semibold py-3 px-4 rounded-lg hover:bg-[#E0C53B] focus:ring-2 focus:ring-[#F5D742] focus:ring-offset-2 focus:ring-offset-[#2A2828] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-[#1E1C1C] border-t-transparent mr-2"></div>
                  {isLogin ? 'Signing In...' : 'Creating Account...'}
                </div>
              ) : (
                isLogin ? 'Sign In' : 'Create Account'
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-[#A1A1A1]">
            {isLogin ? "Don't have an account? " : 'Already have an account? '}
            <button
              onClick={toggleAuthMode}
              className="text-[#F5D742] hover:text-[#E0C53B] font-medium transition-colors"
            >
              {isLogin ? 'Sign up here' : 'Sign in here'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;