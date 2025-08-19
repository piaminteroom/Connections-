import React, { useState } from 'react';
import { Search, Building, GraduationCap, Mail, ExternalLink, Loader2, AlertCircle, CheckCircle, Sparkles, Heart, Star, Users, Globe, Target, Zap } from 'lucide-react';
import './custom.css';

const ConnectionFinder = () => {
  const [formData, setFormData] = useState({
    targetCompany: '',
    previousCompany: '',
    school: '',
    yourName: ''
  });
  
  // Load API keys from environment variables
  const apiKeys = {
    openai: process.env.REACT_APP_OPENAI_API_KEY || '',
    googleSearch: process.env.REACT_APP_GOOGLE_SEARCH_API_KEY || '',
    googleCSE: process.env.REACT_APP_GOOGLE_CSE_ID || '',
    hunter: process.env.REACT_APP_HUNTER_API_KEY || ''
  };
  
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
    // Generate precise Boolean search strings for LinkedIn profiles - OPTIMIZED ORDER
    const searches = [
      // HIGH-VALUE roles first (decision makers and senior folks)
      `site:linkedin.com/in/ "${companyName}" ("senior software engineer" OR "principal engineer" OR "staff engineer")`,
      `site:linkedin.com/in/ "${companyName}" ("engineering manager" OR "tech lead" OR "team lead")`,
      `site:linkedin.com/in/ "${companyName}" ("product manager" OR "senior product manager" OR "principal product manager")`,
      `site:linkedin.com/in/ "${companyName}" ("director" OR "VP" OR "vice president" OR "head of")`,
      
      // Mid-level professionals (good networking targets)
      `site:linkedin.com/in/ "${companyName}" ("software engineer" OR "software developer" OR "full stack")`,
      `site:linkedin.com/in/ "${companyName}" ("data scientist" OR "machine learning" OR "AI engineer")`,
      `site:linkedin.com/in/ "${companyName}" ("product designer" OR "UX designer" OR "design lead")`,
      
      // Broader searches for volume
      `site:linkedin.com/in/ "${companyName}" ("engineer" OR "developer" OR "technical")`
    ];
    return searches;
  };

  // Enhanced priority searches with better targeting - WORK ALUMNI FIRST
  const generatePriorityConnectionSearches = (companyName, school, previousCompany) => {
    const prioritySearches = [];
    
    // PRIORITIZE WORK ALUMNI FIRST - These are more valuable connections
    if (previousCompany) {
      const companyVariations = [
        previousCompany,
        previousCompany.replace(/Inc\.|LLC|Corp|Corporation|Ltd|Limited/gi, '').trim(),
        previousCompany.split(' ')[0] // First word for companies like "Meta Platforms"
      ];
      
      companyVariations.forEach(prevComp => {
        if (prevComp && prevComp.length > 1) {
          // HIGH-PRIORITY work colleague searches - these come FIRST
          prioritySearches.push(
            // Direct experience mentions - most effective
            `site:linkedin.com/in/ "${companyName}" "${prevComp}" (experience OR worked OR "former" OR "previous")`,
            `site:linkedin.com/in/ "${companyName}" "${prevComp}" ("software engineer" OR "product manager" OR "data scientist" OR "designer")`,
            
            // Career transition patterns - very specific
            `site:linkedin.com/in/ "${companyName}" ("from ${prevComp}" OR "ex-${prevComp}" OR "formerly ${prevComp}")`,
            `site:linkedin.com/in/ "${companyName}" "${prevComp}" ("joined" OR "moved" OR "transitioned")`,
            
            // LinkedIn headline patterns
            `site:linkedin.com/in/ "${companyName}" "${prevComp}" ("currently" OR "now at" OR "@")`
          );
          
          // Add specific role-based searches for work alumni
          const commonRoles = ['Engineer', 'Manager', 'Director', 'Lead', 'Senior', 'Principal', 'VP'];
          commonRoles.forEach(role => {
            prioritySearches.push(
              `site:linkedin.com/in/ "${companyName}" "${prevComp}" "${role}" ("experience" OR "worked")`
            );
          });
        }
      });
    }
    
    // School Alumni searches - SECONDARY priority (after work alumni)
    if (school) {
      const schoolVariations = [
        school,
        school.replace(/University|College|Institute|School/gi, '').trim(),
        school.split(' ')[0] // First word (e.g., "Stanford" from "Stanford University")
      ];
      
      schoolVariations.forEach(schoolVar => {
        if (schoolVar && schoolVar.length > 2) {
          prioritySearches.push(
            // More specific school-based searches
            `site:linkedin.com/in/ "${companyName}" "${schoolVar}" ("graduate" OR "alumni" OR "degree")`,
            `site:linkedin.com/in/ "${companyName}" "${schoolVar}" ("studied" OR "education" OR "bachelor" OR "master")`
          );
        }
      });
    }
    
    return prioritySearches;
  };
    }
    
    return prioritySearches;
  };

  // Priority search for WORK ALUMNI FIRST, then school alumni
  const searchPriorityConnections = async (companyName, school, previousCompany) => {
    const maxWorkColleagues = 8; // Target number of work colleagues
    addLog(`🎯 PRIORITY SEARCH: Looking for ${previousCompany} work colleagues FIRST (target: ${maxWorkColleagues}), then ${school} alumni at ${companyName}...`, 'info');
    
    const prioritySearches = generatePriorityConnectionSearches(companyName, school, previousCompany);
    const priorityProfiles = [];
    const seenProfiles = new Set(); // Prevent duplicates
    
    // SMART SEARCH: Prioritize work searches and stop early if we find enough
    let workColleaguesFound = 0;
    
    for (let i = 0; i < prioritySearches.length && workColleaguesFound < maxWorkColleagues; i++) {
      const searchQuery = prioritySearches[i];
      const isWorkColleague = searchQuery.includes(previousCompany);
      
      addLog(`${isWorkColleague ? '💼 WORK' : '🎓 SCHOOL'} search: ${searchQuery.substring(0, 70)}...`, 'info');
      
      try {
        // Shorter delay for work colleagues (higher priority)
        await new Promise(resolve => setTimeout(resolve, isWorkColleague ? 1500 : 2500));
        
        const data = await searchWithCache(searchQuery, isWorkColleague ? 10 : 6); // More results for work searches
        
        if (data.items) {
          const profiles = await extractProfilesFromSearchResults(data.items, companyName);
          
          // Deduplicate and mark priority connections
          const newProfiles = profiles.filter(profile => {
            const profileKey = `${profile.name}-${profile.linkedinUrl}`;
            if (seenProfiles.has(profileKey)) return false;
            seenProfiles.add(profileKey);
            return true;
          });
          
          const priorityMarkedProfiles = newProfiles.map(profile => ({
            ...profile,
            isPriorityConnection: true,
            priorityReason: isWorkColleague ? `Former ${previousCompany} Colleague` : `${school} Alumni`,
            priorityScore: isWorkColleague ? 10 : 7 // Higher score for work colleagues
          }));
          
          priorityProfiles.push(...priorityMarkedProfiles);
          
          addLog(`${isWorkColleague ? '💼' : '🎓'} Found ${newProfiles.length} ${isWorkColleague ? 'WORK' : 'school'} connections!`, 'success');
          
          // Track work colleagues found
          if (isWorkColleague) {
            workColleaguesFound += newProfiles.length;
            if (workColleaguesFound >= maxWorkColleagues) {
              addLog(`🎯 EFFICIENCY: Found ${workColleaguesFound} work colleagues, stopping work searches`, 'success');
              break;
            }
          }
        }
        
      } catch (error) {
        addLog(`Priority search failed: ${error.message}`, 'error');
        continue;
      }
    }
    
    // Sort by priority score (work colleagues first)
    priorityProfiles.sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0));
    return priorityProfiles;
  };

  const searchGoogleForLinkedInProfiles = async (companyName) => {
    addLog(`🔍 Searching Google for ${companyName} LinkedIn profiles with optimized queries...`, 'info');
    
    const searchStrings = generateLinkedInSearchStrings(companyName);
    const allProfiles = [];
    const seenProfiles = new Set();
    
    // Process high-value searches first with better deduplication
    for (let i = 0; i < Math.min(searchStrings.length, 6); i++) {
      const searchQuery = searchStrings[i];
      const isHighValue = searchQuery.includes('senior') || searchQuery.includes('principal') || searchQuery.includes('manager') || searchQuery.includes('director');
      
      addLog(`${isHighValue ? '⭐ HIGH-VALUE' : '📋 STANDARD'} search: ${searchQuery.substring(0, 75)}...`, 'info');
      
      try {
        // Faster processing for better user experience
        await new Promise(resolve => setTimeout(resolve, 1200));
        
        const data = await searchWithCache(searchQuery, isHighValue ? 12 : 8); // More results for high-value searches
        
        if (data.items) {
          const profiles = await extractProfilesFromSearchResults(data.items, companyName);
          
          // Deduplicate profiles
          const newProfiles = profiles.filter(profile => {
            const profileKey = `${profile.name}-${profile.linkedinUrl}`;
            if (seenProfiles.has(profileKey)) return false;
            seenProfiles.add(profileKey);
            return true;
          });
          
          // Add quality score based on search type
          const scoredProfiles = newProfiles.map(profile => ({
            ...profile,
            qualityScore: isHighValue ? 8 : 5
          }));
          
          allProfiles.push(...scoredProfiles);
          addLog(`${isHighValue ? '⭐' : '📋'} Found ${newProfiles.length} LinkedIn profiles`, 'success');
        }
        
      } catch (error) {
        addLog(`Search failed: ${error.message}`, 'error');
        continue;
      }
    }
    
    // Sort by quality score
    allProfiles.sort((a, b) => (b.qualityScore || 0) - (a.qualityScore || 0));
    
    return allProfiles;
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

  // Enhanced name extraction with better patterns for WORK contexts
  const extractNameFromTitle = (title) => {
    if (!title) return null;
    
    // LinkedIn titles usually start with the person's name
    // Work-focused patterns to catch professional profiles better
    const patterns = [
      // Standard LinkedIn patterns
      /^([^-|,]+?)\s*[-|,]\s*(?:Senior|Principal|Staff|Lead|Manager|Director|VP|Engineer|Developer|Architect)/i,
      /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s*[-|,]/,  // Name before professional delimiter
      
      // Professional title contexts
      /^([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s*\|\s*(?:Software|Product|Data|Engineering)/i,
      
      // Work experience patterns
      /^([A-Z][a-z]+\s+[A-Z][a-z]+)\s*[-:]\s*(?:Former|Current|Ex-)/i,
      
      // Basic patterns
      /^([^-|,]+)(?:\s*-|\s*\||,)/,
      /([A-Z][a-z]+\s+[A-Z][a-z]+)/ // Fallback
    ];
    
    for (const pattern of patterns) {
      const match = title.match(pattern);
      if (match) {
        let name = match[1].trim();
        
        // Remove common prefixes and suffixes
        name = name.replace(/^(Dr\.?|Mr\.?|Ms\.?|Mrs\.?|Prof\.?)\s+/i, '');
        name = name.replace(/\s+(Jr\.?|Sr\.?|II|III|PhD|MD|CPA|PE)$/i, '');
        name = name.replace(/\s+(LinkedIn|Profile)$/i, '');
        
        // Validate name quality (stricter for work contexts)
        const words = name.split(' ');
        if (words.length >= 2 && words.length <= 4 && 
            name.length > 3 && name.length < 50 &&
            !/\d/.test(name) && // No numbers
            !/[^\w\s.'-]/.test(name) && // Only letters, spaces, dots, hyphens, apostrophes
            !/(software|engineer|manager|director|developer|analyst)/i.test(name)) { // Not job titles
          return name;
        }
>>>>>>> Stashed changes
      }
    }
    return null;
  };

  // Enhanced job title extraction with WORK-FOCUSED patterns
  const extractJobTitleFromSnippet = (snippet) => {
    if (!snippet) return 'Professional';
    
    // WORK-FOCUSED title patterns prioritizing career/experience mentions
    const titlePatterns = [
      // Career transition patterns (high priority for work alumni)
      /(?:former|previous|ex-)\s*([^.,;]+?)\s+(?:at|with)/i,
      /(?:worked as|served as|was)\s+(?:a|an)?\s*([^.,;]+?)\s+(?:at|with|for)/i,
      
      // Current professional roles
      /(?:currently|now|presently)\s+(?:a|an)?\s*((?:Senior|Principal|Staff|Lead)?\s*(?:Software|Product|Data|Engineering|Technology)?\s*(?:Engineer|Manager|Director|Developer|Designer|Architect|Scientist)[^.,;]*)/i,
      
      // LinkedIn headline patterns
      /((?:Senior|Principal|Staff|Lead|VP|Director)\s+(?:Software|Product|Data|Engineering|Technology|Marketing|Sales)?\s*(?:Engineer|Manager|Director|Developer|Designer|Architect|Scientist))/i,
      
      // Experience statements
      /(?:experience as|background in|worked in)\s+([^.,;]+)/i,
      /(?:specializes in|expert in|focuses on)\s+([^.,;]+)/i,
      
      // Job title + company patterns
      /((?:[A-Z][a-z]+\s+){1,3}(?:Engineer|Manager|Director|Developer|Designer|Analyst|Scientist|Architect))\s+at\s+/i,
      
      // Generic professional patterns
      /\b((?:Senior|Principal|Staff|Lead|Junior)?\s*(?:Software|Frontend|Backend|Full[- ]?Stack|DevOps|Data|Machine Learning|AI|Product|Engineering)?\s*(?:Engineer|Developer|Manager|Director|Architect|Scientist|Designer)[^.,;]*)/i,
      
      // Role context patterns
      /(?:role|position|title)\s*[:\-]?\s*([^.,;]+)/i
    ];
    
    for (const pattern of titlePatterns) {
      const match = snippet.match(pattern);
      if (match) {
        let title = match[1].trim();
        
        // Clean up the title for work contexts
        title = title.replace(/\s+(?:at|with|for|in)\s+.*/i, ''); // Remove company references
        title = title.replace(/\s*[.,;]\s*.*/, ''); // Remove trailing content
        title = title.replace(/^\s*(a|an|the)\s+/i, ''); // Remove articles
        title = title.replace(/\s+(role|position|job)$/i, ''); // Remove generic suffixes
        
        // Validate title quality (stricter for professional contexts)
        if (title.length > 3 && title.length < 80 && 
            !/^\d/.test(title) && // Doesn't start with number
            title.split(' ').length <= 6 && // Reasonable length
            !/^(and|or|the|with|for|at)$/i.test(title)) { // Not just prepositions
          
          // Proper capitalization for professional titles
          title = title.replace(/\b(\w)/g, char => char.toUpperCase());
          title = title.replace(/\b(Of|At|In|For|And|Or|The)\b/g, word => word.toLowerCase());
          title = title.replace(/^(\w)/, char => char.toUpperCase()); // Capitalize first word
          
          return title;
        }
      }
    }
    
    return 'Professional';
  };

<<<<<<< Updated upstream
=======


  const searchAdditionalLinkedInProfiles = async (companyName, previousCompany) => {
    addLog(`🔍+ Searching for WORK-FOCUSED additional ${companyName} profiles...`, 'info');
    
    try {
      // WORK-FOCUSED additional searches - targeting career transitions and experience
      const additionalSearches = [
        // Executive level (great networking targets)
        `site:linkedin.com/in/ "${companyName}" ("VP" OR "director" OR "head of" OR "chief")`,
        
        // Career transition patterns (more likely to be work alumni)
        `site:linkedin.com/in/ "${companyName}" ("joined" OR "moved to" OR "transitioned" OR "recently")`,
        
        // Experience-based searches
        `site:linkedin.com/in/ "${companyName}" ("years experience" OR "background in" OR "worked at")`,
        
        // Cross-company network searches if we have previous company
        ...(previousCompany ? [
          `site:linkedin.com/in/ "${companyName}" "${previousCompany}" ("network" OR "connections" OR "colleagues")`,
          `site:linkedin.com/in/ "${companyName}" "${previousCompany}" ("team" OR "worked with" OR "collaborated")`
        ] : [])
      ];
      
      const profiles = [];
      const seenProfiles = new Set();
      
      for (let i = 0; i < Math.min(additionalSearches.length, 4); i++) {
        const searchQuery = additionalSearches[i];
        const isExecutiveSearch = searchQuery.includes('VP') || searchQuery.includes('director') || searchQuery.includes('chief');
        
        addLog(`${isExecutiveSearch ? '💼 EXEC' : '🔗 NETWORK'} search: ${searchQuery.substring(0, 65)}...`, 'info');
        
        try {
          await new Promise(resolve => setTimeout(resolve, 1800));
          
          const data = await searchWithCache(searchQuery, isExecutiveSearch ? 10 : 8);
          if (data.items) {
            const searchProfiles = await extractProfilesFromSearchResults(data.items, companyName);
            
            // Deduplicate
            const newProfiles = searchProfiles.filter(profile => {
              const profileKey = `${profile.name}-${profile.linkedinUrl}`;
              if (seenProfiles.has(profileKey)) return false;
              seenProfiles.add(profileKey);
              return true;
            });
            
            // Add network score
            const scoredProfiles = newProfiles.map(profile => ({
              ...profile,
              networkScore: isExecutiveSearch ? 9 : 6
            }));
            
            profiles.push(...scoredProfiles);
            addLog(`${isExecutiveSearch ? '💼' : '🔗'} Found ${newProfiles.length} additional profiles`, 'success');
          }
        } catch (error) {
          addLog(`Additional search failed: ${error.message}`, 'error');
          continue;
        }
      }
      
      // Sort by network score
      profiles.sort((a, b) => (b.networkScore || 0) - (a.networkScore || 0));
      
      return profiles;
      
    } catch (error) {
      addLog(`Additional profile search failed: ${error.message}`, 'error');
      return [];
    }
  };

  // WORK-FOCUSED: Search for professional connections across platforms
  const searchSocialMediaProfiles = async (companyName, previousCompany) => {
    addLog(`🌐 Searching professional platforms for ${companyName} WORK connections...`, 'info');
    
    const socialProfiles = [];
    const socialSearches = [];
    
    // HIGH-VALUE: Career transition focused searches
    if (previousCompany) {
      socialSearches.push(
        // GitHub career transitions (very specific)
        `site:github.com "${companyName}" "${previousCompany}" ("former" OR "previously" OR "moved from")`,
        `site:github.com "${companyName}" "${previousCompany}" "software engineer"`,
        
        // Professional blog mentions
        `"${companyName}" "${previousCompany}" ("joined" OR "career" OR "transition" OR "experience")`,
        
        // Company announcement searches
        `"${companyName}" "${previousCompany}" ("welcome" OR "new hire" OR "team member" OR "announcement")`
      );
    }
    
    // GitHub profiles with company mentions (professional focus)
    socialSearches.push(
      `site:github.com "${companyName}" "software engineer" (bio OR profile OR readme)`,
      `site:github.com "${companyName}" ("senior" OR "principal" OR "lead") engineer`,
      `site:github.com "${companyName}" "@" (email OR contact) -site:github.com/orgs`
    );
    
    // Company team pages and professional directories
    socialSearches.push(
      `"${companyName}" ("engineering team" OR "our engineers" OR "meet the team") -jobs -careers`,
      `"${companyName}" "staff" OR "team members" (engineer OR developer OR manager OR director)`
    );
    
    const seenProfiles = new Set();
    
    for (let i = 0; i < Math.min(socialSearches.length, 6); i++) {
      const searchQuery = socialSearches[i];
      const isWorkTransition = searchQuery.includes(previousCompany);
      
      addLog(`${isWorkTransition ? '💼 CAREER' : '🌐 SOCIAL'} search: ${searchQuery.substring(0, 70)}...`, 'info');
      
      try {
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const data = await searchWithCache(searchQuery, isWorkTransition ? 8 : 6);
        if (data.items) {
          const profiles = await extractSocialProfiles(data.items, companyName);
          
          // Deduplicate and add career transition flag
          const newProfiles = profiles.filter(profile => {
            const profileKey = `${profile.name}-${profile.company}`.toLowerCase();
            if (seenProfiles.has(profileKey)) return false;
            seenProfiles.add(profileKey);
            return true;
          }).map(profile => ({
            ...profile,
            isCareerTransition: isWorkTransition,
            socialScore: isWorkTransition ? 7 : 4
          }));
          
          socialProfiles.push(...newProfiles);
          addLog(`${isWorkTransition ? '💼' : '🌐'} Found ${newProfiles.length} professional profiles`, 'success');
        }
      } catch (error) {
        addLog(`Social search failed: ${error.message}`, 'error');
        continue;
      }
    }
    
    // Sort by social score (career transitions first)
    socialProfiles.sort((a, b) => (b.socialScore || 0) - (a.socialScore || 0));
    
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

>>>>>>> Stashed changes
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
              content: `You must categorize these LinkedIn profiles based on their connection to someone applying to ${formData.targetCompany}.

The applicant went to: ${formData.school}
The applicant previously worked at: ${formData.previousCompany}

CRITICAL CATEGORIZATION RULES:
- If a profile was found through a "${formData.school}" search (check priorityReason field), they are "School Alumni"
- If a profile was found through a "${formData.previousCompany}" search (check priorityReason field), they are "Work Alumni"  
- If priorityReason contains "Alumni", they are "School Alumni"
- If priorityReason contains "Colleague", they are "Work Alumni"
- Only use "Industry Contact" for profiles with no school/work connection

Profiles to analyze: ${JSON.stringify(profiles)}

For each profile, determine:
1. Connection type using the rules above
2. Department classification  
3. Seniority level
4. Likelihood they would respond to networking (1-10)

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
        return profiles.map(p => {
          let connectionType = 'Industry Contact';
          if (p.isPriorityConnection && p.priorityReason) {
            if (p.priorityReason.includes('Alumni')) {
              connectionType = 'School Alumni';
            } else if (p.priorityReason.includes('Colleague')) {
              connectionType = 'Work Alumni';
            }
          }
          return {
            ...p,
            connectionType,
            department: 'Unknown',
            seniority: 'Mid',
            responseRate: 6,
            outreachTips: 'Mention your mutual connection and be specific about your ask.'
          };
        });
      }

      const data = await response.json();
      
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        addLog(`OpenAI enrichment returned unexpected format: ${JSON.stringify(data)}`, 'error');
        return profiles.map(p => {
          let connectionType = 'Industry Contact';
          if (p.isPriorityConnection && p.priorityReason) {
            if (p.priorityReason.includes('Alumni')) {
              connectionType = 'School Alumni';
            } else if (p.priorityReason.includes('Colleague')) {
              connectionType = 'Work Alumni';
            }
          }
          return {
            ...p,
            connectionType,
            department: 'Unknown',
            seniority: 'Mid',
            responseRate: 6,
            outreachTips: 'Mention your mutual connection and be specific about your ask.'
          };
        });
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
        enrichedProfiles = profiles.map(p => {
          let connectionType = 'Industry Contact';
          if (p.isPriorityConnection && p.priorityReason) {
            if (p.priorityReason.includes('Alumni')) {
              connectionType = 'School Alumni';
            } else if (p.priorityReason.includes('Colleague')) {
              connectionType = 'Work Alumni';
            }
          }
          return {
            ...p,
            connectionType,
            department: 'Unknown',
            seniority: 'Mid',
            responseRate: 6,
            outreachTips: 'Mention your mutual connection and be specific about your ask.'
          };
        });
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
      
<<<<<<< Updated upstream
      addLog('Skipping additional searches to conserve API quota - focusing on priority connections only', 'info');
      const linkedinProfiles = [];
      const additionalProfiles = [];
      
      const allProfiles = [...priorityProfiles, ...linkedinProfiles, ...additionalProfiles];
      const uniqueProfiles = allProfiles.filter((profile, index, self) => 
        index === self.findIndex(p => p.name === profile.name)
      );
=======
      const linkedinProfiles = await searchGoogleForLinkedInProfiles(formData.targetCompany);
      const additionalProfiles = await searchAdditionalLinkedInProfiles(formData.targetCompany, formData.previousCompany);
      const socialProfiles = await searchSocialMediaProfiles(formData.targetCompany, formData.previousCompany);
      
      const allProfiles = [...priorityProfiles, ...linkedinProfiles, ...additionalProfiles, ...socialProfiles];
      
      // Better deduplication and scoring
      const profileMap = new Map();
      allProfiles.forEach(profile => {
        const key = `${profile.name}-${profile.company}`.toLowerCase().replace(/[^a-z0-9]/g, '');
        const existing = profileMap.get(key);
        
        if (!existing || (profile.priorityScore || profile.qualityScore || profile.networkScore || 0) > 
                         (existing.priorityScore || existing.qualityScore || existing.networkScore || 0)) {
          profileMap.set(key, profile);
        }
      });
      
      const uniqueProfiles = Array.from(profileMap.values());
      
      // Sort by overall quality: work alumni > school alumni > others
      uniqueProfiles.sort((a, b) => {
        const scoreA = (a.priorityScore || 0) + (a.qualityScore || 0) + (a.networkScore || 0);
        const scoreB = (b.priorityScore || 0) + (b.qualityScore || 0) + (b.networkScore || 0);
        return scoreB - scoreA;
      });
>>>>>>> Stashed changes
      
      if (uniqueProfiles.length === 0) {
        addLog('No LinkedIn profiles found. Try a larger company or check your API setup.', 'error');
        return;
      }

<<<<<<< Updated upstream
      addLog(`Found ${uniqueProfiles.length} LinkedIn profiles, enriching with AI...`, 'success');
=======
      const workAlumni = uniqueProfiles.filter(p => p.priorityReason && p.priorityReason.includes('Colleague')).length;
      const schoolAlumni = uniqueProfiles.filter(p => p.priorityReason && p.priorityReason.includes('Alumni')).length;
      const others = uniqueProfiles.length - workAlumni - schoolAlumni;
      
      addLog(`🎉 DISCOVERY COMPLETE: ${uniqueProfiles.length} profiles found`, 'success');
      addLog(`💼 Work Alumni: ${workAlumni} | 🎓 School Alumni: ${schoolAlumni} | 🔗 Others: ${others}`, 'info');
>>>>>>> Stashed changes
      
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
<<<<<<< Updated upstream
      case 'School Alumni': return 'bg-blue-900 text-blue-200 border-blue-700';
      case 'Work Alumni': return 'bg-green-900 text-green-200 border-green-700';
      case 'Industry Contact': return 'bg-gray-700 text-gray-200 border-gray-600';
      case 'Direct Contact': return 'bg-purple-900 text-purple-200 border-purple-700';
      default: return 'bg-gray-700 text-gray-200 border-gray-600';
    }
  };

  const getLogTypeColor = (type) => {
    switch (type) {
      case 'success': return 'text-green-400';
      case 'error': return 'text-red-400';
      case 'warning': return 'text-yellow-400';
      default: return 'text-gray-400';
=======
      case 'Alumni': 
        return 'bg-gradient-to-r from-blue-100 to-sky-100 text-blue-700 border-2 border-blue-300 shadow-md font-bold';
      case 'Former Colleague': 
        return 'bg-gradient-to-r from-green-100 to-emerald-100 text-green-700 border-2 border-green-300 shadow-md font-bold';
      case 'Industry Contact': 
        return 'bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 border-2 border-purple-300 shadow-md font-bold';
      case 'Direct Contact': 
        return 'bg-gradient-to-r from-orange-100 to-amber-100 text-orange-700 border-2 border-orange-300 shadow-md font-bold';
      default: 
        return 'bg-gradient-to-r from-gray-100 to-slate-100 text-gray-700 border-2 border-gray-300 shadow-md font-bold';
>>>>>>> Stashed changes
    }
  };

  return (
<<<<<<< Updated upstream
    <div className="min-h-screen bg-black">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <h1 className="text-3xl font-bold text-white">Connection Finder</h1>
            <p className="mt-2 text-gray-400">Find LinkedIn connections using Google Search API with verified emails</p>
        </div>
            </div>
          </div>
          
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Main Form */}
        <div className="bg-gray-900 rounded-xl shadow-sm border border-gray-800 p-8 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <Building2 className="w-4 h-4 inline mr-2" />
                Target Company
=======
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-stone-100 to-neutral-100 relative overflow-hidden">
      {/* Floating Background Elements */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-10 left-10 w-32 h-32 bg-gradient-to-br from-slate-200/20 to-stone-200/20 rounded-full blur-xl animate-pulse"></div>
        <div className="absolute top-20 right-20 w-48 h-48 bg-gradient-to-br from-neutral-200/15 to-gray-200/15 rounded-full blur-2xl animate-bounce" style={{animationDuration: '3s'}}></div>
        <div className="absolute bottom-20 left-1/4 w-24 h-24 bg-gradient-to-br from-stone-200/25 to-slate-200/25 rounded-full blur-lg animate-pulse" style={{animationDelay: '1s'}}></div>
        <div className="absolute bottom-10 right-1/3 w-40 h-40 bg-gradient-to-br from-gray-200/20 to-neutral-200/20 rounded-full blur-xl animate-bounce" style={{animationDelay: '2s', animationDuration: '4s'}}></div>
      </div>
      
      <div className="relative z-10 max-w-6xl mx-auto p-6 lg:p-12">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <div className="relative mb-8">
            <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 w-24 h-24 bg-gradient-to-br from-pink-400 to-orange-400 rounded-full opacity-20 animate-spin" style={{animationDuration: '8s'}}></div>
            <div className="relative">
              <h1 className="text-6xl lg:text-8xl font-black bg-gradient-to-r from-slate-700 via-stone-700 to-gray-700 bg-clip-text text-transparent mb-6 leading-tight">
                ConnectSphere
              </h1>
              <div className="flex items-center justify-center gap-2 mb-4">
                <Sparkles className="w-6 h-6 text-slate-500 animate-pulse" />
                <span className="text-2xl font-bold text-slate-700">Find Your Network</span>
                <Sparkles className="w-6 h-6 text-stone-500 animate-pulse" style={{animationDelay: '0.5s'}} />
              </div>
            </div>
          </div>
          <p className="text-xl text-gray-700 max-w-3xl mx-auto leading-relaxed mb-8 font-medium">
            ✨ Discover meaningful professional connections through AI-powered relationship mapping and intelligent outreach strategies
          </p>
          <div className="flex flex-wrap justify-center gap-4 mt-8">
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl px-6 py-3 border border-slate-300 shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-slate-600" />
                <span className="text-slate-700 font-bold">Smart Targeting</span>
              </div>
            </div>
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl px-6 py-3 border border-stone-300 shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105">
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-stone-600" />
                <span className="text-stone-700 font-bold">Multi-Platform</span>
              </div>
            </div>
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl px-6 py-3 border border-gray-300 shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-gray-600" />
                <span className="text-gray-700 font-bold">Instant Results</span>
              </div>
            </div>
          </div>
        </div>

        {/* API Status Section */}
        {(apiKeys.openai && apiKeys.googleSearch && apiKeys.googleCSE) ? null : (
          <div className="relative mb-16">
            <div className="absolute inset-0 bg-gradient-to-r from-amber-200/30 to-orange-200/30 rounded-3xl blur-xl"></div>
            <div className="relative bg-white/95 backdrop-blur-xl rounded-3xl border border-amber-300 shadow-lg p-6">
              <div className="flex items-center justify-center">
                <div className="text-center">
                  <div className="w-12 h-12 bg-amber-500 rounded-full flex items-center justify-center mx-auto mb-3">
                    <span className="text-white font-bold">⚠️</span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-800 mb-2">API Configuration Required</h3>
                  <p className="text-gray-600 text-sm">Please add your API keys to the .env file to use the discovery engine.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Target Information Section */}
        <div className="relative mb-16">
          <div className="absolute inset-0 bg-gradient-to-r from-slate-200/30 to-stone-200/30 rounded-3xl blur-xl"></div>
          <div className="relative bg-white/95 backdrop-blur-xl rounded-3xl border border-slate-300 shadow-lg p-8">
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 bg-gradient-to-br from-slate-500 to-stone-500 rounded-full flex items-center justify-center">
                  <Target className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-3xl font-black text-gray-800">Target Information</h2>
              </div>
              <p className="text-gray-600 font-medium">Tell us about your networking goals and background</p>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <div className="space-y-4">
                <label className="flex items-center text-sm font-bold text-slate-700 mb-3">
                  <div className="w-6 h-6 bg-slate-500 rounded-full flex items-center justify-center mr-3">
                    <Building className="w-4 h-4 text-white" />
                  </div>
                  Target Company *
>>>>>>> Stashed changes
                </label>
                <input
                  type="text"
                  value={formData.targetCompany}
                  onChange={(e) => setFormData({...formData, targetCompany: e.target.value})}
<<<<<<< Updated upstream
                placeholder="e.g., Apple, Google, Microsoft"
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400"
                />
              </div>
              
              <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <Building2 className="w-4 h-4 inline mr-2" />
                Your Old Company
=======
                  placeholder="e.g., Microsoft, Stripe, Airbnb"
                  className="w-full px-6 py-4 bg-slate-50/80 border border-slate-300 rounded-2xl text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-500 transition-all duration-300 font-medium shadow-sm hover:shadow-md"
                />
              </div>
              
              <div className="space-y-4">
                <label className="flex items-center text-sm font-bold text-stone-700 mb-3">
                  <div className="w-6 h-6 bg-stone-500 rounded-full flex items-center justify-center mr-3">
                    <Building className="w-4 h-4 text-white" />
                  </div>
                  Previous Company *
>>>>>>> Stashed changes
                </label>
                <input
                  type="text"
                  value={formData.previousCompany}
                  onChange={(e) => setFormData({...formData, previousCompany: e.target.value})}
<<<<<<< Updated upstream
                placeholder="e.g., Microsoft, Amazon, Meta"
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400"
                />
              </div>
              
              <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <GraduationCap className="w-4 h-4 inline mr-2" />
                School/University
=======
                  placeholder="e.g., Google, Meta, Apple"
                  className="w-full px-6 py-4 bg-stone-50/80 border border-stone-300 rounded-2xl text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:border-stone-500 transition-all duration-300 font-medium shadow-sm hover:shadow-md"
                />
              </div>
              
              <div className="space-y-4">
                <label className="flex items-center text-sm font-bold text-gray-700 mb-3">
                  <div className="w-6 h-6 bg-gray-500 rounded-full flex items-center justify-center mr-3">
                    <GraduationCap className="w-4 h-4 text-white" />
                  </div>
                  School/University *
>>>>>>> Stashed changes
                </label>
                <input
                  type="text"
                  value={formData.school}
                  onChange={(e) => setFormData({...formData, school: e.target.value})}
<<<<<<< Updated upstream
                placeholder="e.g., Stanford, MIT, Harvard"
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400"
                />
              </div>
              
              <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <User className="w-4 h-4 inline mr-2" />
                Your Name
=======
                  placeholder="e.g., Stanford, MIT, Carnegie Mellon"
                  className="w-full px-6 py-4 bg-gray-50/80 border border-gray-300 rounded-2xl text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-gray-500 transition-all duration-300 font-medium shadow-sm hover:shadow-md"
                />
              </div>
              
              <div className="space-y-4">
                <label className="flex items-center text-sm font-bold text-neutral-700 mb-3">
                  <div className="w-6 h-6 bg-neutral-500 rounded-full flex items-center justify-center mr-3">
                    <Users className="w-4 h-4 text-white" />
                  </div>
                  Your Name *
>>>>>>> Stashed changes
                </label>
                <input
                  type="text"
                  value={formData.yourName}
                  onChange={(e) => setFormData({...formData, yourName: e.target.value})}
<<<<<<< Updated upstream
                placeholder="Your full name"
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400"
=======
                  placeholder="e.g., Alex Chen"
                  className="w-full px-6 py-4 bg-neutral-50/80 border border-neutral-300 rounded-2xl text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:border-neutral-500 transition-all duration-300 font-medium shadow-sm hover:shadow-md"
>>>>>>> Stashed changes
                />
              </div>
            </div>
            
          {/* API Status */}
          <div className="bg-gray-800 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                {apiKeys.openai && apiKeys.googleSearch && apiKeys.googleCSE ? (
                  <Check className="w-5 h-5 text-green-400 mr-2" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-400 mr-2" />
                )}
                <span className="text-sm font-medium text-gray-300">API Configuration</span>
              </div>
              <span className={`text-sm font-medium ${apiKeys.openai && apiKeys.googleSearch && apiKeys.googleCSE ? 'text-green-400' : 'text-red-400'}`}>
                {apiKeys.openai && apiKeys.googleSearch && apiKeys.googleCSE ? 'All Configured' : 'Missing Keys'}
              </span>
            </div>
          </div>

          {/* Search Button */}
            <button
              onClick={discoverConnections}
<<<<<<< Updated upstream
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
=======
              disabled={loading || !formData.targetCompany || !formData.previousCompany || !formData.school || !formData.yourName}
              className="group relative w-full overflow-hidden transform hover:scale-[1.02] transition-all duration-300 disabled:hover:scale-100"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-slate-600 via-stone-600 to-gray-600 rounded-2xl shadow-lg group-hover:shadow-xl transition-all duration-300"></div>
              <div className="absolute inset-0 bg-gradient-to-r from-slate-500 via-stone-500 to-gray-500 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative px-8 py-5 flex items-center justify-center text-lg font-black text-white">
                {loading ? (
                  <>
                    <Loader2 className="animate-spin w-7 h-7 mr-4 text-white" />
                    <span className="text-white">
                      Discovering Connections...
                    </span>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                        <Search className="w-5 h-5 text-white" />
                      </div>
                      <span className="text-white">
                        Launch Discovery Engine
                      </span>
                      <Sparkles className="w-6 h-6 text-white animate-pulse" />
                    </div>
                  </>
                )}
              </div>
>>>>>>> Stashed changes
            </button>
        </div>

                {/* Search Logs */}
        {extractionLog.length > 0 && (
<<<<<<< Updated upstream
          <div className="bg-gray-900 rounded-xl shadow-sm border border-gray-800 p-6 mb-8">
            <h3 className="text-lg font-semibold text-white mb-4">Search Progress</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
            {extractionLog.map((log, index) => (
                <div key={index} className="flex items-start text-sm">
                  <span className="text-gray-500 mr-3 font-mono">{log.timestamp}</span>
                  <span className={getLogTypeColor(log.type)}>{log.message}</span>
=======
          <div className="relative mb-16">
            <div className="absolute inset-0 bg-gradient-to-r from-green-200/40 to-emerald-200/40 rounded-3xl blur-xl"></div>
            <div className="relative bg-white/90 backdrop-blur-xl rounded-3xl border-2 border-green-200 shadow-2xl p-6">
              <div className="flex items-center mb-6">
                <div className="w-6 h-6 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center mr-3">
                  <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
                </div>
                <h3 className="text-2xl font-bold text-gray-800">Real-Time Discovery Log</h3>
                <Sparkles className="w-6 h-6 text-green-500 ml-2 animate-pulse" />
              </div>
              <div className="bg-green-50/80 border-2 border-green-200 rounded-2xl p-4 font-mono text-sm max-h-60 overflow-y-auto custom-scrollbar shadow-inner">
                {extractionLog.map((log, index) => (
                  <div key={index} className="flex items-start mb-3 last:mb-0 p-2 rounded-lg hover:bg-white/50 transition-colors duration-200">
                    <span className="text-gray-500 mr-3 flex-shrink-0 min-w-[65px] font-bold">[{log.timestamp}]</span>
                    {log.type === 'success' && <CheckCircle className="w-4 h-4 mr-2 text-green-600 flex-shrink-0 mt-0.5" />}
                    {log.type === 'error' && <AlertCircle className="w-4 h-4 mr-2 text-red-600 flex-shrink-0 mt-0.5" />}
                    {log.type === 'info' && <div className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5"><div className="w-3 h-3 bg-blue-500 rounded-full mx-auto"></div></div>}
                    <span className={`leading-relaxed font-medium ${
                      log.type === 'error' ? 'text-red-700' : 
                      log.type === 'success' ? 'text-green-700' : 
                      'text-blue-700'
                    }`}>
                      {log.message}
                    </span>
                  </div>
                ))}
>>>>>>> Stashed changes
              </div>
            ))}
            </div>
          </div>
        )}

        {/* Results */}
        {searchComplete && connections.length > 0 && (
<<<<<<< Updated upstream
          <div className="space-y-8">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-white">Found {connections.length} LinkedIn Connections</h2>
              <p className="text-gray-400 mt-2">Priority connections shown with verified email patterns</p>
=======
          <div className="space-y-16">
            <div className="text-center mb-16">
              <div className="relative mb-8">
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 w-32 h-32 bg-gradient-to-br from-green-400/30 to-emerald-400/30 rounded-full animate-bounce" style={{animationDuration: '3s'}}></div>
                <div className="relative">
                  <h2 className="text-5xl lg:text-6xl font-black bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 bg-clip-text text-transparent mb-6">
                    🎉 Discovery Complete!
                  </h2>
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <Heart className="w-6 h-6 text-pink-500 animate-pulse" />
                    <span className="text-2xl font-bold text-gray-700">Your Network Awaits</span>
                    <Heart className="w-6 h-6 text-pink-500 animate-pulse" style={{animationDelay: '0.5s'}} />
                  </div>
                </div>
              </div>
              <p className="text-xl text-gray-700 mb-8 font-medium">Found {connections.length} amazing connections across multiple platforms ✨</p>
              <div className="flex flex-wrap justify-center gap-4">
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl px-6 py-3 border-2 border-green-200 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                  <div className="flex items-center gap-2">
                    <Star className="w-5 h-5 text-green-600" />
                    <span className="text-green-700 font-bold">{connections.filter(c => c.isPriorityConnection).length} Priority</span>
                  </div>
                </div>
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl px-6 py-3 border-2 border-blue-200 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-600" />
                    <span className="text-blue-700 font-bold">{connections.filter(c => !c.isPriorityConnection).length} Additional</span>
                  </div>
                </div>
              </div>
>>>>>>> Stashed changes
            </div>

            {/* Priority Connections */}
            {connections.filter(c => c.isPriorityConnection).length > 0 && (
<<<<<<< Updated upstream
              <div>
                <div className="bg-blue-900 rounded-lg p-4 mb-6 border border-blue-700">
                  <h3 className="text-lg font-semibold text-blue-100 text-center">
                    Priority Connections ({connections.filter(c => c.isPriorityConnection).length})
                  </h3>
                  <p className="text-blue-300 text-center text-sm">School Alumni & Former Colleagues at {formData.targetCompany}</p>
=======
              <div className="mb-20">
                <div className="relative mb-10">
                  <div className="absolute inset-0 bg-gradient-to-r from-green-200/50 to-emerald-200/50 blur-2xl rounded-3xl"></div>
                  <div className="relative text-center p-10 bg-white/90 backdrop-blur-sm rounded-3xl border-2 border-green-300 shadow-2xl">
                    <div className="flex items-center justify-center mb-4">
                      <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center mr-3">
                        <Star className="w-5 h-5 text-white" />
                      </div>
                      <h3 className="text-3xl font-black bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                        🎆 PRIORITY CONNECTIONS ({connections.filter(c => c.isPriorityConnection).length})
                      </h3>
                    </div>
                    <p className="text-gray-700 font-bold text-lg mb-4">School Alumni & Former Colleagues at {formData.targetCompany} 🎯</p>
                    <div className="flex justify-center">
                      <div className="bg-gradient-to-r from-green-100 to-emerald-100 backdrop-blur-sm rounded-2xl px-8 py-3 border-2 border-green-300 shadow-lg">
                        <span className="text-green-700 font-black text-lg flex items-center gap-2">
                          <Heart className="w-5 h-5 text-pink-500" />
                          Highest Response Rate
                          <Heart className="w-5 h-5 text-pink-500" />
                        </span>
                      </div>
                    </div>
                  </div>
>>>>>>> Stashed changes
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {connections.filter(connection => connection.isPriorityConnection).map((connection, index) => (
<<<<<<< Updated upstream
                    <div key={`priority-${index}`} className="bg-gray-800 rounded-lg shadow-sm border border-gray-700 p-6 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center mb-2">
                            <h3 className="text-lg font-semibold text-white">{connection.name}</h3>
                            <span className="ml-2 px-2 py-1 bg-blue-600 text-blue-100 text-xs rounded-full font-medium border border-blue-500">
                              PRIORITY
                            </span>
                          </div>
                          <p className="text-sm text-gray-300 mb-1">{connection.title}</p>
                          <p className="text-sm text-gray-400 mb-1">{connection.department}</p>
                          <p className="text-xs font-medium text-blue-400">PRIORITY: {connection.priorityReason}</p>
=======
                    <div key={`priority-${index}`} className="group relative transform hover:scale-105 transition-all duration-300">
                      <div className="absolute inset-0 bg-gradient-to-r from-green-200/40 via-emerald-200/40 to-teal-200/40 rounded-3xl blur-lg group-hover:blur-xl transition-all duration-300"></div>
                      <div className="relative bg-white/95 backdrop-blur-xl rounded-3xl border-2 border-green-300 shadow-xl p-8 hover:border-green-400 hover:shadow-2xl transition-all duration-300">
                        <div className="flex items-start justify-between mb-6">
                          <div className="flex-1">
                            <div className="flex items-center mb-4">
                              <h3 className="text-2xl font-black text-gray-800">{connection.name}</h3>
                              <span className="ml-3 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white text-xs rounded-full font-black shadow-lg transform hover:scale-110 transition-transform duration-200">
                                ⭐ PRIORITY
                              </span>
                            </div>
                            <p className="text-gray-700 font-bold mb-2 text-lg">{connection.title}</p>
                            <p className="text-gray-600 text-sm mb-3 font-medium">{connection.department}</p>
                            <div className="flex items-center mb-3 p-2 bg-green-50 rounded-xl border border-green-200">
                              <div className="w-3 h-3 bg-green-500 rounded-full mr-3 animate-pulse"></div>
                              <p className="text-green-700 font-bold text-sm">{connection.priorityReason}</p>
                            </div>
                            <p className="text-gray-500 text-xs font-medium">Source: {connection.source}</p>
                          </div>
                          <span className={`px-4 py-2 rounded-2xl text-xs ${getConnectionTypeColor(connection.connectionType)}`}>
                            {connection.connectionType}
                          </span>
>>>>>>> Stashed changes
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getConnectionTypeColor(connection.connectionType)}`}>
                          {connection.connectionType}
                        </span>
                      </div>

<<<<<<< Updated upstream
                      <div className="space-y-3 mb-4">
                        <div className="flex items-center text-sm text-gray-400">
                          {connection.seniority} • {connection.responseRate}/10 response rate
                        </div>
                      </div>

                      <div className="border-t border-gray-700 pt-4">
                        <div className="mb-3">
                          <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Best Email Pattern</label>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-sm font-mono text-gray-200">{connection.primaryEmail}</span>
                            <span className={`text-xs font-medium ${connection.emailConfidence > 70 ? 'text-green-400' : 'text-yellow-400'}`}>
                              {connection.emailConfidence}%
                            </span>
                          </div>
                        </div>

                        {connection.outreachTips && (
                          <div className="mb-3 p-3 bg-blue-900 rounded text-xs text-blue-200 border border-blue-700">
                            <strong>Priority Outreach Tip:</strong> {connection.outreachTips}
=======
                        <div className="space-y-4 mb-6">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center text-gray-700 bg-gray-50 rounded-xl px-4 py-2 border border-gray-200">
                              <Building className="w-5 h-5 mr-3 text-gray-600" />
                              <span className="font-bold">{connection.seniority}</span>
                            </div>
                            <div className="flex items-center bg-gradient-to-r from-green-100 to-emerald-100 rounded-2xl px-4 py-2 border-2 border-green-300">
                              <Star className="w-4 h-4 text-green-600 mr-2" />
                              <span className="text-green-700 font-black text-sm">{connection.responseRate}/10 response</span>
                            </div>
                          </div>
                        </div>

                        <div className="border-t-2 border-green-200 pt-6">
                          <div className="mb-4">
                            <label className="text-sm font-black text-green-700 uppercase tracking-wider mb-3 block flex items-center gap-2">
                              <Mail className="w-4 h-4" />
                              Best Email Pattern
                            </label>
                            <div className="bg-green-50/80 rounded-2xl p-4 border-2 border-green-200 shadow-inner">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-mono text-gray-800 font-bold">{connection.primaryEmail}</span>
                                <span className={`text-xs font-black px-3 py-1 rounded-full border-2 ${connection.emailConfidence > 70 ? 'bg-green-100 text-green-700 border-green-300' : 'bg-amber-100 text-amber-700 border-amber-300'}`}>
                                  {connection.emailConfidence}%
                                </span>
                              </div>
                            </div>
>>>>>>> Stashed changes
                          </div>
                        )}

<<<<<<< Updated upstream
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
=======
                          <details className="mb-4">
                            <summary className="text-xs font-black text-purple-700 uppercase tracking-wider cursor-pointer hover:text-purple-800 transition-colors flex items-center gap-2">
                              <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                              Alternative Patterns ({(connection.allEmailPatterns || []).length - 1})
                            </summary>
                            <div className="mt-3 space-y-2">
                              {(connection.allEmailPatterns || []).slice(1).map((email, i) => (
                                <div key={i} className="bg-purple-50/80 rounded-xl p-3 text-sm font-mono text-gray-800 border-2 border-purple-200 font-medium hover:bg-purple-100 transition-colors">{email}</div>
                              ))}
                            </div>
                          </details>

                          {connection.outreachTips && (
                            <div className="mb-6 p-4 bg-gradient-to-r from-pink-100 to-rose-100 rounded-2xl border-2 border-pink-300 shadow-lg">
                              <div className="flex items-start">
                                <div className="w-8 h-8 bg-gradient-to-r from-pink-500 to-rose-500 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                                  <Heart className="w-4 h-4 text-white" />
                                </div>
                                <div>
                                  <p className="text-pink-700 font-black text-sm mb-2 flex items-center gap-1">
                                    ✨ Priority Outreach Tip
                                  </p>
                                  <p className="text-gray-700 text-sm leading-relaxed font-medium">{connection.outreachTips}</p>
                                </div>
                              </div>
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-4">
                            <a
                              href={connection.linkedinUrl || `https://linkedin.com/in/${connection.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="group bg-gradient-to-r from-blue-100 to-sky-100 hover:from-blue-200 hover:to-sky-200 border-2 border-blue-300 hover:border-blue-400 text-blue-700 hover:text-blue-800 font-black text-sm py-4 px-4 rounded-2xl transition-all duration-300 flex items-center justify-center shadow-lg hover:shadow-xl transform hover:scale-105"
                            >
                              <ExternalLink className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
                              LinkedIn
                            </a>
                            <a
                              href={`mailto:${connection.primaryEmail}?subject=Connection from ${formData.yourName}&body=Hi ${connection.name.split(' ')[0]}, I'm applying to ${formData.targetCompany} and noticed we share a connection through ${connection.priorityReason.includes('Alumni') ? formData.school : formData.previousCompany}. Would love to connect!`}
                              className="group bg-gradient-to-r from-green-100 to-emerald-100 hover:from-green-200 hover:to-emerald-200 border-2 border-green-300 hover:border-green-400 text-green-700 hover:text-green-800 font-black text-sm py-4 px-4 rounded-2xl transition-all duration-300 flex items-center justify-center shadow-lg hover:shadow-xl transform hover:scale-105"
                            >
                              <Mail className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
                              Email
                            </a>
                          </div>
>>>>>>> Stashed changes
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Regular Connections */}
            {connections.filter(c => !c.isPriorityConnection).length > 0 && (
<<<<<<< Updated upstream
              <div>
                <div className="text-center mb-6">
                  <h3 className="text-lg font-semibold text-gray-300">
                    Other Connections ({connections.filter(c => !c.isPriorityConnection).length})
                  </h3>
                  <p className="text-gray-500">Additional LinkedIn connections at {formData.targetCompany}</p>
=======
              <div className="mb-20">
                <div className="text-center mb-10">
                  <h3 className="text-3xl font-black bg-gradient-to-r from-gray-600 to-gray-800 bg-clip-text text-transparent mb-4">
                    👥 Additional Connections ({connections.filter(c => !c.isPriorityConnection).length})
                  </h3>
                  <p className="text-gray-600 font-bold text-lg">More amazing professionals at {formData.targetCompany} 🌟</p>
>>>>>>> Stashed changes
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {connections.filter(connection => !connection.isPriorityConnection).map((connection, index) => (
<<<<<<< Updated upstream
                    <div key={`regular-${index}`} className="bg-gray-800 rounded-lg shadow-sm border border-gray-700 p-6 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-lg font-semibold text-white">{connection.name}</h3>
                          <p className="text-sm text-gray-300">{connection.title}</p>
                          <p className="text-sm text-gray-400">{connection.department}</p>
=======
                    <div key={`regular-${index}`} className="group relative transform hover:scale-102 transition-all duration-300">
                      <div className="absolute inset-0 bg-gradient-to-r from-gray-200/40 to-slate-200/40 rounded-3xl blur-lg group-hover:blur-xl transition-all duration-300"></div>
                      <div className="relative bg-white/90 backdrop-blur-xl rounded-3xl border-2 border-gray-300 shadow-lg p-6 hover:border-gray-400 hover:shadow-xl transition-all duration-300">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <h3 className="text-xl font-black text-gray-800 mb-2">{connection.name}</h3>
                            <p className="text-gray-700 font-bold mb-1">{connection.title}</p>
                            <p className="text-gray-600 text-sm mb-2 font-medium">{connection.department}</p>
                            <p className="text-gray-500 text-xs font-medium">Source: {connection.source}</p>
                          </div>
                          <span className={`px-3 py-2 rounded-2xl text-xs ${getConnectionTypeColor(connection.connectionType)}`}>
                            {connection.connectionType}
                          </span>
>>>>>>> Stashed changes
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getConnectionTypeColor(connection.connectionType)}`}>
                          {connection.connectionType}
                        </span>
                      </div>

<<<<<<< Updated upstream
                      <div className="space-y-2 mb-4">
                        <div className="flex items-center text-sm text-gray-400">
                          {connection.seniority} • {connection.responseRate}/10 response rate
                        </div>
                      </div>

                      <div className="border-t border-gray-700 pt-4">
                        <div className="mb-3">
                          <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Best Email Pattern</label>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-sm font-mono text-gray-200">{connection.primaryEmail}</span>
                            <span className={`text-xs font-medium ${connection.emailConfidence > 70 ? 'text-green-400' : 'text-yellow-400'}`}>
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
=======
                        <div className="space-y-3 mb-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center text-gray-700 bg-gray-50 rounded-xl px-3 py-2 border border-gray-200">
                              <Building className="w-4 h-4 mr-2 text-gray-600" />
                              <span className="font-bold">{connection.seniority}</span>
                            </div>
                            <div className="flex items-center bg-gradient-to-r from-gray-100 to-slate-100 rounded-2xl px-3 py-2 border-2 border-gray-300">
                              <div className="w-2 h-2 bg-gray-500 rounded-full mr-2"></div>
                              <span className="text-gray-700 font-bold text-sm">{connection.responseRate}/10 response</span>
                            </div>
                          </div>
                        </div>

                        <div className="border-t-2 border-gray-200 pt-4">
                          <div className="mb-3">
                            <label className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2 block flex items-center gap-2">
                              <Mail className="w-3 h-3" />
                              Best Email Pattern
                            </label>
                            <div className="bg-gray-50/80 rounded-2xl p-3 border-2 border-gray-200 shadow-inner">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-mono text-gray-800 font-medium">{connection.primaryEmail}</span>
                                <span className={`text-xs font-bold px-2 py-1 rounded-full border-2 ${connection.emailConfidence > 70 ? 'bg-green-100 text-green-700 border-green-300' : 'bg-amber-100 text-amber-700 border-amber-300'}`}>
                                  {connection.emailConfidence}%
                                </span>
                              </div>
                            </div>
                          </div>

                          <details className="mb-3">
                            <summary className="text-xs font-bold text-gray-700 uppercase tracking-wider cursor-pointer hover:text-gray-800 transition-colors flex items-center gap-2">
                              <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
                              Alternative Patterns ({(connection.allEmailPatterns || []).length - 1})
                            </summary>
                            <div className="mt-2 space-y-2">
                              {(connection.allEmailPatterns || []).slice(1).map((email, i) => (
                                <div key={i} className="bg-gray-50/80 rounded-xl p-2 text-sm font-mono text-gray-800 border-2 border-gray-200 font-medium hover:bg-gray-100 transition-colors">{email}</div>
                              ))}
                            </div>
                          </details>

                          {connection.outreachTips && (
                            <div className="mb-3 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border-2 border-blue-200">
                              <p className="text-blue-700 font-bold text-xs mb-1 flex items-center gap-1">
                                💡 Outreach Tip
                              </p>
                              <p className="text-gray-700 text-xs leading-relaxed font-medium">{connection.outreachTips}</p>
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-3">
                            <a
                              href={connection.linkedinUrl || `https://linkedin.com/in/${connection.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="group bg-gradient-to-r from-blue-100 to-sky-100 hover:from-blue-200 hover:to-sky-200 border-2 border-blue-300 hover:border-blue-400 text-blue-700 hover:text-blue-800 font-bold text-sm py-3 px-3 rounded-2xl transition-all duration-300 flex items-center justify-center shadow-md hover:shadow-lg transform hover:scale-105"
                            >
                              <ExternalLink className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
                              LinkedIn
                            </a>
                            <a
                              href={`mailto:${connection.primaryEmail}?subject=Connection from ${formData.yourName}&body=Hi ${connection.name.split(' ')[0]}, I'm applying to ${formData.targetCompany} and noticed we share connections through ${connection.connectionType === 'Alumni' ? formData.school : formData.previousCompany}. Would love to connect!`}
                              className="group bg-gradient-to-r from-gray-100 to-slate-100 hover:from-gray-200 hover:to-slate-200 border-2 border-gray-300 hover:border-gray-400 text-gray-700 hover:text-gray-800 font-bold text-sm py-3 px-3 rounded-2xl transition-all duration-300 flex items-center justify-center shadow-md hover:shadow-lg transform hover:scale-105"
                            >
                              <Mail className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
                              Email
                            </a>
                          </div>
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
          <div className="text-center py-12">
            <div className="bg-gray-900 rounded-xl shadow-sm border border-gray-800 p-8">
              <AlertCircle className="w-12 h-12 text-gray-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">No Connections Found</h3>
              <p className="text-gray-400">Try a larger company or check your API configuration.</p>
=======
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-red-200/40 to-orange-200/40 blur-2xl rounded-full"></div>
            <div className="relative text-center py-20 px-8 bg-white/90 rounded-3xl border-2 border-red-200 shadow-2xl">
              <div className="relative mb-8">
                <div className="absolute inset-0 bg-gradient-to-r from-red-200/50 to-orange-200/50 blur-xl rounded-full"></div>
                <div className="relative w-24 h-24 bg-gradient-to-br from-red-500 to-orange-500 rounded-full flex items-center justify-center mx-auto">
                  <AlertCircle className="w-12 h-12 text-white" />
                </div>
              </div>
              <h3 className="text-3xl font-black bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent mb-6">😔 No Connections Found</h3>
              <p className="text-gray-700 text-lg mb-8 max-w-md mx-auto font-medium leading-relaxed">We couldn't find any connections for this search. Try adjusting your criteria or check the discovery log for details.</p>
              <div className="flex flex-wrap justify-center gap-4">
                <div className="bg-gradient-to-r from-red-100 to-rose-100 backdrop-blur-sm rounded-2xl px-6 py-3 border-2 border-red-300 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                  <span className="text-red-700 font-bold flex items-center gap-2">
                    <Search className="w-4 h-4" />
                    Refine Search
                  </span>
                </div>
                <div className="bg-gradient-to-r from-orange-100 to-amber-100 backdrop-blur-sm rounded-2xl px-6 py-3 border-2 border-orange-300 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                  <span className="text-orange-700 font-bold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Check Logs
                  </span>
                </div>
              </div>
>>>>>>> Stashed changes
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConnectionFinder;