// Image Search Service - Fetches footballer images with quota management

const IMAGE_SEARCH_QUOTA_KEY = 'footballer_search_quota';
const DAILY_LIMIT = 100;

// Get or initialize quota
const getSearchQuota = () => {
    const stored = localStorage.getItem(IMAGE_SEARCH_QUOTA_KEY);
    if (!stored) {
        return { date: new Date().toISOString().split('T')[0], count: 0, limit: DAILY_LIMIT };
    }
    const quota = JSON.parse(stored);
    const today = new Date().toISOString().split('T')[0];

    // Reset if new day
    if (quota.date !== today) {
        return { date: today, count: 0, limit: DAILY_LIMIT };
    }
    return quota;
};

// Increment search count
const incrementSearchCount = () => {
    const quota = getSearchQuota();
    quota.count += 1;
    localStorage.setItem(IMAGE_SEARCH_QUOTA_KEY, JSON.stringify(quota));
    return quota;
};

// Check if quota available
const hasQuotaRemaining = () => {
    const quota = getSearchQuota();
    return quota.count < quota.limit;
};

// Primary: Google Custom Search API
const searchGoogleImages = async (playerName) => {
    if (!hasQuotaRemaining()) {
        console.warn('Google Search quota exceeded, switching to Wikimedia');
        return null;
    }

    // Note: In production, you'd use your own API key
    // For now, returning null to trigger fallback
    // Uncomment and add your key to use:
    /*
    const API_KEY = 'YOUR_GOOGLE_API_KEY';
    const SEARCH_ENGINE_ID = 'YOUR_SEARCH_ENGINE_ID';
    
    try {
        const query = `${playerName} football portrait professional`;
        const url = `https://www.googleapis.com/customsearch/v1?key=${API_KEY}&cx=${SEARCH_ENGINE_ID}&q=${encodeURIComponent(query)}&searchType=image&num=1`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.items && data.items.length > 0) {
            incrementSearchCount();
            return data.items[0].link;
        }
    } catch (err) {
        console.error('Google Search error:', err);
    }
    */

    return null;
};

// Fallback: Wikimedia Commons (unlimited, free)
const searchWikimedia = async (playerName) => {
    try {
        // Step 1: Search for the player's Wikipedia page
        const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(playerName + ' footballer')}&format=json&origin=*`;
        const searchResponse = await fetch(searchUrl);
        const searchData = await searchResponse.json();

        if (!searchData.query || !searchData.query.search || searchData.query.search.length === 0) {
            console.warn('No Wikipedia page found for', playerName);
            return null;
        }

        const pageTitle = searchData.query.search[0].title;

        // Step 2: Get the page's main image
        const imageUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(pageTitle)}&prop=pageimages&format=json&pithumbsize=500&origin=*`;
        const imageResponse = await fetch(imageUrl);
        const imageData = await imageResponse.json();

        const pages = imageData.query.pages;
        const pageId = Object.keys(pages)[0];

        if (pages[pageId].thumbnail) {
            console.log('Found Wikimedia image for', playerName);
            return pages[pageId].thumbnail.source;
        }

        console.warn('No image found on Wikipedia page for', playerName);
        return null;
    } catch (err) {
        console.error('Wikimedia search error:', err);
        return null;
    }
};

// Main search function with fallback chain
export const fetchFootballerImage = async (playerName) => {
    console.log('Searching for footballer image:', playerName);

    // Try Google first (if quota available)
    let imageUrl = await searchGoogleImages(playerName);

    // Fallback to Wikimedia
    if (!imageUrl) {
        imageUrl = await searchWikimedia(playerName);
    }

    if (!imageUrl) {
        console.warn('Could not find image for', playerName, '- user will need to use manual search');
    }

    return imageUrl;
};

export { getSearchQuota, hasQuotaRemaining };
