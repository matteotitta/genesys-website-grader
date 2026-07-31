import { WebsiteContent } from '@/types/analysis';
import { validateUrlWithDns } from './url-validator';

const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
const FIRECRAWL_API_URL = 'https://api.firecrawl.dev/v1/scrape';

// Tags to exclude from scraping - removes nav, popups, and social embeds
const EXCLUDE_TAGS = [
  'nav',
  'cookie-banner',
  'popup',
  'modal',
  // Social embed containers that often duplicate content
  '.linkedin-embed',
  '.twitter-embed',
  '.social-embed',
  '[data-linkedin]',
  'iframe[src*="linkedin"]',
  'iframe[src*="twitter"]',
  '.embed-container',
  '.social-feed',
  '.feed-item',
];

/**
 * Remove duplicate paragraphs from markdown content
 * This helps clean up content from sites with repeated social posts or widgets
 */
function deduplicateContent(markdown: string): string {
  const paragraphs = markdown.split('\n\n');
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const paragraph of paragraphs) {
    // Normalize paragraph for comparison (trim, lowercase first 100 chars)
    const normalized = paragraph.trim().toLowerCase().slice(0, 200);

    // Skip empty paragraphs
    if (!normalized) continue;

    // Skip if we've seen this paragraph before (allowing for some variation)
    if (seen.has(normalized)) continue;

    seen.add(normalized);
    unique.push(paragraph);
  }

  return unique.join('\n\n');
}

export class FirecrawlError extends Error {
  constructor(
    message: string,
    public url: string,
    public code: 'API_ERROR' | 'RATE_LIMIT' | 'TIMEOUT' | 'NOT_FOUND' | 'SSRF_BLOCKED'
  ) {
    super(message);
    this.name = 'FirecrawlError';
  }
}

interface FirecrawlResponse {
  success: boolean;
  data?: {
    markdown?: string;
    metadata?: {
      title?: string;
      description?: string;
      ogImage?: string;
      favicon?: string;
    };
    links?: string[];
  };
  error?: string;
}

async function scrapeWithFirecrawl(url: string): Promise<WebsiteContent> {
  // SSRF protection: validate URL before sending to Firecrawl API
  const validation = await validateUrlWithDns(url);
  if (!validation.valid) {
    throw new FirecrawlError(validation.reason, url, 'SSRF_BLOCKED');
  }

  if (!FIRECRAWL_API_KEY) {
    throw new FirecrawlError('Firecrawl API key not configured', url, 'API_ERROR');
  }

  const response = await fetch(FIRECRAWL_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
    },
    body: JSON.stringify({
      url,
      formats: ['markdown'],
      onlyMainContent: false,
      waitFor: 3000,
      excludeTags: EXCLUDE_TAGS,
    }),
  });

  if (!response.ok) {
    if (response.status === 429) {
      throw new FirecrawlError('Rate limit exceeded', url, 'RATE_LIMIT');
    }
    if (response.status === 404) {
      throw new FirecrawlError('Page not found', url, 'NOT_FOUND');
    }
    throw new FirecrawlError(`Firecrawl API error: ${response.status}`, url, 'API_ERROR');
  }

  const result: FirecrawlResponse = await response.json();

  if (!result.success || !result.data) {
    throw new FirecrawlError(result.error || 'Failed to scrape page', url, 'API_ERROR');
  }

  // Deduplicate content to remove repeated social posts/widgets
  const markdown = deduplicateContent(result.data.markdown || '');
  const truncatedContent = markdown.length > 100000
    ? markdown.slice(0, 100000) + '\n\n[Content truncated...]'
    : markdown;

  return {
    url,
    title: result.data.metadata?.title || 'Unknown Title',
    description: result.data.metadata?.description || '',
    content: truncatedContent,
    metadata: {
      ogImage: result.data.metadata?.ogImage,
      favicon: result.data.metadata?.favicon,
    },
    fetchedAt: new Date().toISOString(),
  };
}

function findPricingUrl(baseUrl: string, links: string[]): string | null {
  const pricingPatterns = [
    /\/pricing\/?$/i,
    /\/plans\/?$/i,
    /\/price\/?$/i,
    /\/packages\/?$/i,
  ];

  const base = new URL(baseUrl);

  for (const link of links) {
    try {
      const linkUrl = new URL(link, baseUrl);
      // Only consider links on the same domain
      if (linkUrl.hostname !== base.hostname) continue;

      for (const pattern of pricingPatterns) {
        if (pattern.test(linkUrl.pathname)) {
          return linkUrl.toString();
        }
      }
    } catch {
      continue;
    }
  }

  // Try common pricing URLs directly
  const commonPaths = ['/pricing', '/plans', '/price'];
  for (const path of commonPaths) {
    return new URL(path, baseUrl).toString();
  }

  return null;
}

export interface MultiPageContent {
  homepage: WebsiteContent;
  pricingPage: WebsiteContent | null;
  pricingUrl: string | null;
}

export async function fetchWithFirecrawl(mainUrl: string): Promise<MultiPageContent> {
  // SSRF protection: validate URL before any Firecrawl API calls
  const validation = await validateUrlWithDns(mainUrl);
  if (!validation.valid) {
    throw new FirecrawlError(validation.reason, mainUrl, 'SSRF_BLOCKED');
  }

  // Step 1: Fetch homepage
  const homepageResponse = await fetch(FIRECRAWL_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
    },
    body: JSON.stringify({
      url: mainUrl,
      formats: ['markdown', 'links'],
      onlyMainContent: false,
      waitFor: 3000,
      excludeTags: EXCLUDE_TAGS,
    }),
  });

  if (!homepageResponse.ok) {
    if (homepageResponse.status === 429) {
      throw new FirecrawlError('Rate limit exceeded', mainUrl, 'RATE_LIMIT');
    }
    throw new FirecrawlError(`Firecrawl API error: ${homepageResponse.status}`, mainUrl, 'API_ERROR');
  }

  const homepageResult: FirecrawlResponse = await homepageResponse.json();

  if (!homepageResult.success || !homepageResult.data) {
    throw new FirecrawlError(homepageResult.error || 'Failed to scrape homepage', mainUrl, 'API_ERROR');
  }

  // Deduplicate content to remove repeated social posts/widgets
  const homepageMarkdown = deduplicateContent(homepageResult.data.markdown || '');
  const homepage: WebsiteContent = {
    url: mainUrl,
    title: homepageResult.data.metadata?.title || 'Unknown Title',
    description: homepageResult.data.metadata?.description || '',
    content: homepageMarkdown.length > 100000
      ? homepageMarkdown.slice(0, 100000) + '\n\n[Content truncated...]'
      : homepageMarkdown,
    metadata: {
      ogImage: homepageResult.data.metadata?.ogImage,
      favicon: homepageResult.data.metadata?.favicon,
    },
    fetchedAt: new Date().toISOString(),
  };

  // Step 2: Find and fetch pricing page
  let pricingPage: WebsiteContent | null = null;
  let pricingUrl: string | null = null;

  const links = homepageResult.data.links || [];
  pricingUrl = findPricingUrl(mainUrl, links);

  if (pricingUrl) {
    // Validate pricing URL before fetching (it comes from scraped page links)
    const pricingValidation = await validateUrlWithDns(pricingUrl);
    if (pricingValidation.valid) {
      try {
        pricingPage = await scrapeWithFirecrawl(pricingUrl);
        console.log(`[Firecrawl] Successfully fetched pricing page: ${pricingUrl}`);
      } catch (error) {
        console.log(`[Firecrawl] Failed to fetch pricing page: ${error instanceof Error ? error.message : 'Unknown error'}`);
        pricingPage = null;
      }
    } else {
      console.log(`[Firecrawl] Skipping pricing URL (blocked): ${pricingUrl}`);
    }
  }

  return {
    homepage,
    pricingPage,
    pricingUrl,
  };
}

export function isFirecrawlConfigured(): boolean {
  return !!FIRECRAWL_API_KEY;
}
