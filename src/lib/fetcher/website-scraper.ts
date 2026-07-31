import * as cheerio from 'cheerio';
import TurndownService from 'turndown';
import { tables } from 'turndown-plugin-gfm';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { WebsiteContent } from '@/types/analysis';
import { validateUrlWithDns } from './url-validator';

// Debug mode - only save scraped content in development
const DEBUG_SAVE_CONTENT = process.env.NODE_ENV === 'development';
const DEBUG_OUTPUT_DIR = '/tmp/website-grader-debug';

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
});

// Add GFM tables support for better comparison table extraction
turndown.use(tables);

// Remove script, style, and navigation elements - but keep footer, aside, and iframes for content
turndown.remove(['script', 'style', 'nav', 'noscript']);

// Keep iframes but convert them to descriptive text (for videos, embeds)
turndown.addRule('iframe', {
  filter: 'iframe',
  replacement: function (content, node) {
    const src = (node as HTMLIFrameElement).getAttribute('src') || '';
    const title = (node as HTMLIFrameElement).getAttribute('title') || 'Embedded content';
    if (src.includes('youtube') || src.includes('vimeo') || src.includes('wistia') || src.includes('loom')) {
      return `\n\n[VIDEO: ${title}](${src})\n\n`;
    }
    return `\n\n[EMBED: ${title}](${src})\n\n`;
  }
});

// Preserve image alt text and src for logo/testimonial detection
turndown.addRule('images', {
  filter: 'img',
  replacement: function (content, node) {
    const alt = (node as HTMLImageElement).getAttribute('alt') || '';
    const src = (node as HTMLImageElement).getAttribute('src') || '';
    // Include both alt text and a note about the image for context
    if (alt) {
      return `![${alt}](${src})`;
    }
    return `![Image](${src})`;
  }
});

export class WebsiteScraperError extends Error {
  constructor(
    message: string,
    public url: string,
    public code: 'TIMEOUT' | 'BLOCKED' | 'NOT_FOUND' | 'INVALID_URL' | 'NETWORK_ERROR' | 'SSRF_BLOCKED'
  ) {
    super(message);
    this.name = 'WebsiteScraperError';
  }
}

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
};

const MAX_REDIRECTS = 5;

export async function fetchWebsite(url: string): Promise<WebsiteContent> {
  // SSRF protection: validate URL + DNS resolution against private IP ranges
  const validation = await validateUrlWithDns(url);
  if (!validation.valid) {
    throw new WebsiteScraperError(validation.reason, url, 'SSRF_BLOCKED');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    // Follow redirects manually to validate each destination against SSRF
    let currentUrl = url;
    let response: Response | undefined;

    for (let i = 0; i <= MAX_REDIRECTS; i++) {
      response = await fetch(currentUrl, {
        signal: controller.signal,
        redirect: 'manual',
        headers: FETCH_HEADERS,
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) break;

        const redirectUrl = new URL(location, currentUrl).toString();
        const redirectValidation = await validateUrlWithDns(redirectUrl);
        if (!redirectValidation.valid) {
          throw new WebsiteScraperError('Redirect to blocked URL', url, 'SSRF_BLOCKED');
        }
        currentUrl = redirectUrl;
        continue;
      }
      break;
    }

    if (!response) {
      throw new WebsiteScraperError('No response received', url, 'NETWORK_ERROR');
    }

    if (!response.ok) {
      if (response.status === 403 || response.status === 401) {
        throw new WebsiteScraperError('Website blocked access', url, 'BLOCKED');
      }
      if (response.status === 404) {
        throw new WebsiteScraperError('Website not found', url, 'NOT_FOUND');
      }
      throw new WebsiteScraperError(`HTTP ${response.status}`, url, 'NETWORK_ERROR');
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Extract metadata
    const title = $('title').text().trim() ||
                  $('meta[property="og:title"]').attr('content') ||
                  $('h1').first().text().trim() ||
                  'Unknown Title';

    const description = $('meta[name="description"]').attr('content') ||
                        $('meta[property="og:description"]').attr('content') ||
                        '';

    const ogImage = $('meta[property="og:image"]').attr('content') || '';
    const favicon = $('link[rel="icon"]').attr('href') ||
                    $('link[rel="shortcut icon"]').attr('href') ||
                    '/favicon.ico';

    // Remove only navigation and popup elements - keep footer, header, aside for testimonials/pricing/CTAs
    $('script, style, nav, .cookie-banner, .popup, .modal, [role="navigation"]').remove();

    // Extract full body content to capture all sections (pricing, testimonials, comparisons, etc.)
    const mainContent = $('body').html() || '';

    // Convert to markdown
    const markdown = turndown.turndown(mainContent);

    // Truncate if too long (Claude has context limits) - increased to 100KB for full page content
    const truncatedContent = markdown.length > 100000
      ? markdown.slice(0, 100000) + '\n\n[Content truncated...]'
      : markdown;

    // Debug: Save scraped content to file for review
    if (DEBUG_SAVE_CONTENT) {
      try {
        await mkdir(DEBUG_OUTPUT_DIR, { recursive: true });
        const hostname = new URL(url).hostname.replace('www.', '');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `${hostname}-${timestamp}.md`;
        const debugContent = `# Scraped Content for ${url}

**Title:** ${title}
**Description:** ${description}
**Fetched At:** ${new Date().toISOString()}
**Original Length:** ${markdown.length} characters
**Truncated:** ${markdown.length > 50000 ? 'Yes' : 'No'}

---

${truncatedContent}
`;
        await writeFile(join(DEBUG_OUTPUT_DIR, filename), debugContent);
        console.log(`[DEBUG] Saved scraped content to: ${join(DEBUG_OUTPUT_DIR, filename)}`);
      } catch (debugError) {
        console.error('[DEBUG] Failed to save debug content:', debugError);
      }
    }

    return {
      url,
      title,
      description,
      content: truncatedContent,
      metadata: {
        ogImage: ogImage ? new URL(ogImage, url).toString() : undefined,
        favicon: favicon ? new URL(favicon, url).toString() : undefined,
      },
      fetchedAt: new Date().toISOString(),
    };
  } catch (error) {
    if (error instanceof WebsiteScraperError) throw error;

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new WebsiteScraperError('Request timed out', url, 'TIMEOUT');
      }
    }

    throw new WebsiteScraperError('Failed to fetch website', url, 'NETWORK_ERROR');
  } finally {
    clearTimeout(timeout);
  }
}

// Fetch multiple websites in parallel with error handling
export async function fetchMultipleWebsites(urls: string[]): Promise<{
  successful: WebsiteContent[];
  failed: { url: string; error: string }[];
}> {
  const results = await Promise.allSettled(urls.map(fetchWebsite));

  const successful: WebsiteContent[] = [];
  const failed: { url: string; error: string }[] = [];

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      successful.push(result.value);
    } else {
      failed.push({
        url: urls[index],
        error: result.reason instanceof Error ? result.reason.message : 'Unknown error',
      });
    }
  });

  return { successful, failed };
}
