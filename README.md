
=======
# Connection Finder

A React application that helps you find potential connections at target companies through AI-powered profile generation and email verification.

## Features

- **Google-Powered LinkedIn Search**: Uses Google Custom Search API to find real LinkedIn profiles
- **Smart Email Pattern Analysis**: Uses intelligent pattern matching to identify most likely email formats
- **Smart Email Pattern Generation**: Creates multiple email format possibilities
- **AI Connection Analysis**: Uses OpenAI to categorize connections and provide outreach tips
- **Real-time Logging**: Shows the discovery process in real-time
- **Modern UI**: Built with React and Tailwind CSS

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. **Configure API Keys** (create a .env file):
   ```bash
   cp .env.example .env
   ```
   
   Then edit `.env` and add your API keys:
   ```
   REACT_APP_OPENAI_API_KEY=sk-your_openai_api_key_here
   REACT_APP_GOOGLE_SEARCH_API_KEY=AIza_your_google_custom_search_api_key_here
   REACT_APP_GOOGLE_CSE_ID=your_custom_search_engine_id_here
   ```

3. Start the development server:
   ```bash
   npm start
   ```

## API Requirements & Setup

### 🔑 Required API Keys:

#### 1. **OpenAI API** ($20+ per month)
- Get from: https://platform.openai.com/api-keys
- Used for: AI-powered connection analysis and profile categorization
- Cost: ~$0.002 per profile analyzed

#### 2. **Google Custom Search API** (FREE!)
- Get from: https://developers.google.com/custom-search/v1/introduction
- Used for: Finding LinkedIn profiles through Google search
- Cost: **FREE** - 100 searches per day
- Setup steps:
  1. Go to Google Cloud Console
  2. Enable Custom Search API
  3. Create credentials (API key)
  4. Create a Custom Search Engine at: https://cse.google.com/cse/

## Usage

1. Set up your `.env` file with the required API keys
2. Fill in your target company, previous company, school, and name
3. Click "Start Real-Time Discovery" to begin finding connections
4. View the real LinkedIn profiles with verified emails and outreach tips

## What This Tool Does

✅ **Real LinkedIn Discovery**: Uses Google search to find actual LinkedIn profiles
✅ **No Expensive Proxies**: Bypasses expensive scraping services  
✅ **Smart Email Pattern Analysis**: Uses intelligent algorithms to find most likely email formats
✅ **AI-Powered Analysis**: Categorizes connections and provides outreach tips
✅ **Cost Effective**: Much cheaper than traditional scraping methods

## Security

- **API keys are stored locally** in your `.env` file
- **Never commit your `.env` file** to version control
- **Keys are loaded as environment variables** at build time

## Note

This tool finds real LinkedIn profiles and verifies emails for legitimate networking purposes. Please respect rate limits and terms of service for all APIs used. 
>>>>>>> master
