import React, { useState, useEffect } from 'react';
import { Search, Building, GraduationCap, Mail, ExternalLink, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import './custom.css';

const ConnectionFinder = () => {
  // Add debugging
  useEffect(() => {
    console.log('ConnectionFinder component mounted');
    console.log('Environment:', process.env.NODE_ENV);
    console.log('API Keys available:', {
      openai: !!process.env.REACT_APP_OPENAI_API_KEY,
      googleSearch: !!process.env.REACT_APP_GOOGLE_SEARCH_API_KEY,
      googleCSE: !!process.env.REACT_APP_GOOGLE_CSE_ID
    });
  }, []);

  const [formData, setFormData] = useState({
    targetCompany: '',
    previousCompany: '',
    school: '',
    yourName: ''
  });
  
  // Load API keys from environment variables (development only)
  const [apiKeys, setApiKeys] = useState({
    openai: process.env.NODE_ENV === 'development' ? process.env.REACT_APP_OPENAI_API_KEY || '' : '',
    googleSearch: process.env.NODE_ENV === 'development' ? process.env.REACT_APP_GOOGLE_SEARCH_API_KEY || '' : '',
    googleCSE: process.env.NODE_ENV === 'development' ? process.env.REACT_APP_GOOGLE_CSE_ID || '' : ''
  });
  
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchComplete, setSearchComplete] = useState(false);
  const [extractionLog, setExtractionLog] = useState([]);
  const [error, setError] = useState(null);

  // Add error boundary
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4 lg:p-8">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-4xl font-bold text-red-400 mb-4">Something went wrong</h1>
          <p className="text-slate-300 mb-4">{error.message}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  // Wrap all functions in try-catch
  const safeFunction = (fn, name) => {
    return async (...args) => {
      try {
        return await fn(...args);
      } catch (err) {
        console.error(`Error in ${name}:`, err);
        setError(err);
        throw err;
      }
    };
  };

  // TEST: Simple render first
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 blur-3xl rounded-full"></div>
            <h1 className="relative text-5xl lg:text-7xl font-bold bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-4">
              Connection<span className="text-white">Finder</span>
            </h1>
          </div>
          <p className="text-xl text-slate-300 max-w-3xl mx-auto leading-relaxed">
            AI-powered professional network discovery using advanced search algorithms and social media intelligence
          </p>
          <div className="flex justify-center mt-6 space-x-6">
            <div className="bg-gradient-to-r from-cyan-500/10 to-purple-500/10 backdrop-blur-sm rounded-full px-6 py-2 border border-cyan-500/30">
              <span className="text-cyan-400 font-semibold">🎯 Smart Targeting</span>
            </div>
            <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 backdrop-blur-sm rounded-full px-6 py-2 border border-purple-500/30">
              <span className="text-purple-400 font-semibold">🔍 Multi-Platform</span>
            </div>
            <div className="bg-gradient-to-r from-pink-500/10 to-cyan-500/10 backdrop-blur-sm rounded-full px-6 py-2 border border-pink-500/30">
              <span className="text-pink-400 font-semibold">📧 Email Patterns</span>
            </div>
          </div>
        </div>

        {/* Simple Test Form */}
        <div className="relative mb-12">
          <div className="absolute inset-0 bg-gradient-to-r from-slate-800/50 to-purple-800/30 rounded-2xl blur-xl"></div>
          <div className="relative bg-gradient-to-br from-slate-800/90 via-slate-800/80 to-purple-900/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-8">
            <h2 className="text-2xl font-bold text-white mb-4">🧪 Test Form</h2>
            <p className="text-slate-400 mb-6">This is a test to see if the component renders</p>
            
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Target Company"
                value={formData.targetCompany}
                onChange={(e) => setFormData({...formData, targetCompany: e.target.value})}
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:border-cyan-400 transition-all duration-200"
              />
              
              <button 
                onClick={() => alert('Form working!')}
                className="w-full bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 transform hover:scale-105"
              >
                Test Button
              </button>
            </div>
          </div>
        </div>

        {/* Debug Info */}
        <div className="bg-slate-800/50 rounded-lg p-4 text-sm text-slate-300">
          <p>Environment: {process.env.NODE_ENV}</p>
          <p>Component State: {JSON.stringify({loading, searchComplete, connections: connections.length})}</p>
        </div>
      </div>
    </div>
  );
};

export default ConnectionFinder;