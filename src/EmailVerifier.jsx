import React, { useState, useEffect } from 'react';

const EmailVerifier = ({ emailPatterns, connectionName, connectionId, onVerificationComplete }) => {
  const [verificationResults, setVerificationResults] = useState([]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationComplete, setVerificationComplete] = useState(false);

  // Listen for bulk verification events
  useEffect(() => {
    const handleBulkVerification = (event) => {
      if (event.detail.connectionId === connectionId) {
        startVerification();
      }
    };

    window.addEventListener('verifyEmails', handleBulkVerification);
    return () => window.removeEventListener('verifyEmails', handleBulkVerification);
  }, [connectionId]);

  const verifySingleEmail = async (email) => {
    try {
      // Add rate limiting - wait 100ms between requests
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const response = await fetch(`https://rapid-email-verifier.fly.dev/validate?email=${encodeURIComponent(email)}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      return {
        email,
        ...result,
        verified: true
      };
    } catch (error) {
      console.error(`Error verifying ${email}:`, error);
      return {
        email,
        is_valid: false,
        is_disposable: false,
        has_mx_record: false,
        suggestion: '',
        verified: false,
        error: error.message
      };
    }
  };

  const verifyBatchEmails = async (emails) => {
    try {
      const response = await fetch('https://rapid-email-verifier.fly.dev/validate/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ emails })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const results = await response.json();
      return results.map((result, index) => ({
        email: emails[index],
        ...result,
        verified: true
      }));
    } catch (error) {
      console.error('Error in batch verification:', error);
      // Fallback to individual verification
      return await Promise.all(emails.map(email => verifySingleEmail(email)));
    }
  };

  const startVerification = async () => {
    if (!emailPatterns || emailPatterns.length === 0) {
      return;
    }

    setIsVerifying(true);
    setVerificationResults([]);
    setVerificationComplete(false);

    try {
      // Use batch verification if available, otherwise fall back to individual
      let results;
      if (emailPatterns.length > 1) {
        results = await verifyBatchEmails(emailPatterns);
      } else {
        results = [await verifySingleEmail(emailPatterns[0])];
      }

      setVerificationResults(results);
      setVerificationComplete(true);
      
      // Notify parent component
      if (onVerificationComplete) {
        onVerificationComplete(results);
      }
    } catch (error) {
      console.error('Verification failed:', error);
    } finally {
      setIsVerifying(false);
    }
  };

  const getVerificationStatus = (result) => {
    if (!result.verified) return 'error';
    if (result.is_valid) return 'success';
    if (result.suggestion) return 'warning';
    return 'error';
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'success': return 'text-green-400 bg-green-900/30 border-green-700/50';
      case 'warning': return 'text-yellow-400 bg-yellow-900/30 border-yellow-700/50';
      case 'error': return 'text-red-400 bg-red-900/30 border-red-700/50';
      default: return 'text-slate-400 bg-slate-800/50 border-slate-600';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'success': return '✓';
      case 'warning': return '⚠';
      case 'error': return '✗';
      default: return '?';
    }
  };

  return (
    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-medium text-slate-400">
          Email Verification for {connectionName}
        </h4>
        {!verificationComplete && (
          <button
            onClick={startVerification}
            disabled={isVerifying}
            className="px-3 py-1 bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-600 text-white text-xs rounded transition-colors"
          >
            {isVerifying ? 'Verifying...' : 'Verify Emails'}
          </button>
        )}
      </div>

      {verificationResults.length > 0 && (
        <div className="space-y-3">
          {verificationResults.map((result, index) => {
            const status = getVerificationStatus(result);
            const statusColor = getStatusColor(status);
            const statusIcon = getStatusIcon(status);
            
            return (
              <div key={index} className="bg-slate-900/50 rounded-lg p-3 border border-slate-600/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-white font-mono">{result.email}</span>
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${statusColor}`}>
                    <span className="mr-1">{statusIcon}</span>
                    {result.is_valid ? 'Valid' : 'Invalid'}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center space-x-2">
                    <span className={`w-2 h-2 rounded-full ${
                      result.has_mx_record ? 'bg-green-400' : 'bg-red-400'
                    }`}></span>
                    <span className="text-slate-300">MX Record</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`w-2 h-2 rounded-full ${
                      result.is_disposable ? 'bg-yellow-400' : 'bg-green-400'
                    }`}></span>
                    <span className="text-slate-300">Disposable</span>
                  </div>
                </div>
                
                {result.suggestion && (
                  <div className="mt-2 p-2 bg-yellow-900/20 border border-yellow-700/30 rounded text-xs text-yellow-300">
                    <strong>Suggestion:</strong> {result.suggestion}
                  </div>
                )}
                
                {result.error && (
                  <div className="mt-2 p-2 bg-red-900/20 border border-red-700/30 rounded text-xs text-red-300">
                    <strong>Error:</strong> {result.error}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {verificationComplete && verificationResults.length > 0 && (
        <div className="mt-4 p-3 bg-slate-900/30 rounded-lg border border-slate-600/30">
          <div className="text-xs text-slate-400">
            <strong>Summary:</strong> {verificationResults.filter(r => r.is_valid).length} valid, {verificationResults.filter(r => !r.is_valid).length} invalid
          </div>
          <div className="text-xs text-slate-400 mt-1">
            <strong>Best option:</strong> {verificationResults.find(r => r.is_valid && !r.is_disposable)?.email || verificationResults.find(r => r.is_valid)?.email || 'None'}
          </div>
        </div>
      )}
    </div>
  );
};

export default EmailVerifier;
