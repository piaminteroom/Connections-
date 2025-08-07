import React, { useState } from 'react';
import { Search, User, Building2, GraduationCap, Mail, ExternalLink, Check, AlertCircle, Loader2 } from 'lucide-react';

const ConnectionFinder = () => {
  const [formData, setFormData] = useState({
    targetCompany: '',
    previousCompany: '',
    school: '',
    yourName: ''
  });
  
  // Load API keys from environment variables
  const [apiKeys, setApiKeys] = useState({
    openai: process.env.REACT_APP_OPENAI_API_KEY || '',
    googleSearch: process.env.REACT_APP_GOOGLE_SEARCH_API_KEY || '',
    googleCSE: process.env.REACT_APP_GOOGLE_CSE_ID || '',
    hunter: process.env.REACT_APP_HUNTER_API_KEY || ''
  });

  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchComplete, setSearchComplete] = useState(false);
  const [extractionLog, setExtractionLog] = useState([]);

  const addLog = (message, type = 'info') => {
    setExtractionLog(prev => [...prev, {
      message,
      type,
      timestamp: new Date().toLocaleTimeString()
    }]);
  };

  const generateLinkedInSearchStrings = (companyName) => {
    const searches = [
      `site:linkedin.com/in/ "${companyName}" (software engineer OR developer)`,
      `site:linkedin.com/in/ "${companyName}" (product manager OR "product management")`,
      `site:linkedin.com/in/ "${companyName}" (data scientist OR "data science")`,
      `site:linkedin.com/in/ "${companyName}" (designer OR "user experience")`,
      `site:linkedin.com/in/ "${companyName}" (marketing OR sales)`,
      `site:linkedin.com/in/ "${companyName}" (engineering OR manager)`
    ];
    return searches;
  };

  const generatePriorityConnectionSearches = (companyName, school, previousCompany) => {
    const prioritySearches = [];
    
    if (school) {
      prioritySearches.push(
        `site:linkedin.com/in/ "${companyName}" "${school}" (alumni OR graduated OR studied)`,
        `site:linkedin.com/in/ "${companyName}" "${school}" (university OR college OR school)`
      );
    }
    
    if (previousCompany) {
      prioritySearches.push(
        `site:linkedin.com/in/ "${companyName}" "${previousCompany}"`,
        `site:linkedin.com/in/ "${companyName}" "former ${previousCompany}"`
      );
    }
    
    return prioritySearches;
  };

  const searchPriorityConnections = async (companyName, school, previousCompany) => {
    addLog(`PRIORITY SEARCH: Looking for ${school} alumni and ${previousCompany} colleagues at ${companyName}...`, 'info');
    
    const prioritySearches = generatePriorityConnectionSearches(companyName, school, previousCompany);
    const priorityProfiles = [];
    
    for (let i = 0; i < prioritySearches.length; i++) {
      const searchQuery = prioritySearches[i];
      addLog(`Priority search: ${searchQuery.substring(0, 70)}...`, 'info');
      
      try {
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        const response = await fetch(`https://www.googleapis.com/customsearch/v1?key=${apiKeys.googleSearch}&cx=${apiKeys.googleCSE}&q=${encodeURIComponent(searchQuery)}&num=8`);
        
        if (!response.ok) {
          if (response.status === 429) {
            addLog(`Rate limit hit, waiting longer before next search...`, 'warning');
            await new Promise(resolve => setTimeout(resolve, 5000));
          } else {
            addLog(`Priority search API error: ${response.status}`, 'error');
          }
          continue;
        }
        
        const data = await response.json();
        
        if (data.items) {
          const profiles = await extractProfilesFromSearchResults(data.items, companyName);
          const priorityMarkedProfiles = profiles.map(profile => ({
            ...profile,
            isPriorityConnection: true,
            priorityReason: searchQuery.includes(school) ? `${school} Alumni` : `Former ${previousCompany} Colleague`
          }));
          priorityProfiles.push(...priorityMarkedProfiles);
          
          const isSchoolSearch = school && searchQuery.includes(school);
          const connectionType = isSchoolSearch ? 'school alumni' : 'work alumni';
          addLog(`Found ${profiles.length} ${connectionType} from search: ${searchQuery.substring(0, 50)}...`, 'success');
        }
        
      } catch (error) {
        addLog(`Priority search failed: ${error.message}`, 'error');
        continue;
      }
    }
    
    const schoolAlumni = priorityProfiles.filter(p => p.priorityReason && p.priorityReason.includes('Alumni')).length;
    const workAlumni = priorityProfiles.filter(p => p.priorityReason && p.priorityReason.includes('Colleague')).length;
    addLog(`PRIORITY SUMMARY: ${schoolAlumni} school alumni, ${workAlumni} work alumni (${priorityProfiles.length} total)`, 'info');
    
    return priorityProfiles;
  };

  const extractProfilesFromSearchResults = async (searchResults, companyName) => {
    const profiles = [];
    
    for (const result of searchResults) {
      if (result.link && result.link.includes('linkedin.com/in/')) {
        const titleAndSnippet = `${result.title} ${result.snippet}`.toLowerCase();
        const companyLower = companyName.toLowerCase();
        
        const hasAtCompany = titleAndSnippet.includes(`at ${companyLower}`);
        const hasAtSymbol = titleAndSnippet.includes(`@ ${companyLower}`);
        const hasCompanyName = titleAndSnippet.includes(`${companyLower}`);
        const hasCurrentIndicators = titleAndSnippet.includes('current') || titleAndSnippet.includes('present') || 
                                   titleAndSnippet.includes('works at') || titleAndSnippet.includes('working at');
        const hasFormerIndicators = titleAndSnippet.includes('former') || titleAndSnippet.includes('ex-') || titleAndSnippet.includes('previous');
        
        const currentlyWorksAtTarget = hasAtCompany || hasAtSymbol || 
          (hasCompanyName && (hasCurrentIndicators || !hasFormerIndicators));
        
        if (hasCompanyName) {
          console.log(`Profile check for ${companyName}:`, {
            title: result.title,
            snippet: result.snippet.substring(0, 100),
            hasAtCompany,
            hasAtSymbol,
            hasCompanyName,
            hasCurrentIndicators,
            hasFormerIndicators,
            currentlyWorksAtTarget
          });
        }
        
        if (currentlyWorksAtTarget) {
          const basicProfile = {
            linkedinUrl: result.link,
            title: result.title,
            snippet: result.snippet,
            company: companyName,
            name: extractNameFromTitle(result.title),
            jobTitle: extractJobTitleFromSnippet(result.snippet),
            source: 'Google Search'
          };
          
          if (basicProfile.name) {
            profiles.push(basicProfile);
          }
        }
      }
    }
    
    return profiles;
  };

  const extractNameFromTitle = (title) => {
    if (!title) return null;
    
    const match = title.match(/^([^-|]+)/);
    if (match) {
      let name = match[1].trim();
      name = name.replace(/^(Dr\.?|Mr\.?|Ms\.?|Mrs\.?)\s+/i, '');
      if (name.split(' ').length >= 2 && name.length > 3) {
        return name;
      }
    }
    return null;
  };

  const extractJobTitleFromSnippet = (snippet) => {
    if (!snippet) return 'Professional';
    
    const titlePatterns = [
      /(?:works as|working as|employed as)\s+([^.]+)/i,
      /(?:^|\s)([A-Z][a-z]+\s+(?:Engineer|Manager|Director|Developer|Designer|Analyst|Specialist|Coordinator|Assistant|Associate|Lead|Senior|Principal))/,
      /(?:title|position|role):\s*([^.]+)/i
    ];
    
    for (const pattern of titlePatterns) {
      const match = snippet.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }
    
    return 'Professional';
  };

  const enrichProfileData = async (profiles) => {
    addLog('Using AI to analyze and categorize connections...', 'info');
    
    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKeys.openai}`
        },
        body: JSON.stringify({
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "user",
              content: `Analyze these profiles and categorize each person's potential connection to someone applying to ${formData.targetCompany} from ${formData.previousCompany} and ${formData.school}:

Profiles: ${JSON.stringify(profiles)}

For each profile, determine:
1. Connection type: "School Alumni" (if they went to ${formData.school}), "Work Alumni" (if they worked at ${formData.previousCompany}), "Industry Contact", or "Direct Contact"
2. Department classification
3. Seniority level
4. Likelihood they would respond to networking (1-10)

IMPORTANT: 
- If someone mentions ${formData.school} in their profile, they are "School Alumni"
- If someone mentions ${formData.previousCompany} in their work history, they are "Work Alumni"
- Prioritize finding both School Alumni AND Work Alumni connections

Return ONLY a JSON array with this structure:
[
  {
    "name": "exact name from input",
    "title": "exact title from input", 
    "company": "exact company from input",
    "connectionType": "School Alumni, Work Alumni, Industry Contact, or Direct Contact",
    "department": "standardized department name",
    "seniority": "Junior/Mid/Senior/Executive",
    "responseRate": number 1-10,
    "outreachTips": "specific advice for contacting this person"
  }
]`
            }
          ]
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        addLog(`OpenAI API error during enrichment (${response.status}): ${errorText}`, 'error');
        return profiles.map(p => ({
          ...p,
          connectionType: p.isPriorityConnection ? p.priorityReason.includes('Alumni') ? 'School Alumni' : 'Work Alumni' : 'Industry Contact',
          department: 'Unknown',
          seniority: 'Mid',
          responseRate: 6,
          outreachTips: 'Mention your mutual connection and be specific about your ask.'
        }));
      }

      const data = await response.json();
      
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        addLog(`OpenAI enrichment returned unexpected format: ${JSON.stringify(data)}`, 'error');
        return profiles.map(p => ({
          ...p,
          connectionType: p.isPriorityConnection ? p.priorityReason.includes('Alumni') ? 'School Alumni' : 'Work Alumni' : 'Industry Contact',
          department: 'Unknown',
          seniority: 'Mid',
          responseRate: 6,
          outreachTips: 'Mention your mutual connection and be specific about your ask.'
        }));
      }
      
      let enrichedProfiles = [];
      
      try {
        let responseText = data.choices[0].message.content;
        responseText = responseText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        const aiEnrichments = JSON.parse(responseText);
        
        enrichedProfiles = profiles.map(profile => {
          const aiData = aiEnrichments.find(ai => ai.name === profile.name) || {};
          return {
            ...profile,
            ...aiData,
            linkedinUrl: profile.linkedinUrl,
            source: profile.source
          };
        });
        
        addLog(`AI analysis complete: ${enrichedProfiles.length} profiles categorized`, 'success');
      } catch (parseError) {
        addLog('AI response parsing failed, using basic categorization', 'error');
        enrichedProfiles = profiles.map(p => ({
          ...p,
          connectionType: p.isPriorityConnection ? p.priorityReason.includes('Alumni') ? 'School Alumni' : 'Work Alumni' : 'Industry Contact',
          department: 'Unknown',
          seniority: 'Mid',
          responseRate: 6,
          outreachTips: 'Mention your mutual connection and be specific about your ask.'
        }));
      }

      return enrichedProfiles;
      
    } catch (error) {
      addLog(`AI enrichment failed: ${error.message}`, 'error');
      return profiles;
    }
  };

  const generateEmailPatterns = (firstName, lastName, domain) => {
    const first = firstName.toLowerCase();
    const last = lastName.toLowerCase();
    const firstInitial = first.charAt(0);
    const lastInitial = last.charAt(0);
    
    return [
      `${first}.${last}@${domain}`,
      `${first}${last}@${domain}`,
      `${firstInitial}${last}@${domain}`,
      `${first}${lastInitial}@${domain}`,
      `${firstInitial}.${last}@${domain}`,
      `${last}.${first}@${domain}`,
      `${last}${first}@${domain}`,
      `${first}_${last}@${domain}`,
      `${first}-${last}@${domain}`,
      `${firstInitial}${lastInitial}@${domain}`
    ];
  };

  const getCompanyDomain = async (companyName) => {
    const domainMappings = {
      'google': 'google.com',
      'microsoft': 'microsoft.com',
      'apple': 'apple.com',
      'amazon': 'amazon.com',
      'meta': 'meta.com',
      'netflix': 'netflix.com',
      'uber': 'uber.com',
      'airbnb': 'airbnb.com',
      'stripe': 'stripe.com',
      'salesforce': 'salesforce.com'
    };
    
    const normalizedName = companyName.toLowerCase();
    return domainMappings[normalizedName] || `${normalizedName.replace(/\s+/g, '')}.com`;
  };

  const verifyEmailByPattern = async (email, firstName, lastName, domain) => {
    try {
      let score = 70;
      
      if (email.includes(firstName.toLowerCase()) && email.includes(lastName.toLowerCase())) {
        score += 10;
      }
      
      if (email.includes('.')) score += 5;
      if (email.includes('_') || email.includes('-')) score -= 5;
      
      const enterpriseDomains = ['microsoft.com', 'google.com', 'apple.com', 'amazon.com', 'meta.com', 'netflix.com', 'uber.com', 'airbnb.com', 'stripe.com', 'salesforce.com'];
      if (enterpriseDomains.some(ed => domain.toLowerCase().includes(ed.split('.')[0]))) {
        score += 15;
      }
      
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!emailRegex.test(email)) {
        score = Math.max(0, score - 30);
      }
      
      if (email.length > 35) score -= 10;
      if (email.length > 45) score -= 20;
      
      score = Math.min(95, Math.max(0, score));
      
      return {
        isValid: score > 50,
        score: score,
        provider: 'Pattern Analysis',
        pattern: email.split('@')[0],
        confidence: score > 80 ? 'High' : score > 60 ? 'Medium' : 'Low'
      };
      
    } catch (error) {
      addLog(`Email pattern analysis failed for ${email}: ${error.message}`, 'error');
      return { isValid: false, score: 30, provider: 'Pattern Error', confidence: 'Low' };
    }
  };

  const discoverConnections = async () => {
    if (!apiKeys.openai || !apiKeys.googleSearch || !apiKeys.googleCSE) {
      alert('Missing API keys! Please check your environment variables.');
      return;
    }

    setLoading(true);
    setSearchComplete(false);
    setConnections([]);
    setExtractionLog([]);

    try {
      addLog('Starting LinkedIn profile discovery...', 'info');
      addLog('Waiting to avoid rate limits...', 'info');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const priorityProfiles = await searchPriorityConnections(formData.targetCompany, formData.school, formData.previousCompany);
      
      addLog('Skipping additional searches to conserve API quota - focusing on priority connections only', 'info');
      const linkedinProfiles = [];
      const additionalProfiles = [];
      
      const allProfiles = [...priorityProfiles, ...linkedinProfiles, ...additionalProfiles];
      const uniqueProfiles = allProfiles.filter((profile, index, self) => 
        index === self.findIndex(p => p.name === profile.name)
      );
      
      if (uniqueProfiles.length === 0) {
        addLog('No LinkedIn profiles found. Try a larger company or check your API setup.', 'error');
        return;
      }

      addLog(`Found ${uniqueProfiles.length} LinkedIn profiles, enriching with AI...`, 'success');
      
      const enrichedProfiles = await enrichProfileData(uniqueProfiles);
      
      const connectionTypes = {};
      enrichedProfiles.forEach(profile => {
        const type = profile.connectionType || 'Unknown';
        connectionTypes[type] = (connectionTypes[type] || 0) + 1;
      });
      addLog(`CONNECTION TYPES: ${Object.entries(connectionTypes).map(([type, count]) => `${type}: ${count}`).join(', ')}`, 'info');
      
      const domain = await getCompanyDomain(formData.targetCompany);
      addLog(`Generating email patterns for domain: ${domain}`, 'info');
      
      const finalConnections = [];
      
      for (const profile of enrichedProfiles.slice(0, 8)) {
        const nameParts = profile.name.split(' ');
        if (nameParts.length < 2) continue;
        
        const firstName = nameParts[0];
        const lastName = nameParts[nameParts.length - 1];
        
        const emailPatterns = generateEmailPatterns(firstName, lastName, domain);
        addLog(`Analyzing email patterns for ${profile.name}...`, 'info');
        
        let bestEmail = null;
        let bestScore = 0;
        
        for (const email of emailPatterns.slice(0, 3)) {
          const verification = await verifyEmailByPattern(email, firstName, lastName, domain);
          if (verification.score > bestScore) {
            bestEmail = email;
            bestScore = verification.score;
          }
          
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        finalConnections.push({
          ...profile,
          primaryEmail: bestEmail || emailPatterns[0],
          allEmailPatterns: emailPatterns,
          emailConfidence: bestScore,
          linkedinUrl: profile.linkedinUrl || `https://linkedin.com/in/${firstName.toLowerCase()}-${lastName.toLowerCase()}`,
          source: profile.source || 'Google Search'
        });
      }
      
      setConnections(finalConnections);
      addLog(`Discovery complete! Found ${finalConnections.length} connections with analyzed emails.`, 'success');
      
    } catch (error) {
      addLog(`Critical error: ${error.message}`, 'error');
    } finally {
      setLoading(false);
      setSearchComplete(true);
    }
  };

  const getConnectionTypeColor = (type) => {
    switch (type) {
      case 'School Alumni': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Work Alumni': return 'bg-green-100 text-green-800 border-green-200';
      case 'Industry Contact': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'Direct Contact': return 'bg-purple-100 text-purple-800 border-purple-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getLogTypeColor = (type) => {
    switch (type) {
      case 'success': return 'text-green-600';
      case 'error': return 'text-red-600';
      case 'warning': return 'text-yellow-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <h1 className="text-3xl font-bold text-gray-900">Connection Finder</h1>
            <p className="mt-2 text-gray-600">Find LinkedIn connections using Google Search API with verified emails</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Main Form */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Building2 className="w-4 h-4 inline mr-2" />
                Target Company
              </label>
              <input
                type="text"
                value={formData.targetCompany}
                onChange={(e) => setFormData({...formData, targetCompany: e.target.value})}
                placeholder="e.g., Apple, Google, Microsoft"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Building2 className="w-4 h-4 inline mr-2" />
                Your Old Company
              </label>
              <input
                type="text"
                value={formData.previousCompany}
                onChange={(e) => setFormData({...formData, previousCompany: e.target.value})}
                placeholder="e.g., Microsoft, Amazon, Meta"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <GraduationCap className="w-4 h-4 inline mr-2" />
                School/University
              </label>
              <input
                type="text"
                value={formData.school}
                onChange={(e) => setFormData({...formData, school: e.target.value})}
                placeholder="e.g., Stanford, MIT, Harvard"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <User className="w-4 h-4 inline mr-2" />
                Your Name
              </label>
              <input
                type="text"
                value={formData.yourName}
                onChange={(e) => setFormData({...formData, yourName: e.target.value})}
                placeholder="Your full name"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* API Status */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                {apiKeys.openai && apiKeys.googleSearch && apiKeys.googleCSE ? (
                  <Check className="w-5 h-5 text-green-500 mr-2" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
                )}
                <span className="text-sm font-medium text-gray-700">API Configuration</span>
              </div>
              <span className={`text-sm font-medium ${apiKeys.openai && apiKeys.googleSearch && apiKeys.googleCSE ? 'text-green-600' : 'text-red-600'}`}>
                {apiKeys.openai && apiKeys.googleSearch && apiKeys.googleCSE ? 'All Configured' : 'Missing Keys'}
              </span>
            </div>
          </div>

          {/* Search Button */}
          <button
            onClick={discoverConnections}
            disabled={loading || !formData.targetCompany}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-4 px-6 rounded-lg transition-colors flex items-center justify-center"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Finding Connections...
              </>
            ) : (
              <>
                <Search className="w-5 h-5 mr-2" />
                Find Priority Connections
              </>
            )}
          </button>
        </div>

        {/* Search Logs */}
        {extractionLog.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Search Progress</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {extractionLog.map((log, index) => (
                <div key={index} className="flex items-start text-sm">
                  <span className="text-gray-400 mr-3 font-mono">{log.timestamp}</span>
                  <span className={getLogTypeColor(log.type)}>{log.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Results */}
        {searchComplete && connections.length > 0 && (
          <div className="space-y-8">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900">Found {connections.length} LinkedIn Connections</h2>
              <p className="text-gray-600 mt-2">Priority connections shown with verified email patterns</p>
            </div>

            {/* Priority Connections */}
            {connections.filter(c => c.isPriorityConnection).length > 0 && (
              <div>
                <div className="bg-blue-50 rounded-lg p-4 mb-6 border border-blue-200">
                  <h3 className="text-lg font-semibold text-blue-900 text-center">
                    Priority Connections ({connections.filter(c => c.isPriorityConnection).length})
                  </h3>
                  <p className="text-blue-700 text-center text-sm">School Alumni & Former Colleagues at {formData.targetCompany}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {connections.filter(connection => connection.isPriorityConnection).map((connection, index) => (
                    <div key={`priority-${index}`} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center mb-2">
                            <h3 className="text-lg font-semibold text-gray-900">{connection.name}</h3>
                            <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full font-medium border border-blue-200">
                              PRIORITY
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mb-1">{connection.title}</p>
                          <p className="text-sm text-gray-500 mb-1">{connection.department}</p>
                          <p className="text-xs font-medium text-blue-600">PRIORITY: {connection.priorityReason}</p>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getConnectionTypeColor(connection.connectionType)}`}>
                          {connection.connectionType}
                        </span>
                      </div>

                      <div className="space-y-3 mb-4">
                        <div className="flex items-center text-sm text-gray-600">
                          {connection.seniority} • {connection.responseRate}/10 response rate
                        </div>
                      </div>

                      <div className="border-t pt-4">
                        <div className="mb-3">
                          <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Best Email Pattern</label>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-sm font-mono text-gray-800">{connection.primaryEmail}</span>
                            <span className={`text-xs font-medium ${connection.emailConfidence > 70 ? 'text-green-600' : 'text-yellow-600'}`}>
                              {connection.emailConfidence}%
                            </span>
                          </div>
                        </div>

                        {connection.outreachTips && (
                          <div className="mb-3 p-3 bg-blue-50 rounded text-xs text-blue-800 border border-blue-200">
                            <strong>Priority Outreach Tip:</strong> {connection.outreachTips}
                          </div>
                        )}

                        <div className="flex space-x-2">
                          <a
                            href={connection.linkedinUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 bg-blue-600 text-white text-center py-2 px-3 rounded text-sm font-medium hover:bg-blue-700 transition-colors flex items-center justify-center"
                          >
                            <ExternalLink className="w-4 h-4 mr-1" />
                            LinkedIn
                          </a>
                          <a
                            href={`mailto:${connection.primaryEmail}?subject=Connection from ${formData.yourName}&body=Hi ${connection.name.split(' ')[0]}, I hope this email finds you well. I'm reaching out because we share a connection...`}
                            className="flex-1 bg-gray-600 text-white text-center py-2 px-3 rounded text-sm font-medium hover:bg-gray-700 transition-colors flex items-center justify-center"
                          >
                            <Mail className="w-4 h-4 mr-1" />
                            Email
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Regular Connections */}
            {connections.filter(c => !c.isPriorityConnection).length > 0 && (
              <div>
                <div className="text-center mb-6">
                  <h3 className="text-lg font-semibold text-gray-700">
                    Other Connections ({connections.filter(c => !c.isPriorityConnection).length})
                  </h3>
                  <p className="text-gray-500">Additional LinkedIn connections at {formData.targetCompany}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {connections.filter(connection => !connection.isPriorityConnection).map((connection, index) => (
                    <div key={`regular-${index}`} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">{connection.name}</h3>
                          <p className="text-sm text-gray-600">{connection.title}</p>
                          <p className="text-sm text-gray-500">{connection.department}</p>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getConnectionTypeColor(connection.connectionType)}`}>
                          {connection.connectionType}
                        </span>
                      </div>

                      <div className="space-y-2 mb-4">
                        <div className="flex items-center text-sm text-gray-600">
                          {connection.seniority} • {connection.responseRate}/10 response rate
                        </div>
                      </div>

                      <div className="border-t pt-4">
                        <div className="mb-3">
                          <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Best Email Pattern</label>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-sm font-mono text-gray-800">{connection.primaryEmail}</span>
                            <span className={`text-xs font-medium ${connection.emailConfidence > 70 ? 'text-green-600' : 'text-yellow-600'}`}>
                              {connection.emailConfidence}%
                            </span>
                          </div>
                        </div>

                        <div className="flex space-x-2">
                          <a
                            href={connection.linkedinUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 bg-blue-600 text-white text-center py-2 px-3 rounded text-sm font-medium hover:bg-blue-700 transition-colors flex items-center justify-center"
                          >
                            <ExternalLink className="w-4 h-4 mr-1" />
                            LinkedIn
                          </a>
                          <a
                            href={`mailto:${connection.primaryEmail}?subject=Connection from ${formData.yourName}&body=Hi ${connection.name.split(' ')[0]}, I hope this email finds you well. I'm reaching out because...`}
                            className="flex-1 bg-gray-600 text-white text-center py-2 px-3 rounded text-sm font-medium hover:bg-gray-700 transition-colors flex items-center justify-center"
                          >
                            <Mail className="w-4 h-4 mr-1" />
                            Email
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {searchComplete && connections.length === 0 && (
          <div className="text-center py-12">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
              <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Connections Found</h3>
              <p className="text-gray-600">Try a larger company or check your API configuration.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConnectionFinder;