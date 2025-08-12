import React, { useState } from 'react';
import { Search, Building, GraduationCap, Mail, ExternalLink, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import './custom.css';

const ConnectionFinder = () => {
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

  // Intelligent caching system
  const getCacheKey = (query) => {
    return btoa(query).replace(/[^a-zA-Z0-9]/g, '').substring(0, 20);
  };

  const getCachedResult = (query) => {
    try {
      const cacheKey = getCacheKey(query);
      const cached = localStorage.getItem(`search_${cacheKey}`);
      if (cached) {
        const data = JSON.parse(cached);
        // Cache valid for 24 hours
        if (Date.now() - data.timestamp < 24 * 60 * 60 * 1000) {
          addLog(`📦 Using cached results for: ${query.substring(0, 50)}...`, 'info');
          return data.results;
        } else {
          localStorage.removeItem(`search_${cacheKey}`);
        }
      }
    } catch (error) {
      addLog(`Cache error: ${error.message}`, 'error');
    }
    return null;
  };

  const setCachedResult = (query, results) => {
    try {
      const cacheKey = getCacheKey(query);
      const data = {
        results: results,
        timestamp: Date.now(),
        query: query.substring(0, 100) // Store partial query for debugging
      };
      localStorage.setItem(`search_${cacheKey}`, JSON.stringify(data));
    } catch (error) {
      addLog(`Failed to cache results: ${error.message}`, 'error');
    }
  };

  const searchWithCache = async (searchQuery, numResults = 8) => {
    // Check cache first
    const cached = getCachedResult(searchQuery);
    if (cached) {
      return { items: cached };
    }

    // If not cached, make API call
    try {
      const response = await fetch(`https://www.googleapis.com/customsearch/v1?key=${apiKeys.googleSearch}&cx=${apiKeys.googleCSE}&q=${encodeURIComponent(searchQuery)}&num=${numResults}`);
      
      if (!response.ok) {
        addLog(`Search API error: ${response.status}`, 'error');
        return { items: [] };
      }
      
      const data = await response.json();
      
      // Cache the results
      if (data.items) {
        setCachedResult(searchQuery, data.items);
      }
      
      return data;
    } catch (error) {
      addLog(`Search failed: ${error.message}`, 'error');
      return { items: [] };
    }
  };

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

  // Enhanced priority searches with better targeting
  const generatePriorityConnectionSearches = (companyName, school, previousCompany) => {
    const prioritySearches = [];
    
    // School Alumni searches - people from your school now at target company
    if (school) {
      const schoolVariations = [
        school,
        school.replace(/University|College|Institute|School/gi, '').trim(),
        school.split(' ')[0] // First word (e.g., "Stanford" from "Stanford University")
      ];
      
      schoolVariations.forEach(schoolVar => {
        if (schoolVar) {
          prioritySearches.push(
            `site:linkedin.com/in/ "${companyName}" "${schoolVar}" "alumnus" OR "alumni" OR "graduate"`,
            `site:linkedin.com/in/ "${companyName}" "${schoolVar}" "studied at" OR "education"`,
            `site:linkedin.com/in/ "${companyName}" "${schoolVar}" "degree" OR "bachelor" OR "master" OR "PhD"`
          );
        }
      });
    }
    
    // Enhanced Former Colleague searches with specific patterns
    if (previousCompany) {
      const companyVariations = [
        previousCompany,
        previousCompany.replace(/Inc\\.|LLC|Corp|Corporation|Ltd|Limited/gi, '').trim(),
        previousCompany.split(' ')[0] // First word for companies like "Meta Platforms"
      ];
      
      companyVariations.forEach(prevComp => {
        if (prevComp) {
          prioritySearches.push(
            // More specific career transition patterns
            `site:linkedin.com/in/ "${companyName}" "joined from ${prevComp}" OR "moved from ${prevComp}"`,
            `site:linkedin.com/in/ "${companyName}" "previously at ${prevComp}" OR "ex-${prevComp}"`,
            `site:linkedin.com/in/ "${companyName}" "${prevComp}" "before joining" OR "prior to"`,
            // Experience section patterns
            `site:linkedin.com/in/ "${companyName}" "${prevComp}" "software engineer" OR "developer" OR "manager"`,
            `site:linkedin.com/in/ "${companyName}" "${prevComp}" years OR experience OR worked`,
            // Timeline-based searches
            `site:linkedin.com/in/ "${companyName}" "${prevComp}" "2020" OR "2021" OR "2022" OR "2023" OR "2024"`
          );
        }
      });
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
        
        const data = await searchWithCache(searchQuery, 8);
        
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
        
        const data = await searchWithCache(searchQuery, 10);
        
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

  // Enhanced name extraction with better patterns
  const extractNameFromTitle = (title) => {
    if (!title) return null;
    
    // LinkedIn titles usually start with the person's name
    // Various patterns: "John Smith - Software Engineer at Google | LinkedIn"
    //                  "John Smith | Software Engineer at Google - LinkedIn"  
    //                  "John Smith, Software Engineer at Google | LinkedIn"
    const patterns = [
      /^([^-|,]+)(?:\s*-|\s*\||,)/,  // Name before dash, pipe, or comma
      /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/, // Proper case names
      /([A-Z][a-z]+\s+[A-Z][a-z]+)/ // Basic first+last pattern
    ];
    
    for (const pattern of patterns) {
      const match = title.match(pattern);
      if (match) {
        let name = match[1].trim();
        // Remove common prefixes and suffixes
        name = name.replace(/^(Dr\.?|Mr\.?|Ms\.?|Mrs\.?|Prof\.?)\s+/i, '');
        name = name.replace(/\s+(Jr\.?|Sr\.?|II|III|PhD|MD)$/i, '');
        
        // Validate name quality
        const words = name.split(' ');
        if (words.length >= 2 && words.length <= 4 && 
            name.length > 3 && name.length < 50 &&
            !/\d/.test(name) && // No numbers
            !/[^\w\s.'-]/.test(name)) { // Only letters, spaces, dots, hyphens, apostrophes
          return name;
        }
      }
    }
    return null;
  };

  // Enhanced job title extraction with better patterns
  const extractJobTitleFromSnippet = (snippet) => {
    if (!snippet) return 'Professional';
    
    // Comprehensive job title patterns with priority
    const titlePatterns = [
      // Direct role statements
      /(?:works as|working as|employed as|serves as|role as)\s+(?:a|an)?\s*([^.,;]+)/i,
      /(?:is|was)\s+(?:a|an|the)\s+((?:[A-Z][a-z]+\s+){1,3}(?:Engineer|Manager|Director|Developer|Designer|Analyst|Scientist|Specialist|Coordinator|Assistant|Associate|Lead|Senior|Principal|VP|President|CEO|CTO|CRO|CMO)[^.,;]*)/i,
      
      // Current position indicators  
      /(?:currently|presently)\s+(?:a|an)?\s*([^.,;]+)/i,
      /(?:position|title|role):\s*([^.,;]+)/i,
      
      // Common tech titles with context
      /((?:Senior|Principal|Staff|Lead|Junior)?\s*(?:Software|Frontend|Backend|Full[- ]?Stack|DevOps|Data|Machine Learning|AI)?\s*(?:Engineer|Developer|Architect|Scientist)[^.,;]*)/i,
      /((?:Product|Project|Engineering|Technology|Marketing|Sales|Operations)?\s*(?:Manager|Director|VP|Lead|Head|Chief)[^.,;]*)/i,
      
      // Generic patterns
      /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+at\s+/i,
      /\b(?:^|\s)([A-Z][a-z]+\s+(?:Engineer|Manager|Director|Developer|Designer|Analyst|Scientist|Specialist|Coordinator|Assistant|Associate|Lead|Senior|Principal))\b/i
    ];
    
    for (const pattern of titlePatterns) {
      const match = snippet.match(pattern);
      if (match) {
        let title = match[1].trim();
        
        // Clean up the title
        title = title.replace(/\s+at\s+.*/i, ''); // Remove "at Company" 
        title = title.replace(/\s*[.,;]\s*.*/, ''); // Remove trailing content after punctuation
        title = title.replace(/^\s*(a|an|the)\s+/i, ''); // Remove articles
        
        // Validate title quality
        if (title.length > 3 && title.length < 100 && 
            !/^\d/.test(title) && // Doesn't start with number
            title.split(' ').length <= 8) { // Reasonable length
          
          // Capitalize properly
          title = title.replace(/\b\w/g, char => char.toUpperCase());
          return title;
        }
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
          
          const data = await searchWithCache(searchQuery, 8);
          if (data.items) {
            const searchProfiles = await extractProfilesFromSearchResults(data.items, companyName);
            profiles.push(...searchProfiles);
            addLog(`Found ${searchProfiles.length} additional profiles`, 'success');
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

  // NEW: Search GitHub and social media for additional connections
  const searchSocialMediaProfiles = async (companyName, previousCompany) => {
    addLog(`🔍 Searching GitHub and social platforms for ${companyName} employees...`, 'info');
    
    const socialProfiles = [];
    const socialSearches = [];
    
    // GitHub searches
    socialSearches.push(
      `site:github.com "${companyName}" (engineer OR developer) followers`,
      `site:github.com "${companyName}" "software engineer" OR "senior developer"`,
      `"${companyName}" site:github.com bio OR profile`
    );
    
    // Twitter/X searches for tech professionals
    socialSearches.push(
      `site:twitter.com OR site:x.com "${companyName}" (software engineer OR developer) bio`,
      `site:twitter.com OR site:x.com "${companyName}" "working at" OR "engineer at"`
    );
    
    // Company blog and team pages
    socialSearches.push(
      `"${companyName}" "team" OR "about us" OR "our team" (engineer OR developer OR manager)`,
      `"${companyName}" "meet the team" OR "leadership" OR "employees"`
    );
    
    // Cross-reference with previous company
    if (previousCompany) {
      socialSearches.push(
        `site:github.com "${previousCompany}" "${companyName}" (moved OR joined OR now)`,
        `"${previousCompany}" "${companyName}" (engineer OR developer) transition`
      );
    }
    
    for (let i = 0; i < Math.min(socialSearches.length, 4); i++) {
      const searchQuery = socialSearches[i];
      addLog(`Social search: ${searchQuery.substring(0, 70)}...`, 'info');
      
      try {
        await new Promise(resolve => setTimeout(resolve, 2500));
        
        const data = await searchWithCache(searchQuery, 6);
        if (data.items) {
          const profiles = await extractSocialProfiles(data.items, companyName);
          socialProfiles.push(...profiles);
          addLog(`Found ${profiles.length} social profiles`, 'success');
        }
      } catch (error) {
        addLog(`Social search failed: ${error.message}`, 'error');
        continue;
      }
    }
    
    return socialProfiles;
  };

  // Extract profiles from social media search results
  const extractSocialProfiles = async (searchResults, companyName) => {
    const profiles = [];
    
    for (const result of searchResults) {
      let profileData = null;
      
      // GitHub profile detection
      if (result.link && result.link.includes('github.com/') && !result.link.includes('/repos/')) {
        const githubUsername = result.link.split('github.com/')[1]?.split('/')[0];
        if (githubUsername && !['orgs', 'topics', 'search'].includes(githubUsername)) {
          profileData = {
            name: extractNameFromGithubTitle(result.title),
            title: 'Software Engineer', // Default for GitHub users
            snippet: result.snippet,
            company: companyName,
            linkedinUrl: null,
            githubUrl: result.link,
            source: 'GitHub Search'
          };
        }
      }
      
      // Twitter/X profile detection
      else if (result.link && (result.link.includes('twitter.com/') || result.link.includes('x.com/'))) {
        const twitterHandle = result.link.split(/twitter\.com\/|x\.com\//)[1]?.split('/')[0];
        if (twitterHandle && twitterHandle !== 'search') {
          profileData = {
            name: extractNameFromTwitterTitle(result.title),
            title: extractJobTitleFromSnippet(result.snippet),
            snippet: result.snippet,
            company: companyName,
            linkedinUrl: null,
            twitterUrl: result.link,
            source: 'Twitter/X Search'
          };
        }
      }
      
      // Company website team pages
      else if (result.snippet && (result.snippet.toLowerCase().includes('engineer') || 
               result.snippet.toLowerCase().includes('developer') ||
               result.snippet.toLowerCase().includes('manager'))) {
        profileData = {
          name: extractNameFromTeamPage(result.snippet),
          title: extractJobTitleFromSnippet(result.snippet),
          snippet: result.snippet,
          company: companyName,
          linkedinUrl: null,
          companyPageUrl: result.link,
          source: 'Company Website'
        };
      }
      
      if (profileData && profileData.name) {
        profiles.push(profileData);
      }
    }
    
    return profiles;
  };

  // Helper functions for social profile extraction
  const extractNameFromGithubTitle = (title) => {
    if (!title) return null;
    // GitHub titles like "John Smith (johnsmith) - GitHub"
    const match = title.match(/^([^(]+)/);
    return match ? match[1].trim() : null;
  };

  const extractNameFromTwitterTitle = (title) => {
    if (!title) return null;
    // Twitter titles like "John Smith (@johnsmith) / Twitter"
    const match = title.match(/^([^@(]+)/);
    return match ? match[1].trim() : null;
  };

  const extractNameFromTeamPage = (snippet) => {
    if (!snippet) return null;
    // Look for name patterns in team pages
    const namePatterns = [
      /([A-Z][a-z]+\s+[A-Z][a-z]+),?\s+(Software Engineer|Engineer|Developer|Manager)/,
      /(Software Engineer|Engineer|Developer|Manager)[:\s]+([A-Z][a-z]+\s+[A-Z][a-z]+)/,
      /([A-Z][a-z]+\s+[A-Z][a-z]+)\s+is\s+(a|an|our)/
    ];
    
    for (const pattern of namePatterns) {
      const match = snippet.match(pattern);
      if (match) {
        return match[1] || match[2];
      }
    }
    return null;
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
    
    // Company-specific email pattern preferences
    const companyPatterns = {
      'google.com': ['firstname.lastname', 'firstname'],
      'microsoft.com': ['firstname.lastname', 'flastname'],
      'amazon.com': ['firstnamel', 'firstname.lastname'],
      'meta.com': ['firstname.lastname', 'firstname'],
      'apple.com': ['firstname.lastname', 'flastname'],
      'netflix.com': ['firstname.lastname', 'firstname'],
      'uber.com': ['firstname.lastname', 'firstname'],
      'airbnb.com': ['firstname.lastname', 'firstname'],
      'stripe.com': ['firstname.lastname', 'firstname'],
      'salesforce.com': ['firstname.lastname', 'flastname']
    };
    
    const basePatterns = [
      `${f}.${l}@${domain}`,        // firstname.lastname (most common)
      `${f}@${domain}`,             // firstname
      `${f[0]}.${l}@${domain}`,     // f.lastname
      `${f}${l}@${domain}`,         // firstnamelastname
      `${f}_${l}@${domain}`,        // firstname_lastname
      `${f[0]}${l}@${domain}`,      // flastname
      `${l}.${f}@${domain}`,        // lastname.firstname
      `${f}+${l}@${domain}`         // firstname+lastname
    ];
    
    // If we have company-specific patterns, prioritize them
    const companyPrefs = companyPatterns[domain.toLowerCase()];
    if (companyPrefs) {
      const prioritizedPatterns = [];
      
      companyPrefs.forEach(pattern => {
        switch(pattern) {
          case 'firstname.lastname':
            prioritizedPatterns.push(`${f}.${l}@${domain}`);
            break;
          case 'firstname':
            prioritizedPatterns.push(`${f}@${domain}`);
            break;
          case 'flastname':
            prioritizedPatterns.push(`${f[0]}${l}@${domain}`);
            break;
          case 'firstnamel':
            prioritizedPatterns.push(`${f}${l[0]}@${domain}`);
            break;
          default:
            // Handle any other patterns
            break;
        }
      });
      
      // Add remaining patterns
      const remaining = basePatterns.filter(p => !prioritizedPatterns.includes(p));
      return [...prioritizedPatterns, ...remaining];
    }
    
    return basePatterns;
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
      const socialProfiles = await searchSocialMediaProfiles(formData.targetCompany, formData.previousCompany);
      
      const allProfiles = [...priorityProfiles, ...linkedinProfiles, ...additionalProfiles, ...socialProfiles];
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
        return 'bg-gradient-to-r from-blue-500/20 to-cyan-500/20 text-blue-400 border border-blue-500/30';
      case 'Former Colleague': 
        return 'bg-gradient-to-r from-emerald-500/20 to-green-500/20 text-emerald-400 border border-emerald-500/30';
      case 'Industry Contact': 
        return 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-400 border border-purple-500/30';
      case 'Direct Contact': 
        return 'bg-gradient-to-r from-orange-500/20 to-amber-500/20 text-orange-400 border border-orange-500/30';
      default: 
        return 'bg-gradient-to-r from-slate-500/20 to-gray-500/20 text-slate-400 border border-slate-500/30';
    }
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

        {/* API Configuration Section */}
        <div className="relative mb-12">
          <div className="absolute inset-0 bg-gradient-to-r from-slate-800/50 to-purple-800/30 rounded-2xl blur-xl"></div>
          <div className="relative bg-gradient-to-br from-slate-800/90 via-slate-800/80 to-purple-900/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-8">
            <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center mb-8">
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">🔑 API Configuration</h2>
                <p className="text-slate-400">Configure your API keys to unlock the full potential</p>
              </div>
              <div className="mt-4 lg:mt-0">
                <div className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold ${
                  apiKeys.openai && apiKeys.googleSearch && apiKeys.googleCSE 
                    ? 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-400 border border-green-500/30' 
                    : 'bg-gradient-to-r from-red-500/20 to-rose-500/20 text-red-400 border border-red-500/30'
                }`}>
                  {apiKeys.openai && apiKeys.googleSearch && apiKeys.googleCSE ? '✅ Ready to Launch' : '⚠️ Configuration Needed'}
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-cyan-400 mb-2">
                  OpenAI API Key *
                </label>
                <input
                  type="password"
                  value={apiKeys.openai}
                  onChange={(e) => setApiKeys({...apiKeys, openai: e.target.value})}
                  placeholder="sk-proj-..."
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:border-cyan-400 transition-all duration-200"
                />
              </div>
              
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-purple-400 mb-2">
                  Google Search API Key *
                </label>
                <input
                  type="password"
                  value={apiKeys.googleSearch}
                  onChange={(e) => setApiKeys({...apiKeys, googleSearch: e.target.value})}
                  placeholder="AIza..."
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-400/50 focus:border-purple-400 transition-all duration-200"
                />
              </div>
              
              <div className="lg:col-span-2 space-y-3">
                <label className="block text-sm font-semibold text-pink-400 mb-2">
                  Google Custom Search Engine ID *
                </label>
                <input
                  type="password"
                  value={apiKeys.googleCSE}
                  onChange={(e) => setApiKeys({...apiKeys, googleCSE: e.target.value})}
                  placeholder="Your CSE ID..."
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-400/50 focus:border-pink-400 transition-all duration-200"
                />
              </div>
            </div>
            
            <div className={`rounded-xl p-6 border ${process.env.NODE_ENV === 'development' 
              ? 'bg-gradient-to-r from-green-900/30 to-emerald-900/20 border-green-500/30' 
              : 'bg-gradient-to-r from-blue-900/30 to-cyan-900/20 border-blue-500/30'
            }`}>
              <p className={`text-sm leading-relaxed ${process.env.NODE_ENV === 'development' ? 'text-green-300' : 'text-cyan-300'}`}>
                {process.env.NODE_ENV === 'development' ? (
                  <>
                    <span className="font-semibold">🔧 Development Mode:</span> API keys are loaded from your .env file automatically.
                  </>
                ) : (
                  <>
                    <span className="font-semibold">🔒 Production Mode:</span> Your API keys are stored securely in your browser and never sent to our servers. 
                    Get your keys from: <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-white font-semibold hover:text-cyan-400 transition-colors underline decoration-cyan-400/50">OpenAI</a> | 
                    <a href="https://developers.google.com/custom-search/v1/introduction" target="_blank" rel="noopener noreferrer" className="text-white font-semibold hover:text-cyan-400 transition-colors underline decoration-cyan-400/50 ml-1">Google Custom Search</a>
                  </>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Target Information Section */}
        <div className="relative mb-12">
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-800/30 to-blue-800/30 rounded-2xl blur-xl"></div>
          <div className="relative bg-gradient-to-br from-slate-800/90 via-slate-800/80 to-cyan-900/30 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-8">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">🎯 Target Information</h2>
              <p className="text-slate-400">Tell us about your networking goals and background</p>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <div className="space-y-3">
                <label className="flex items-center text-sm font-semibold text-cyan-400 mb-2">
                  <Building className="w-5 h-5 mr-2" />
                  Target Company *
                </label>
                <input
                  type="text"
                  value={formData.targetCompany}
                  onChange={(e) => setFormData({...formData, targetCompany: e.target.value})}
                  placeholder="e.g., Microsoft, Stripe, Airbnb"
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:border-cyan-400 transition-all duration-200"
                />
              </div>
              
              <div className="space-y-3">
                <label className="flex items-center text-sm font-semibold text-purple-400 mb-2">
                  <Building className="w-5 h-5 mr-2" />
                  Previous Company *
                </label>
                <input
                  type="text"
                  value={formData.previousCompany}
                  onChange={(e) => setFormData({...formData, previousCompany: e.target.value})}
                  placeholder="e.g., Google, Meta, Apple"
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-400/50 focus:border-purple-400 transition-all duration-200"
                />
              </div>
              
              <div className="space-y-3">
                <label className="flex items-center text-sm font-semibold text-pink-400 mb-2">
                  <GraduationCap className="w-5 h-5 mr-2" />
                  School/University *
                </label>
                <input
                  type="text"
                  value={formData.school}
                  onChange={(e) => setFormData({...formData, school: e.target.value})}
                  placeholder="e.g., Stanford, MIT, Carnegie Mellon"
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-400/50 focus:border-pink-400 transition-all duration-200"
                />
              </div>
              
              <div className="space-y-3">
                <label className="flex items-center text-sm font-semibold text-emerald-400 mb-2">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Your Name *
                </label>
                <input
                  type="text"
                  value={formData.yourName}
                  onChange={(e) => setFormData({...formData, yourName: e.target.value})}
                  placeholder="e.g., Alex Chen"
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-400 transition-all duration-200"
                />
              </div>
            </div>
            
            <button
              onClick={discoverConnections}
              disabled={loading || !formData.targetCompany || !formData.previousCompany || !formData.school || !formData.yourName}
              className="group relative w-full overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 rounded-xl opacity-100 group-hover:opacity-90 transition-opacity duration-200"></div>
              <div className="absolute inset-[1px] bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-[11px] group-hover:from-slate-800 group-hover:to-slate-800 transition-all duration-200"></div>
              <div className="relative px-8 py-4 flex items-center justify-center text-lg font-bold">
                {loading ? (
                  <>
                    <Loader2 className="animate-spin w-6 h-6 mr-3 text-cyan-400" />
                    <span className="bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                      Discovering Connections...
                    </span>
                  </>
                ) : (
                  <>
                    <Search className="w-6 h-6 mr-3 text-cyan-400" />
                    <span className="bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                      Launch Discovery Engine
                    </span>
                  </>
                )}
              </div>
            </button>
          </div>
        </div>

        {extractionLog.length > 0 && (
          <div className="relative mb-12">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-800/20 to-cyan-800/20 rounded-2xl blur-xl"></div>
            <div className="relative bg-gradient-to-br from-slate-900/95 via-slate-800/90 to-emerald-900/20 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-6">
              <div className="flex items-center mb-4">
                <div className="w-3 h-3 bg-emerald-400 rounded-full animate-pulse mr-3"></div>
                <h3 className="text-lg font-semibold text-emerald-400">Real-Time Discovery Log</h3>
              </div>
              <div className="bg-slate-900/80 rounded-xl p-4 font-mono text-sm max-h-60 overflow-y-auto custom-scrollbar">
                {extractionLog.map((log, index) => (
                  <div key={index} className="flex items-start mb-2 last:mb-0">
                    <span className="text-slate-500 mr-3 flex-shrink-0 min-w-[60px]">[{log.timestamp}]</span>
                    {log.type === 'success' && <CheckCircle className="w-4 h-4 mr-2 text-emerald-400 flex-shrink-0 mt-0.5" />}
                    {log.type === 'error' && <AlertCircle className="w-4 h-4 mr-2 text-red-400 flex-shrink-0 mt-0.5" />}
                    {log.type === 'info' && <div className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5"><div className="w-2 h-2 bg-cyan-400 rounded-full mx-auto mt-1"></div></div>}
                    <span className={`leading-relaxed ${
                      log.type === 'error' ? 'text-red-400' : 
                      log.type === 'success' ? 'text-emerald-400' : 
                      'text-cyan-300'
                    }`}>
                      {log.message}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {searchComplete && connections.length > 0 && (
          <div className="space-y-12">
            <div className="text-center mb-12">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 blur-3xl rounded-full"></div>
                <h2 className="relative text-4xl lg:text-5xl font-bold bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent mb-4">
                  Discovery Complete
                </h2>
              </div>
              <p className="text-xl text-slate-300 mb-6">Found {connections.length} high-quality connections across multiple platforms</p>
              <div className="flex justify-center space-x-4">
                <div className="bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 backdrop-blur-sm rounded-full px-4 py-2 border border-emerald-500/30">
                  <span className="text-emerald-400 font-semibold">{connections.filter(c => c.isPriorityConnection).length} Priority</span>
                </div>
                <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 backdrop-blur-sm rounded-full px-4 py-2 border border-cyan-500/30">
                  <span className="text-cyan-400 font-semibold">{connections.filter(c => !c.isPriorityConnection).length} Additional</span>
                </div>
              </div>
            </div>

            {/* Priority Connections Section */}
            {connections.filter(c => c.isPriorityConnection).length > 0 && (
              <div className="mb-16">
                <div className="relative mb-8">
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 blur-2xl rounded-2xl"></div>
                  <div className="relative text-center p-8 bg-gradient-to-r from-emerald-500/10 via-cyan-500/10 to-blue-500/10 backdrop-blur-sm rounded-2xl border border-emerald-500/30">
                    <div className="flex items-center justify-center mb-3">
                      <div className="w-3 h-3 bg-emerald-400 rounded-full animate-ping mr-3"></div>
                      <h3 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                        PRIORITY CONNECTIONS ({connections.filter(c => c.isPriorityConnection).length})
                      </h3>
                    </div>
                    <p className="text-slate-300 font-medium">School Alumni & Former Colleagues at {formData.targetCompany}</p>
                    <div className="flex justify-center mt-4">
                      <div className="bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 backdrop-blur-sm rounded-full px-6 py-2 border border-emerald-500/30">
                        <span className="text-emerald-300 font-semibold">🎯 Highest Response Rate</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {connections.filter(connection => connection.isPriorityConnection).map((connection, index) => (
                    <div key={`priority-${index}`} className="group relative">
                      <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 via-cyan-500/20 to-blue-500/20 rounded-2xl blur-lg group-hover:blur-xl transition-all duration-300"></div>
                      <div className="relative bg-gradient-to-br from-slate-800/90 via-slate-800/80 to-emerald-900/30 backdrop-blur-xl rounded-2xl border border-emerald-500/30 p-6 hover:border-emerald-400/50 transition-all duration-300">
                        <div className="flex items-start justify-between mb-6">
                          <div className="flex-1">
                            <div className="flex items-center mb-3">
                              <h3 className="text-xl font-bold text-white">{connection.name}</h3>
                              <span className="ml-3 px-3 py-1 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white text-xs rounded-full font-bold shadow-lg">
                                PRIORITY
                              </span>
                            </div>
                            <p className="text-slate-300 font-medium mb-1">{connection.title}</p>
                            <p className="text-slate-400 text-sm mb-2">{connection.department}</p>
                            <div className="flex items-center mb-2">
                              <div className="w-2 h-2 bg-emerald-400 rounded-full mr-2 animate-pulse"></div>
                              <p className="text-emerald-400 font-semibold text-sm">{connection.priorityReason}</p>
                            </div>
                            <p className="text-slate-500 text-xs">Source: {connection.source}</p>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getConnectionTypeColor(connection.connectionType)}`}>
                            {connection.connectionType}
                          </span>
                        </div>

                        <div className="space-y-3 mb-6">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center text-slate-300">
                              <Building className="w-4 h-4 mr-2 text-cyan-400" />
                              <span className="font-medium">{connection.seniority}</span>
                            </div>
                            <div className="flex items-center bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 rounded-full px-3 py-1">
                              <div className="w-2 h-2 bg-emerald-400 rounded-full mr-2"></div>
                              <span className="text-emerald-400 font-semibold text-sm">{connection.responseRate}/10 response rate</span>
                            </div>
                          </div>
                        </div>

                        <div className="border-t border-slate-700 pt-6">
                          <div className="mb-4">
                            <label className="text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-2 block">Best Email Pattern</label>
                            <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-600">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-mono text-white font-medium">{connection.primaryEmail}</span>
                                <span className={`text-xs font-bold px-2 py-1 rounded-full ${connection.emailConfidence > 70 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                  {connection.emailConfidence}%
                                </span>
                              </div>
                            </div>
                          </div>

                          <details className="mb-4">
                            <summary className="text-xs font-semibold text-purple-400 uppercase tracking-wider cursor-pointer hover:text-purple-300 transition-colors">
                              Alternative Patterns ({(connection.allEmailPatterns || []).length - 1})
                            </summary>
                            <div className="mt-3 space-y-2">
                              {(connection.allEmailPatterns || []).slice(1).map((email, i) => (
                                <div key={i} className="bg-slate-900/30 rounded-lg p-2 text-sm font-mono text-slate-300 border border-slate-700">{email}</div>
                              ))}
                            </div>
                          </details>

                          {connection.outreachTips && (
                            <div className="mb-4 p-4 bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 rounded-xl border border-emerald-500/30">
                              <div className="flex items-start">
                                <div className="w-6 h-6 bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                                  <span className="text-white text-xs font-bold">🎯</span>
                                </div>
                                <div>
                                  <p className="text-emerald-400 font-semibold text-xs mb-1">Priority Outreach Tip</p>
                                  <p className="text-slate-300 text-xs leading-relaxed">{connection.outreachTips}</p>
                                </div>
                              </div>
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-3">
                            <a
                              href={connection.linkedinUrl || `https://linkedin.com/in/${connection.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="group bg-gradient-to-r from-blue-500/20 to-cyan-500/20 hover:from-blue-500/30 hover:to-cyan-500/30 border border-blue-500/30 hover:border-blue-400 text-blue-400 hover:text-blue-300 font-semibold text-sm py-3 px-4 rounded-xl transition-all duration-200 flex items-center justify-center"
                            >
                              <ExternalLink className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
                              LinkedIn
                            </a>
                            <a
                              href={`mailto:${connection.primaryEmail}?subject=Connection from ${formData.yourName}&body=Hi ${connection.name.split(' ')[0]}, I'm applying to ${formData.targetCompany} and noticed we share a connection through ${connection.priorityReason.includes('Alumni') ? formData.school : formData.previousCompany}. Would love to connect!`}
                              className="group bg-gradient-to-r from-emerald-500/20 to-green-500/20 hover:from-emerald-500/30 hover:to-green-500/30 border border-emerald-500/30 hover:border-emerald-400 text-emerald-400 hover:text-emerald-300 font-semibold text-sm py-3 px-4 rounded-xl transition-all duration-200 flex items-center justify-center"
                            >
                              <Mail className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
                              Email
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Regular Connections Section */}
            {connections.filter(c => !c.isPriorityConnection).length > 0 && (
              <div className="mb-16">
                <div className="text-center mb-8">
                  <h3 className="text-2xl font-bold bg-gradient-to-r from-slate-400 to-slate-200 bg-clip-text text-transparent mb-2">
                    Additional Connections ({connections.filter(c => !c.isPriorityConnection).length})
                  </h3>
                  <p className="text-slate-400">More professional connections at {formData.targetCompany}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {connections.filter(connection => !connection.isPriorityConnection).map((connection, index) => (
                    <div key={`regular-${index}`} className="group relative">
                      <div className="absolute inset-0 bg-gradient-to-r from-slate-600/10 to-slate-500/10 rounded-2xl blur-lg group-hover:blur-xl transition-all duration-300"></div>
                      <div className="relative bg-gradient-to-br from-slate-800/80 via-slate-800/70 to-slate-700/50 backdrop-blur-xl rounded-2xl border border-slate-600/50 p-6 hover:border-slate-500/70 transition-all duration-300">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <h3 className="text-lg font-bold text-white mb-2">{connection.name}</h3>
                            <p className="text-slate-300 font-medium mb-1">{connection.title}</p>
                            <p className="text-slate-400 text-sm mb-2">{connection.department}</p>
                            <p className="text-slate-500 text-xs">Source: {connection.source}</p>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getConnectionTypeColor(connection.connectionType)}`}>
                            {connection.connectionType}
                          </span>
                        </div>

                        <div className="space-y-3 mb-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center text-slate-300">
                              <Building className="w-4 h-4 mr-2 text-slate-400" />
                              <span>{connection.seniority}</span>
                            </div>
                            <div className="flex items-center bg-gradient-to-r from-slate-500/20 to-slate-400/20 rounded-full px-3 py-1">
                              <div className="w-2 h-2 bg-slate-400 rounded-full mr-2"></div>
                              <span className="text-slate-400 text-sm">{connection.responseRate}/10 response</span>
                            </div>
                          </div>
                        </div>

                        <div className="border-t border-slate-600 pt-4">
                          <div className="mb-3">
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">Best Email Pattern</label>
                            <div className="bg-slate-900/40 rounded-lg p-3 border border-slate-600">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-mono text-white">{connection.primaryEmail}</span>
                                <span className={`text-xs font-bold px-2 py-1 rounded-full ${connection.emailConfidence > 70 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                  {connection.emailConfidence}%
                                </span>
                              </div>
                            </div>
                          </div>

                          <details className="mb-3">
                            <summary className="text-xs font-semibold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-300 transition-colors">
                              Alternative Patterns ({(connection.allEmailPatterns || []).length - 1})
                            </summary>
                            <div className="mt-2 space-y-2">
                              {(connection.allEmailPatterns || []).slice(1).map((email, i) => (
                                <div key={i} className="bg-slate-900/30 rounded-lg p-2 text-sm font-mono text-slate-300 border border-slate-700">{email}</div>
                              ))}
                            </div>
                          </details>

                          {connection.outreachTips && (
                            <div className="mb-3 p-3 bg-gradient-to-r from-slate-500/10 to-slate-400/10 rounded-lg border border-slate-500/30">
                              <p className="text-slate-400 font-semibold text-xs mb-1">Outreach Tip</p>
                              <p className="text-slate-300 text-xs leading-relaxed">{connection.outreachTips}</p>
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-3">
                            <a
                              href={connection.linkedinUrl || `https://linkedin.com/in/${connection.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="group bg-gradient-to-r from-blue-500/10 to-cyan-500/10 hover:from-blue-500/20 hover:to-cyan-500/20 border border-blue-500/20 hover:border-blue-400/40 text-blue-400 hover:text-blue-300 font-medium text-sm py-2 px-3 rounded-lg transition-all duration-200 flex items-center justify-center"
                            >
                              <ExternalLink className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
                              LinkedIn
                            </a>
                            <a
                              href={`mailto:${connection.primaryEmail}?subject=Connection from ${formData.yourName}&body=Hi ${connection.name.split(' ')[0]}, I'm applying to ${formData.targetCompany} and noticed we share connections through ${connection.connectionType === 'Alumni' ? formData.school : formData.previousCompany}. Would love to connect!`}
                              className="group bg-gradient-to-r from-slate-500/10 to-slate-400/10 hover:from-slate-500/20 hover:to-slate-400/20 border border-slate-500/20 hover:border-slate-400/40 text-slate-400 hover:text-slate-300 font-medium text-sm py-2 px-3 rounded-lg transition-all duration-200 flex items-center justify-center"
                            >
                              <Mail className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
                              Email
                            </a>
                          </div>
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
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-red-500/10 to-orange-500/10 blur-2xl rounded-full"></div>
            <div className="relative text-center py-16 px-8">
              <div className="relative mb-6">
                <div className="absolute inset-0 bg-gradient-to-r from-red-500/20 to-orange-500/20 blur-xl rounded-full"></div>
                <AlertCircle className="relative w-20 h-20 text-red-400 mx-auto" />
              </div>
              <h3 className="text-2xl font-bold bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent mb-4">No Connections Found</h3>
              <p className="text-slate-300 text-lg mb-6 max-w-md mx-auto">We couldn't find any connections for this search. Try adjusting your criteria or check the discovery log for details.</p>
              <div className="flex justify-center space-x-4">
                <div className="bg-gradient-to-r from-red-500/10 to-orange-500/10 backdrop-blur-sm rounded-full px-6 py-3 border border-red-500/30">
                  <span className="text-red-400 font-semibold">🔍 Refine Search</span>
                </div>
                <div className="bg-gradient-to-r from-orange-500/10 to-amber-500/10 backdrop-blur-sm rounded-full px-6 py-3 border border-orange-500/30">
                  <span className="text-orange-400 font-semibold">📋 Check Logs</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConnectionFinder;