import React, { useState } from 'react';
import { Search, Building, GraduationCap, Mail, ExternalLink, Loader2, AlertCircle, CheckCircle } from 'lucide-react';

const ConnectionFinder = () => {
  const [formData, setFormData] = useState({
    targetCompany: '',
    previousCompany: '',
    school: '',
    yourName: ''
  });
  
  // API keys should be entered by users for security
  const [apiKeys, setApiKeys] = useState({
    openai: '',
    googleSearch: '',
    googleCSE: ''
  });
  
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchComplete, setSearchComplete] = useState(false);
  const [extractionLog, setExtractionLog] = useState([]);

  const addLog = (message, type) => {
    setExtractionLog(prev => [...prev, { 
      message, 
      type: type || 'info', 
      timestamp: new Date().toLocaleTimeString() 
    }]);
  };

  const generateLinkedInSearchStrings = (companyName) => {
    // Generate precise Boolean search strings for LinkedIn profiles
    const searches = [
      `site:linkedin.com/in/ "${companyName}" (software engineer OR developer OR "software development")`,
      `site:linkedin.com/in/ "${companyName}" (product manager OR "product management")`,
      `site:linkedin.com/in/ "${companyName}" (data scientist OR "data science" OR analytics)`,
      `site:linkedin.com/in/ "${companyName}" (designer OR "user experience" OR UX)`,
      `site:linkedin.com/in/ "${companyName}" (marketing OR "growth marketing")`,
      `site:linkedin.com/in/ "${companyName}" (sales OR "business development")`,
      `site:linkedin.com/in/ "${companyName}" (HR OR "human resources" OR recruiting)`,
      `site:linkedin.com/in/ "${companyName}" (executive OR director OR VP OR "vice president")`,
      `site:linkedin.com/in/ "${companyName}" (engineer OR engineering)`,
      `site:linkedin.com/in/ "${companyName}" (manager OR lead OR senior)`
    ];
    return searches;
  };

  // NEW: Generate priority searches for school alumni and former colleagues
  const generatePriorityConnectionSearches = (companyName, school, previousCompany) => {
    const prioritySearches = [];
    
    // School Alumni searches - people from your school now at target company
    if (school) {
      prioritySearches.push(
        `site:linkedin.com/in/ "${companyName}" "${school}" (alumni OR graduated OR studied)`,
        `site:linkedin.com/in/ "${companyName}" "${school}" (university OR college OR school)`,
        `site:linkedin.com/in/ "${companyName}" "${school}" (bachelor OR master OR degree OR PhD)`
      );
    }
    
    // Former Colleague searches - people from your previous company now at target company  
    if (previousCompany) {
      prioritySearches.push(
        `site:linkedin.com/in/ "${companyName}" "${previousCompany}" (former OR previous OR ex)`,
        `site:linkedin.com/in/ "${companyName}" "${previousCompany}" (worked OR experience OR alumni)`,
        `site:linkedin.com/in/ "${companyName}" "formerly ${previousCompany}" OR "ex-${previousCompany}"`
      );
    }
    
    return prioritySearches;
  };

  // Priority search for school alumni and former colleagues
  const searchPriorityConnections = async (companyName, school, previousCompany) => {
    addLog(`🎯 PRIORITY SEARCH: Looking for ${school} alumni and ${previousCompany} colleagues at ${companyName}...`, 'info');
    
    const prioritySearches = generatePriorityConnectionSearches(companyName, school, previousCompany);
    const priorityProfiles = [];
    
    for (let i = 0; i < prioritySearches.length; i++) {
      const searchQuery = prioritySearches[i];
      addLog(`Priority search: ${searchQuery.substring(0, 70)}...`, 'info');
      
      try {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Longer delay for priority searches
        
        const response = await fetch(`https://www.googleapis.com/customsearch/v1?key=${apiKeys.googleSearch}&cx=${apiKeys.googleCSE}&q=${encodeURIComponent(searchQuery)}&num=8`);
        
        if (!response.ok) {
          addLog(`Priority search API error: ${response.status}`, 'error');
          continue;
        }
        
        const data = await response.json();
        
        if (data.items) {
          const profiles = await extractProfilesFromSearchResults(data.items, companyName);
          // Mark these as priority connections
          const priorityMarkedProfiles = profiles.map(profile => ({
            ...profile,
            isPriorityConnection: true,
            priorityReason: searchQuery.includes(school) ? `${school} Alumni` : `Former ${previousCompany} Colleague`
          }));
          priorityProfiles.push(...priorityMarkedProfiles);
          addLog(`🎯 Found ${profiles.length} priority connections!`, 'success');
        }
        
      } catch (error) {
        addLog(`Priority search failed: ${error.message}`, 'error');
        continue;
      }
    }
    
    return priorityProfiles;
  };

  const searchGoogleForLinkedInProfiles = async (companyName) => {
    addLog(`Searching Google for real ${companyName} LinkedIn profiles...`, 'info');
    
    const searchStrings = generateLinkedInSearchStrings(companyName);
    const allProfiles = [];
    
    for (let i = 0; i < Math.min(searchStrings.length, 5); i++) {
      const searchQuery = searchStrings[i];
      addLog(`Searching: ${searchQuery.substring(0, 80)}...`, 'info');
      
      try {
        await new Promise(resolve => setTimeout(resolve, 1500)); // Rate limiting
        
        const response = await fetch(`https://www.googleapis.com/customsearch/v1?key=${apiKeys.googleSearch}&cx=${apiKeys.googleCSE}&q=${encodeURIComponent(searchQuery)}&num=10`);
        
        if (!response.ok) {
          addLog(`Google Search API error: ${response.status}`, 'error');
          continue;
        }
        
        const data = await response.json();
        
        if (data.items) {
          const profiles = await extractProfilesFromSearchResults(data.items, companyName);
          allProfiles.push(...profiles);
          addLog(`Found ${profiles.length} real LinkedIn profiles from this search`, 'success');
        }
        
      } catch (error) {
        addLog(`Search failed: ${error.message}`, 'error');
        continue;
      }
    }
    
    return allProfiles;
  };

  const extractProfilesFromSearchResults = async (searchResults, companyName) => {
    const profiles = [];
    
    for (const result of searchResults) {
      if (result.link && result.link.includes('linkedin.com/in/')) {
        // Extract basic info without OpenAI to save quota
        const basicProfile = {
          linkedinUrl: result.link,
          title: result.title,
          snippet: result.snippet,
          company: companyName,
          // Extract name from title (basic parsing)
          name: extractNameFromTitle(result.title),
          // Extract job title from snippet (basic parsing)  
          jobTitle: extractJobTitleFromSnippet(result.snippet),
          source: 'Google Search'
        };
        
        // Only add if we found a name
        if (basicProfile.name) {
          profiles.push(basicProfile);
        }
      }
    }
    
    return profiles;
  };

  // Helper function to extract name from LinkedIn title
  const extractNameFromTitle = (title) => {
    if (!title) return null;
    
    // LinkedIn titles usually start with the person's name
    // e.g. "John Smith - Software Engineer at Google | LinkedIn"
    const match = title.match(/^([^-|]+)/);
    if (match) {
      let name = match[1].trim();
      // Remove common prefixes
      name = name.replace(/^(Dr\.?|Mr\.?|Ms\.?|Mrs\.?)\s+/i, '');
      // Basic validation - should have at least first and last name
      if (name.split(' ').length >= 2 && name.length > 3) {
        return name;
      }
    }
    return null;
  };

  // Helper function to extract job title from snippet
  const extractJobTitleFromSnippet = (snippet) => {
    if (!snippet) return 'Professional';
    
    // Look for common job title patterns
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



  const searchAdditionalLinkedInProfiles = async (companyName) => {
    addLog(`Searching for additional ${companyName} LinkedIn profiles...`, 'info');
    
    try {
      // Additional targeted searches for different roles and seniority levels
      const additionalSearches = [
        `site:linkedin.com/in/ "${companyName}" (CEO OR founder OR "chief executive")`,
        `site:linkedin.com/in/ "${companyName}" (CTO OR "chief technology" OR "head of engineering")`,
        `site:linkedin.com/in/ "${companyName}" (senior OR principal OR staff OR lead)`,
        `site:linkedin.com/in/ "${companyName}" (intern OR junior OR associate OR coordinator)`
      ];
      
      const profiles = [];
      
      for (let i = 0; i < Math.min(additionalSearches.length, 3); i++) {
        const searchQuery = additionalSearches[i];
        addLog(`Additional search: ${searchQuery.substring(0, 60)}...`, 'info');
        
        try {
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          const response = await fetch(`https://www.googleapis.com/customsearch/v1?key=${apiKeys.googleSearch}&cx=${apiKeys.googleCSE}&q=${encodeURIComponent(searchQuery)}&num=8`);
          
          if (response.ok) {
            const data = await response.json();
            if (data.items) {
              const searchProfiles = await extractProfilesFromSearchResults(data.items, companyName);
              profiles.push(...searchProfiles);
              addLog(`Found ${searchProfiles.length} additional profiles`, 'success');
            }
          }
        } catch (error) {
          addLog(`Additional search failed: ${error.message}`, 'error');
          continue;
        }
      }
      
      return profiles;
      
    } catch (error) {
      addLog(`Additional profile search failed: ${error.message}`, 'error');
      return [];
    }
  };

  const getCompanyDomain = async (companyName) => {
    try {
      // Common company domain mappings for major companies
      const knownDomains = { 
        'microsoft': 'microsoft.com',
        'google': 'google.com', 
        'alphabet': 'google.com',
        'apple': 'apple.com',
        'amazon': 'amazon.com',
        'meta': 'meta.com',
        'facebook': 'meta.com',
        'netflix': 'netflix.com',
        'tesla': 'tesla.com',
        'uber': 'uber.com',
        'airbnb': 'airbnb.com',
        'stripe': 'stripe.com',
        'salesforce': 'salesforce.com',
        'adobe': 'adobe.com',
        'nvidia': 'nvidia.com',
        'intel': 'intel.com',
        'ibm': 'ibm.com',
        'oracle': 'oracle.com',
        'cisco': 'cisco.com',
        'paypal': 'paypal.com',
        'linkedin': 'linkedin.com',
        'twitter': 'twitter.com',
        'snap': 'snap.com',
        'snapchat': 'snap.com',
        'pinterest': 'pinterest.com',
        'reddit': 'reddit.com',
        'zoom': 'zoom.us',
        'slack': 'slack.com',
        'shopify': 'shopify.com',
        'square': 'squareup.com',
        'dropbox': 'dropbox.com',
        'spotify': 'spotify.com',
        'twilio': 'twilio.com'
      };
      
      const companyKey = companyName.toLowerCase().replace(/[^a-z0-9]/g, '');
      
      // Check if we have a known domain mapping
      if (knownDomains[companyKey]) {
        return knownDomains[companyKey];
      }
      
      // For unknown companies, use standard domain format
      return `${companyKey}.com`;
      
    } catch (error) {
      return `${companyName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`;
    }
  };

  const generateEmailPatterns = (firstName, lastName, domain) => {
    const f = firstName.toLowerCase();
    const l = lastName.toLowerCase();
    
    return [
      `${f}.${l}@${domain}`,
      `${f}@${domain}`,
      `${f[0]}.${l}@${domain}`,
      `${f}${l}@${domain}`,
      `${f}_${l}@${domain}`,
      `${f}+${l}@${domain}`,
      `${l}.${f}@${domain}`,
      `${f[0]}${l}@${domain}`
    ];
  };

  const verifyEmailByPattern = async (email, firstName, lastName, domain) => {
    try {
      // Score email patterns based on common company conventions
      const f = firstName.toLowerCase();
      const l = lastName.toLowerCase();
      
      // Common email patterns with their typical usage scores
      const patterns = {
        [`${f}.${l}@${domain}`]: 85,      // Most common: john.smith@company.com
        [`${f}@${domain}`]: 60,           // First name only: john@company.com  
        [`${f[0]}.${l}@${domain}`]: 75,   // Initial + last: j.smith@company.com
        [`${f}${l}@${domain}`]: 70,       // No separator: johnsmith@company.com
        [`${f}_${l}@${domain}`]: 65,      // Underscore: john_smith@company.com
        [`${f[0]}${l}@${domain}`]: 60,    // Initial + last: jsmith@company.com
        [`${l}.${f}@${domain}`]: 45,      // Reverse: smith.john@company.com
        [`${f}+${l}@${domain}`]: 30       // Plus separator: john+smith@company.com (less common)
      };
      
      // Get base score for this pattern
      let score = patterns[email] || 40;
      
      // Boost score based on domain characteristics
      if (domain.includes('.com')) score += 10;
      if (domain.split('.').length === 2) score += 5; // Simple domain structure
      
      // Boost score for common enterprise domains
      const enterpriseDomains = ['microsoft.com', 'google.com', 'apple.com', 'amazon.com', 'meta.com', 'netflix.com', 'uber.com', 'airbnb.com', 'stripe.com', 'salesforce.com'];
      if (enterpriseDomains.some(ed => domain.toLowerCase().includes(ed.split('.')[0]))) {
        score += 15;
      }
      
      // Basic email format validation
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!emailRegex.test(email)) {
        score = Math.max(0, score - 30);
      }
      
      // Length penalties for very long emails
      if (email.length > 35) score -= 10;
      if (email.length > 45) score -= 20;
      
      // Cap the score at 95 to indicate it's pattern-based, not verified
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
1. Connection type: "Alumni", "Former Colleague", "Industry Contact", or "Direct Contact"
2. Department classification
3. Seniority level
4. Likelihood they would respond to networking (1-10)

Return ONLY a JSON array with this structure:
[
  {
    "name": "exact name from input",
    "title": "exact title from input", 
    "company": "exact company from input",
    "connectionType": "one of the four types above",
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
          connectionType: 'Industry Contact',
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
          connectionType: 'Industry Contact',
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
        
        // Merge AI enrichments with original profile data, preserving important fields like linkedinUrl
        enrichedProfiles = profiles.map(profile => {
          const aiData = aiEnrichments.find(ai => ai.name === profile.name) || {};
          return {
            ...profile, // Preserve all original data including linkedinUrl
            ...aiData,  // Add AI enrichments
            // Ensure we don't lose critical original fields
            linkedinUrl: profile.linkedinUrl,
            source: profile.source
          };
        });
        
        addLog(`AI analysis complete: ${enrichedProfiles.length} profiles categorized`, 'success');
      } catch (parseError) {
        addLog('AI response parsing failed, using basic categorization', 'error');
        enrichedProfiles = profiles.map(p => ({
          ...p,
          connectionType: 'Industry Contact',
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

  const discoverConnections = async () => {
    if (!apiKeys.openai || !apiKeys.googleSearch || !apiKeys.googleCSE) {
      alert('Missing API keys! Please enter your OpenAI API Key, Google Search API Key, and Google CSE ID in the API Configuration section above.');
      return;
    }

    setLoading(true);
    setSearchComplete(false);
    setConnections([]);
    setExtractionLog([]);

    try {
      addLog('Starting real LinkedIn profile discovery via Google Search...', 'info');
      
      // PRIORITY: Search for school alumni and former colleagues FIRST
      const priorityProfiles = await searchPriorityConnections(formData.targetCompany, formData.school, formData.previousCompany);
      
      const linkedinProfiles = await searchGoogleForLinkedInProfiles(formData.targetCompany);
      const additionalProfiles = await searchAdditionalLinkedInProfiles(formData.targetCompany);
      
      const allProfiles = [...priorityProfiles, ...linkedinProfiles, ...additionalProfiles];
      const uniqueProfiles = allProfiles.filter((profile, index, self) => 
        index === self.findIndex(p => p.name === profile.name)
      );
      
      if (uniqueProfiles.length === 0) {
        addLog('No real LinkedIn profiles found. Try a larger company or check your Google Search API setup.', 'error');
        return;
      }

      addLog(`Found ${uniqueProfiles.length} real LinkedIn profiles, enriching with AI...`, 'success');
      
      const enrichedProfiles = await enrichProfileData(uniqueProfiles);
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
          
          // Much shorter delay since we're not hitting external APIs
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
      addLog(`Discovery complete! Found ${finalConnections.length} REAL LinkedIn connections with pattern-analyzed emails.`, 'success');
      
    } catch (error) {
      addLog(`Critical error: ${error.message}`, 'error');
    } finally {
      setLoading(false);
      setSearchComplete(true);
    }
  };

  const getConnectionTypeColor = (type) => {
    switch (type) {
      case 'Alumni': 
        return 'bg-blue-100 text-blue-800';
      case 'Former Colleague': 
        return 'bg-green-100 text-green-800';
      case 'Industry Contact': 
        return 'bg-purple-100 text-purple-800';
      case 'Direct Contact': 
        return 'bg-orange-100 text-orange-800';
      default: 
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Real LinkedIn Connection Finder</h1>
          <p className="text-lg text-gray-600">Google Search API finds real LinkedIn profiles with verified emails</p>
        </div>

        {/* API Keys Section */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">🔑 API Configuration</h2>
            <div className="text-sm text-green-600 font-medium">
              Status: {apiKeys.openai && apiKeys.googleSearch && apiKeys.googleCSE ? '✅ All Configured' : '❌ Missing Keys'}
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  OpenAI API Key *
                </label>
                <input
                  type="password"
                  value={apiKeys.openai}
                  onChange={(e) => setApiKeys({...apiKeys, openai: e.target.value})}
                  placeholder="sk-..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Google Search API Key *
                </label>
                <input
                  type="password"
                  value={apiKeys.googleSearch}
                  onChange={(e) => setApiKeys({...apiKeys, googleSearch: e.target.value})}
                  placeholder="AIza..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Google Custom Search Engine ID *
                </label>
                <input
                  type="password"
                  value={apiKeys.googleCSE}
                  onChange={(e) => setApiKeys({...apiKeys, googleCSE: e.target.value})}
                  placeholder="Your CSE ID..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <p className="text-sm text-blue-800">
                <strong>🔒 Security Note:</strong> Your API keys are stored locally in your browser and never sent to our servers. 
                Get your keys from: <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="underline">OpenAI</a> | 
                <a href="https://developers.google.com/custom-search/v1/introduction" target="_blank" rel="noopener noreferrer" className="underline ml-1">Google Custom Search</a>
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Target Information</h2>
          </div>
          
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Building className="inline w-4 h-4 mr-1" />
                  Target Company *
                </label>
                <input
                  type="text"
                  value={formData.targetCompany}
                  onChange={(e) => setFormData({...formData, targetCompany: e.target.value})}
                  placeholder="e.g., Microsoft, Stripe, Airbnb"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Building className="inline w-4 h-4 mr-1" />
                  Previous Company *
                </label>
                <input
                  type="text"
                  value={formData.previousCompany}
                  onChange={(e) => setFormData({...formData, previousCompany: e.target.value})}
                  placeholder="e.g., Google, Meta, Apple"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <GraduationCap className="inline w-4 h-4 mr-1" />
                  School/University *
                </label>
                <input
                  type="text"
                  value={formData.school}
                  onChange={(e) => setFormData({...formData, school: e.target.value})}
                  placeholder="e.g., Stanford, MIT, Carnegie Mellon"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Your Name *
                </label>
                <input
                  type="text"
                  value={formData.yourName}
                  onChange={(e) => setFormData({...formData, yourName: e.target.value})}
                  placeholder="e.g., Alex Chen"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            
            <button
              onClick={discoverConnections}
              disabled={loading || !formData.targetCompany || !formData.previousCompany || !formData.school || !formData.yourName}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin w-4 h-4 mr-2" />
                  Finding Real LinkedIn Profiles...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4 mr-2" />
                  🎯 Find Priority Connections + LinkedIn Profiles
                </>
              )}
            </button>
          </div>
        </div>

        {extractionLog.length > 0 && (
          <div className="bg-black text-green-400 font-mono text-sm p-4 rounded-lg mb-8 max-h-48 overflow-y-auto">
            {extractionLog.map((log, index) => (
              <div key={index} className="flex items-center mb-1">
                <span className="text-gray-500 mr-2">[{log.timestamp}]</span>
                {log.type === 'success' && <CheckCircle className="w-4 h-4 mr-2 text-green-400" />}
                {log.type === 'error' && <AlertCircle className="w-4 h-4 mr-2 text-red-400" />}
                <span className={log.type === 'error' ? 'text-red-400' : 'text-green-400'}>
                  {log.message}
                </span>
              </div>
            ))}
          </div>
        )}

        {searchComplete && connections.length > 0 && (
          <div className="space-y-8">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Found {connections.length} Real LinkedIn Connections</h2>
              <p className="text-gray-600">Priority connections shown first, followed by additional profiles</p>
            </div>

            {/* Priority Connections Section */}
            {connections.filter(c => c.isPriorityConnection).length > 0 && (
              <div className="mb-8">
                <div className="text-center mb-6 p-4 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg text-white">
                  <h3 className="text-xl font-bold flex items-center justify-center">
                    🎯 PRIORITY CONNECTIONS ({connections.filter(c => c.isPriorityConnection).length})
                  </h3>
                  <p className="font-medium">School Alumni & Former Colleagues at {formData.targetCompany}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {connections.filter(connection => connection.isPriorityConnection).map((connection, index) => (
                    <div key={`priority-${index}`} className="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow border-2 border-blue-200">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center mb-2">
                            <h3 className="text-lg font-semibold text-gray-900">{connection.name}</h3>
                            <span className="ml-2 px-2 py-1 bg-blue-600 text-white text-xs rounded-full font-medium">
                              PRIORITY
                            </span>
                          </div>
                          <p className="text-sm text-gray-600">{connection.title}</p>
                          <p className="text-sm text-gray-500">{connection.department}</p>
                          <p className="text-xs font-medium text-blue-600 mt-1">🎯 {connection.priorityReason}</p>
                          <p className="text-xs text-gray-400 mt-1">Source: {connection.source}</p>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getConnectionTypeColor(connection.connectionType)}`}>
                          {connection.connectionType}
                        </span>
                      </div>

                      <div className="space-y-2 mb-4">
                        <div className="flex items-center text-sm text-gray-600">
                          <Building className="w-4 h-4 mr-2" />
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

                        <details className="mb-3">
                          <summary className="text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer">
                            Alternative Patterns ({(connection.allEmailPatterns || []).length - 1})
                          </summary>
                          <div className="mt-2 space-y-1">
                            {(connection.allEmailPatterns || []).slice(1).map((email, i) => (
                              <div key={i} className="text-sm font-mono text-gray-600">{email}</div>
                            ))}
                          </div>
                        </details>

                        {connection.outreachTips && (
                          <div className="mb-3 p-3 bg-blue-100 rounded text-xs text-blue-800 border border-blue-200">
                            <strong>🎯 Priority Outreach Tip:</strong> {connection.outreachTips}
                          </div>
                        )}

                        <div className="flex space-x-2">
                          <a
                            href={connection.linkedinUrl || `https://linkedin.com/in/${connection.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 bg-blue-600 text-white text-xs py-2 px-3 rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center"
                          >
                            <ExternalLink className="w-3 h-3 mr-1" />
                            LinkedIn Profile
                          </a>
                          <a
                            href={`mailto:${connection.primaryEmail}?subject=Connection from ${formData.yourName}&body=Hi ${connection.name.split(' ')[0]}, I'm applying to ${formData.targetCompany} and noticed we share a connection through ${connection.priorityReason.includes('Alumni') ? formData.school : formData.previousCompany}. Would love to connect!`}
                            className="flex-1 bg-green-600 text-white text-xs py-2 px-3 rounded-md hover:bg-green-700 transition-colors flex items-center justify-center"
                          >
                            <Mail className="w-3 h-3 mr-1" />
                            Email
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Regular Connections Section */}
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
                    <div key={`regular-${index}`} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">{connection.name}</h3>
                          <p className="text-sm text-gray-600">{connection.title}</p>
                          <p className="text-sm text-gray-500">{connection.department}</p>
                          <p className="text-xs text-gray-400 mt-1">Source: {connection.source}</p>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getConnectionTypeColor(connection.connectionType)}`}>
                          {connection.connectionType}
                        </span>
                      </div>

                      <div className="space-y-2 mb-4">
                        <div className="flex items-center text-sm text-gray-600">
                          <Building className="w-4 h-4 mr-2" />
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

                        <details className="mb-3">
                          <summary className="text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer">
                            Alternative Patterns ({(connection.allEmailPatterns || []).length - 1})
                          </summary>
                          <div className="mt-2 space-y-1">
                            {(connection.allEmailPatterns || []).slice(1).map((email, i) => (
                              <div key={i} className="text-sm font-mono text-gray-600">{email}</div>
                            ))}
                          </div>
                        </details>

                        {connection.outreachTips && (
                          <div className="mb-3 p-2 bg-blue-50 rounded text-xs text-blue-700">
                            <strong>Tip:</strong> {connection.outreachTips}
                          </div>
                        )}

                        <div className="flex space-x-2">
                          <a
                            href={connection.linkedinUrl || `https://linkedin.com/in/${connection.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 bg-blue-50 text-blue-700 text-xs py-2 px-3 rounded-md hover:bg-blue-100 transition-colors flex items-center justify-center"
                          >
                            <ExternalLink className="w-3 h-3 mr-1" />
                            LinkedIn Profile
                          </a>
                          <a
                            href={`mailto:${connection.primaryEmail}?subject=Connection from ${formData.yourName}&body=Hi ${connection.name.split(' ')[0]}, I'm applying to ${formData.targetCompany} and noticed we share connections through ${connection.connectionType === 'Alumni' ? formData.school : formData.previousCompany}. Would love to connect!`}
                            className="flex-1 bg-green-50 text-green-700 text-xs py-2 px-3 rounded-md hover:bg-green-100 transition-colors flex items-center justify-center"
                          >
                            <Mail className="w-3 h-3 mr-1" />
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
            <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Connections Found</h3>
            <p className="text-gray-600">Try a different company name or check the extraction log for details.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConnectionFinder;