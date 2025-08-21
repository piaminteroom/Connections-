import React, { useState, useEffect } from 'react';
import EmailVerifier from './EmailVerifier';

const ConnectionFinder = () => {
  const [formData, setFormData] = useState({
    targetCompany: '',
    previousCompany: '',
    school: '',
    yourName: ''
  });
  
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchComplete, setSearchComplete] = useState(false);
  const [logs, setLogs] = useState([]);

  const addLog = (message, type = 'info') => {
    setLogs(prev => [...prev, { message, type, timestamp: new Date().toLocaleTimeString() }]);
  };

  const findConnections = async () => {
    if (!formData.targetCompany || !formData.previousCompany || !formData.school || !formData.yourName) {
      alert('Please fill in all fields');
      return;
    }

    setLoading(true);
    setConnections([]);
    setLogs([]);
    setSearchComplete(false);

    try {
      addLog('Starting connection discovery...', 'info');
      
      // Step 1: Google Search for LinkedIn profiles
      addLog('Searching for LinkedIn profiles at target company...', 'info');
      
      if (!process.env.REACT_APP_GOOGLE_SEARCH_API_KEY || !process.env.REACT_APP_GOOGLE_CSE_ID) {
        addLog('Google API keys not configured. Please set up your environment variables.', 'error');
        setLoading(false);
        return;
      }

      // Step 1: Search for specific connections using targeted queries
      addLog('Searching for LinkedIn connections using targeted queries...', 'info');
      
      // Create targeted search queries
      const searchQueries = [
        {
          name: 'work alumni',
          query: `site:linkedin.com/in/ "${formData.targetCompany}" "${formData.previousCompany}"`,
          description: `People who worked at ${formData.previousCompany} and now work at ${formData.targetCompany}`
        },
        {
          name: 'school alumni', 
          query: `site:linkedin.com/in/ "${formData.targetCompany}" "${formData.school}"`,
          description: `People who went to ${formData.school} and now work at ${formData.targetCompany}`
        }
      ];

      let allSearchResults = [];
      
      for (const searchType of searchQueries) {
        addLog(`Searching for ${searchType.name}: ${searchType.description}`, 'info');
        addLog(`Search query: ${searchType.query}`, 'info');
        
        const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${process.env.REACT_APP_GOOGLE_SEARCH_API_KEY}&cx=${process.env.REACT_APP_GOOGLE_CSE_ID}&q=${encodeURIComponent(searchType.query)}&num=10`;
        
        const searchResponse = await fetch(searchUrl);
        
        if (!searchResponse.ok) {
          const errorText = await searchResponse.text();
          addLog(`Google Search API error for ${searchType.name}: ${searchResponse.status} - ${errorText}`, 'warning');
          continue;
        }

        const searchData = await searchResponse.json();
        
        if (searchData.items && searchData.items.length > 0) {
          addLog(`Found ${searchData.items.length} ${searchType.name} profiles`, 'success');
          allSearchResults.push(...searchData.items.map(item => ({...item, connectionType: searchType.name})));
        } else {
          addLog(`No ${searchType.name} profiles found`, 'warning');
        }
        
        // Small delay between searches to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      if (allSearchResults.length === 0) {
        addLog(`No connections found. Try different search terms or check if people from ${formData.previousCompany} or ${formData.school} work at ${formData.targetCompany}.`, 'warning');
        setLoading(false);
        return;
      }

      addLog(`Found ${allSearchResults.length} total connection profiles!`, 'success');
      
      // Step 2: Process the targeted connection results
      addLog('Processing targeted connection results...', 'info');
      
      const processedConnections = [];
      let workAlumniCount = 0;
      let schoolAlumniCount = 0;
      
      for (let i = 0; i < allSearchResults.length; i++) {
        const item = allSearchResults[i];
        const title = item.title || '';
        const snippet = item.snippet || '';
        
        // Since these are targeted results, we already know the connection type
        const connectionType = item.connectionType;
        const connectionStrength = 'high';
        let connectionDetails = '';
        
        if (connectionType === 'work alumni') {
          connectionDetails = `Previously worked at ${formData.previousCompany}`;
          workAlumniCount++;
        } else if (connectionType === 'school alumni') {
          connectionDetails = `Graduated from ${formData.school}`;
          schoolAlumniCount++;
        }
        
        addLog(`Processing ${connectionType} profile ${i + 1}/${allSearchResults.length}: ${title}`, 'info');
        
        // Extract profile information
        const profileUrl = item.link;
        const extractedName = extractNameFromProfile(title);
        
        // Generate email patterns using the connection's name
        const emailPatterns = generateEmailPatterns(extractedName, formData.targetCompany);
        
        // Automatically verify emails
        addLog(`Automatically verifying emails for ${extractedName}...`, 'info');
        let verificationResults = [];
        try {
          verificationResults = await verifyEmailsAutomatically(emailPatterns);
          const validCount = verificationResults.filter(r => r.is_valid).length;
          addLog(`Email verification complete: ${validCount}/${emailPatterns.length} valid emails found`, validCount > 0 ? 'success' : 'warning');
        } catch (error) {
          addLog(`Email verification failed for ${extractedName}: ${error.message}`, 'warning');
        }

        const connection = {
          id: i + 1,
          profileUrl,
          title,
          snippet,
          extractedName,
          emailPatterns,
          verificationResults,
          connectionType,
          connectionStrength,
          connectionDetails,
          discoveredAt: new Date().toISOString()
        };

        processedConnections.push(connection);
        addLog(`Profile ${i + 1} processed successfully`, 'success');
        
        // Small delay to avoid overwhelming APIs
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
      // Summary of findings
      addLog(`Analysis complete! Found ${workAlumniCount} work alumni and ${schoolAlumniCount} school alumni connections at ${formData.targetCompany}`, 'success');
      
      if (processedConnections.length === 0) {
        addLog(`No connections found using targeted search. Try different search terms or variations of company/school names.`, 'warning');
      }

      setConnections(processedConnections);
      setSearchComplete(true);
      addLog(`Connection discovery complete! Found ${processedConnections.length} targeted connections from your network.`, 'success');
      
    } catch (error) {
      addLog(`Error: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const verifyEmailsAutomatically = async (emailPatterns) => {
    if (!emailPatterns || emailPatterns.length === 0) {
      return [];
    }

    try {
      // Add rate limiting - wait between requests
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Use batch verification if available
      if (emailPatterns.length > 1) {
        const response = await fetch('https://rapid-email-verifier.fly.dev/validate/batch', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ emails: emailPatterns })
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const results = await response.json();
        return results.map((result, index) => ({
          email: emailPatterns[index],
          ...result,
          verified: true
        }));
      } else {
        // Single email verification
        const response = await fetch(`https://rapid-email-verifier.fly.dev/validate?email=${encodeURIComponent(emailPatterns[0])}`);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        return [{
          email: emailPatterns[0],
          ...result,
          verified: true
        }];
      }
    } catch (error) {
      // Return failed verification results
      return emailPatterns.map(email => ({
        email,
        is_valid: false,
        is_disposable: false,
        has_mx_record: false,
        suggestion: '',
        verified: false,
        error: error.message
      }));
    }
  };

  const generateNameVariations = (name) => {
    if (!name) return [];
    
    const variations = [];
    const cleanName = name.toLowerCase().trim();
    
    // Add the original name
    variations.push(cleanName);
    
    // Add common abbreviations and variations
    // Remove common company suffixes
    const suffixesToRemove = [' inc', ' inc.', ' corporation', ' corp', ' corp.', ' company', ' co', ' co.', ' ltd', ' ltd.', ' llc', ' university', ' college', ' school', ' institute'];
    let shortName = cleanName;
    
    for (const suffix of suffixesToRemove) {
      if (shortName.endsWith(suffix)) {
        shortName = shortName.replace(suffix, '').trim();
        variations.push(shortName);
        break;
      }
    }
    
    // Add acronyms for multi-word names
    const words = cleanName.split(' ').filter(word => word.length > 0);
    if (words.length > 1) {
      const acronym = words.map(word => word[0]).join('');
      if (acronym.length >= 2) {
        variations.push(acronym);
      }
    }
    
    // Add partial matches for long names
    if (words.length > 2) {
      // First two words
      variations.push(words.slice(0, 2).join(' '));
      // Last two words  
      variations.push(words.slice(-2).join(' '));
    }
    
    return [...new Set(variations)]; // Remove duplicates
  };

  const extractNameFromProfile = (profileTitle) => {
    // LinkedIn profile titles usually start with the person's name
    // Examples: "John Smith - Software Engineer at Google", "Jane Doe | Marketing Manager"
    
    // Remove common separators and extract the first part
    const separators = [' - ', ' | ', ' at ', ' • '];
    let name = profileTitle;
    
    for (const separator of separators) {
      const index = name.indexOf(separator);
      if (index !== -1) {
        name = name.substring(0, index).trim();
        break;
      }
    }
    
    // Clean up any remaining artifacts and return the name
    name = name.replace(/[^\w\s]/g, '').trim();
    
    // If we couldn't extract a proper name, return a placeholder
    if (!name || name.length < 2) {
      return 'FirstName LastName';
    }
    
    return name;
  };

  const generateEmailPatterns = (name, company) => {
    const nameParts = name.toLowerCase().split(' ');
    const firstName = nameParts[0] || 'firstname';
    const lastName = nameParts[nameParts.length - 1] || 'lastname';
    const companyDomain = company.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    const patterns = [
      `${firstName}.${lastName}@${companyDomain}.com`,
      `${firstName}${lastName}@${companyDomain}.com`,
      `${firstName[0]}${lastName}@${companyDomain}.com`,
      `${firstName}@${companyDomain}.com`,
      `${lastName}.${firstName}@${companyDomain}.com`
    ];
    
    return patterns;
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    addLog('Copied to clipboard!', 'success');
  };

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
              <span className="text-cyan-400 font-semibold">Smart Targeting</span>
            </div>
            <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 backdrop-blur-sm rounded-full px-6 py-2 border border-purple-500/30">
              <span className="text-purple-400 font-semibold">Multi-Platform</span>
            </div>
            <div className="bg-gradient-to-r from-pink-500/10 to-cyan-500/10 backdrop-blur-sm rounded-full px-6 py-2 border border-pink-500/30">
              <span className="text-pink-400 font-semibold">Email Patterns</span>
            </div>
          </div>
        </div>

        {/* Main Form */}
        <div className="relative mb-12">
          <div className="absolute inset-0 bg-gradient-to-r from-slate-800/50 to-purple-800/30 rounded-2xl blur-xl"></div>
          <div className="relative bg-gradient-to-br from-slate-800/90 via-slate-800/80 to-purple-900/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-8">
            <h2 className="text-2xl font-bold text-white mb-6">Find Professional Connections</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-2">Target Company *</label>
                <input
                  type="text"
                  placeholder="e.g., Google, Microsoft, Apple"
                  value={formData.targetCompany}
                  onChange={(e) => setFormData({...formData, targetCompany: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:border-cyan-400 transition-all duration-200"
                />
              </div>
              
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-2">Previous Company *</label>
                <input
                  type="text"
                  placeholder="e.g., Previous employer"
                  value={formData.previousCompany}
                  onChange={(e) => setFormData({...formData, previousCompany: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:border-cyan-400 transition-all duration-200"
                />
              </div>
              
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-2">School/University *</label>
                <input
                  type="text"
                  placeholder="e.g., Stanford, MIT, Harvard"
                  value={formData.school}
                  onChange={(e) => setFormData({...formData, school: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:border-cyan-400 transition-all duration-200"
                />
              </div>
              
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-2">Your Name *</label>
                <input
                  type="text"
                  placeholder="e.g., John Smith"
                  value={formData.yourName}
                  onChange={(e) => setFormData({...formData, yourName: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:border-cyan-400 transition-all duration-200"
                />
              </div>
            </div>
            
            <button 
              onClick={findConnections}
              disabled={loading}
              className="w-full bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 disabled:from-slate-600 disabled:to-slate-600 text-white font-semibold py-4 px-8 rounded-xl transition-all duration-200 transform hover:scale-105 disabled:transform-none disabled:cursor-not-allowed"
            >
              {loading ? 'Discovering Connections...' : 'Start Real-Time Discovery'}
            </button>
          </div>
        </div>

        <>
        {/* Results Section */}
        {connections.length > 0 && (
            <div className="relative mb-12">
              <div className="absolute inset-0 bg-gradient-to-r from-green-800/20 to-blue-800/20 rounded-2xl blur-xl"></div>
              <div className="relative bg-gradient-to-br from-slate-800/90 via-slate-800/80 to-green-900/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-8">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-white">Found Connections ({connections.length})</h2>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Work Alumni Column */}
                <div>
                  <h3 className="text-xl font-semibold text-blue-300 mb-4 flex items-center">
                    <span className="w-4 h-4 bg-blue-500 rounded-full mr-3"></span>
                    Work Alumni ({connections.filter(conn => conn.connectionType === 'work alumni').length})
                  </h3>
                  <div className="space-y-4">
                    <>
                    {connections
                      .filter(connection => connection.connectionType === 'work alumni')
                      .map((connection) => (
                   <div key={connection.id} className={`bg-slate-900/50 rounded-xl p-6 border ${
                     connection.connectionStrength === 'high' ? 'border-blue-500/50' :
                     connection.connectionStrength === 'medium' ? 'border-yellow-500/50' :
                     'border-slate-700/50'
                   }`}>
                     <div className="flex justify-between items-start mb-4">
                       <div className="flex-1">
                         <h3 className="text-lg font-semibold text-white">{connection.title}</h3>
                         {connection.connectionDetails && (
                           <p className="text-sm text-slate-300 mt-1">{connection.connectionDetails}</p>
                         )}
                         <div className="flex items-center space-x-2 mt-2">
                           <span className={`inline-block text-xs px-3 py-1 rounded-full font-medium ${
                             connection.connectionType === 'work alumni' ? 'bg-blue-900/50 text-blue-300 border border-blue-700/50' :
                             connection.connectionType === 'school alumni' ? 'bg-green-900/50 text-green-300 border border-green-700/50' :
                             connection.connectionType === 'role-based connection' ? 'bg-yellow-900/50 text-yellow-300 border border-yellow-700/50' :
                             'bg-slate-800 text-slate-400 border border-slate-600'
                           }`}>
                             {connection.connectionType.replace('-', ' ').toUpperCase()}
                           </span>
                           <span className={`inline-block text-xs px-2 py-1 rounded-full font-medium ${
                             connection.connectionStrength === 'high' ? 'bg-green-900/50 text-green-300 border border-green-700/50' :
                             connection.connectionStrength === 'medium' ? 'bg-yellow-900/50 text-yellow-300 border border-yellow-700/50' :
                             'bg-slate-800 text-slate-400 border border-slate-600'
                           }`}>
                             {connection.connectionStrength.toUpperCase()}
                           </span>
                         </div>
                       </div>
                       <span className="text-xs text-slate-400 bg-slate-800 px-2 py-1 rounded ml-4">#{connection.id}</span>
                     </div>
                    
                    <p className="text-slate-300 mb-4">{connection.snippet}</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <EmailVerifier 
                          emailPatterns={connection.emailPatterns}
                          connectionName={extractNameFromProfile(connection.title)}
                          connectionId={connection.id}
                          onVerificationComplete={(results) => {
                            // Update connection with verification results
                            const updatedConnections = connections.map(conn => 
                              conn.id === connection.id 
                                ? { ...conn, verificationResults: results }
                                : conn
                            );
                            setConnections(updatedConnections);
                          }}
                        />
                      </div>
                      
                      <div>
                        <h4 className="text-sm font-medium text-slate-400 mb-2">Profile Link</h4>
                        <a
                          href={connection.profileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded transition-colors"
                        >
                          View LinkedIn Profile
                        </a>
                      </div>
                    </div>
                    
                    {connection.verificationResults && connection.verificationResults.length > 0 && (
                      <div className="bg-green-900/20 rounded-lg p-4 border border-green-700/30 mb-4">
                        <h4 className="text-sm font-medium text-green-400 mb-2">Best Email Option</h4>
                        {(() => {
                          const bestEmail = connection.verificationResults.find(r => r.is_valid && !r.is_disposable)?.email || 
                                           connection.verificationResults.find(r => r.is_valid)?.email;
                          if (bestEmail) {
                            return (
                              <div className="flex items-center space-x-2">
                                <input
                                  type="text"
                                  value={bestEmail}
                                  readOnly
                                  className="flex-1 px-3 py-2 bg-green-900/50 border border-green-700/50 rounded text-white text-sm font-mono"
                                />
                                <button
                                  onClick={() => copyToClipboard(bestEmail)}
                                  className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition-colors"
                                >
                                  Copy
                                </button>
                              </div>
                            );
                          }
                          return <p className="text-green-300 text-sm">No valid emails found</p>;
                        })()}
                      </div>
                    )}
                    
                  </div>
                      ))}
                      {connections.filter(conn => conn.connectionType === 'work alumni').length === 0 && (
                        <div className="text-center py-8 text-slate-400">
                          <p>No work alumni found</p>
                        </div>
                      )}
                      </>
                    </div>
                  </div>

                  {/* School Alumni Column */}
                  <div>
                    <h3 className="text-xl font-semibold text-green-300 mb-4 flex items-center">
                      <span className="w-4 h-4 bg-green-500 rounded-full mr-3"></span>
                      School Alumni ({connections.filter(conn => conn.connectionType === 'school alumni').length})
                    </h3>
                    <div className="space-y-4">
                      <>
                      {connections
                        .filter(connection => connection.connectionType === 'school alumni')
                        .map((connection) => (
                          <div key={connection.id} className="bg-slate-900/50 rounded-xl p-6 border border-green-500/50">
                            <div className="flex justify-between items-start mb-4">
                              <div className="flex-1">
                                <h3 className="text-lg font-semibold text-white">{connection.title}</h3>
                                {connection.connectionDetails && (
                                  <p className="text-sm text-slate-300 mt-1">{connection.connectionDetails}</p>
                                )}
                                <div className="flex items-center space-x-2 mt-2">
                                  <span className="inline-block text-xs px-3 py-1 rounded-full font-medium bg-green-900/50 text-green-300 border border-green-700/50">
                                    {connection.connectionType.replace('-', ' ').toUpperCase()}
                                  </span>
                                  <span className="inline-block text-xs px-2 py-1 rounded-full font-medium bg-green-900/50 text-green-300 border border-green-700/50">
                                    {connection.connectionStrength.toUpperCase()}
                                  </span>
                                </div>
                              </div>
                              <span className="text-xs text-slate-400 bg-slate-800 px-2 py-1 rounded ml-4">#{connection.id}</span>
                            </div>
                           
                           <p className="text-slate-300 mb-4">{connection.snippet}</p>
                           
                           <div className="space-y-4">
                             <div>
                               <h4 className="text-sm font-medium text-slate-400 mb-2">Profile Link</h4>
                               <a
                                 href={connection.profileUrl}
                                 target="_blank"
                                 rel="noopener noreferrer"
                                 className="inline-block px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded transition-colors"
                               >
                                 View LinkedIn Profile
                               </a>
                             </div>
                             
                             {connection.verificationResults && connection.verificationResults.length > 0 && (
                               <div className="bg-green-900/20 rounded-lg p-4 border border-green-700/30">
                                 <h4 className="text-sm font-medium text-green-400 mb-2">Best Email Option</h4>
                                 {(() => {
                                   const bestEmail = connection.verificationResults.find(r => r.is_valid && !r.is_disposable)?.email || 
                                                    connection.verificationResults.find(r => r.is_valid)?.email;
                                   if (bestEmail) {
                                     return (
                                       <div className="flex items-center space-x-2">
                                         <input
                                           type="text"
                                           value={bestEmail}
                                           readOnly
                                           className="flex-1 px-3 py-2 bg-green-900/50 border border-green-700/50 rounded text-white text-sm font-mono"
                                         />
                                         <button
                                           onClick={() => copyToClipboard(bestEmail)}
                                           className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition-colors"
                                         >
                                           Copy
                                         </button>
                                       </div>
                                     );
                                   }
                                   return <p className="text-green-300 text-sm">No valid emails found</p>;
                                 })()}
                               </div>
                             )}
                           </div>
                          </div>
                        ))}
                        {connections.filter(conn => conn.connectionType === 'school alumni').length === 0 && (
                          <div className="text-center py-8 text-slate-400">
                            <p>No school alumni found</p>
                          </div>
                        )}
                        </>
                    </div>
                  </div>
                </div>
                
                {/* Verification Summary */}
                {connections.some(conn => conn.verificationResults) && (
                  <div className="mt-6 p-4 bg-gradient-to-r from-green-900/20 to-blue-900/20 rounded-lg border border-green-700/30">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-lg font-semibold text-green-400">Email Verification Summary</h3>
                      <button
                        onClick={() => {
                          const validEmails = connections
                            .filter(conn => conn.verificationResults?.some(r => r.is_valid))
                            .map(conn => {
                              const bestEmail = conn.verificationResults.find(r => r.is_valid && !r.is_disposable)?.email || 
                                               conn.verificationResults.find(r => r.is_valid)?.email;
                              return {
                                name: extractNameFromProfile(conn.title),
                                email: bestEmail,
                                connectionType: conn.connectionType,
                                company: formData.targetCompany
                              };
                            })
                            .filter(item => item.email);
                          
                          const csvContent = [
                            'Name,Email,Connection Type,Company',
                            ...validEmails.map(item => `"${item.name}","${item.email}","${item.connectionType}","${item.company}"`)
                          ].join('\n');
                          
                          const blob = new Blob([csvContent], { type: 'text/csv' });
                          const url = window.URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `verified_emails_${formData.targetCompany}_${new Date().toISOString().split('T')[0]}.csv`;
                          a.click();
                          window.URL.revokeObjectURL(url);
                          addLog(`Exported ${validEmails.length} verified emails to CSV`, 'success');
                        }}
                        className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded transition-colors"
                      >
                        Export Valid Emails
                      </button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-400">
                          {connections.filter(conn => conn.verificationResults?.some(r => r.is_valid)).length}
                        </div>
                        <div className="text-slate-300">Connections with Valid Emails</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-400">
                          {connections.reduce((total, conn) => 
                            total + (conn.verificationResults?.filter(r => r.is_valid).length || 0), 0
                          )}
                        </div>
                        <div className="text-slate-300">Total Valid Emails</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-yellow-400">
                          {connections.reduce((total, conn) => 
                            total + (conn.verificationResults?.filter(r => r.is_disposable).length || 0), 0
                          )}
                        </div>
                        <div className="text-slate-300">Disposable Emails</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-purple-400">
                          {connections.reduce((total, conn) => 
                            total + (conn.verificationResults?.length || 0), 0
                          )}
                        </div>
                        <div className="text-slate-300">Total Verified</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Logs Section */}
        {logs.length > 0 && (
          <div className="relative mb-12">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-800/20 to-purple-800/20 rounded-2xl blur-xl"></div>
            <div className="relative bg-gradient-to-br from-slate-800/90 via-slate-800/80 to-blue-900/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-8">
              <h2 className="text-2xl font-bold text-white mb-6">Discovery Logs</h2>
              
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {logs.map((log, index) => (
                  <div key={index} className={`flex items-center space-x-3 text-sm ${
                    log.type === 'error' ? 'text-red-400' :
                    log.type === 'warning' ? 'text-yellow-400' :
                    log.type === 'success' ? 'text-green-400' : 'text-slate-300'
                  }`}>
                    <span className="text-slate-500">{log.timestamp}</span>
                    <span className={`px-2 py-1 rounded text-xs ${
                      log.type === 'error' ? 'bg-red-900/30 text-red-400' :
                      log.type === 'warning' ? 'bg-yellow-900/30 text-yellow-400' :
                      log.type === 'success' ? 'bg-green-900/30 text-green-400' : 'bg-slate-800/50 text-slate-300'
                    }`}>
                      {log.type.toUpperCase()}
                    </span>
                    <span>{log.message}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        </>

        {/* Environment Info */}
        <div className="bg-slate-800/50 rounded-lg p-4 text-sm text-slate-300">
          <p>Environment: {process.env.NODE_ENV}</p>
          <p>API Keys: OpenAI {process.env.REACT_APP_OPENAI_API_KEY ? 'YES' : 'NO'}, Google {process.env.REACT_APP_GOOGLE_SEARCH_API_KEY ? 'YES' : 'NO'}</p>
          <p>Component State: {JSON.stringify({loading, searchComplete, connections: connections.length})}</p>
        </div>
      </div>
    </div>
  );
};

export default ConnectionFinder;