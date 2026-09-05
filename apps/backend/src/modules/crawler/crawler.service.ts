import axios, { AxiosInstance } from 'axios';
import * as cheerio from 'cheerio';
import * as googlethis from 'googlethis';
import robotsParser from 'robots-parser';

export interface CrawlResult {
  companyContext: string;
  hiringContext: string;
  publicDiscussion: string;
  pagesUsed: string[];
}

interface RankedLink {
  url: string;
  score: number;
}

const MAX_CONTENT_LENGTH = 5000000; // 5MB
const REQUEST_TIMEOUT_MS = 10000; // 10 seconds
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 (ZenoBot Interview Prep Analyzer)';

/**
 * Validates URLs against SSRF (Server-Side Request Forgery) attacks
 * Blocks private IP ranges, localhost, and internal network hostnames.
 */
export const validateUrl = (urlStr: string): boolean => {
  try {
    const parsed = new URL(urlStr.trim());

    // Protocol check: Only allow http and https
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }

    const hostname = parsed.hostname.toLowerCase();

    // Block localhost, loopback, and broadcast
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname === '::1' ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal') ||
      hostname.endsWith('.lan')
    ) {
      return false;
    }

    // Block IPv4 private address ranges (RFC 1918 & RFC 3927 link-local)
    // 10.0.0.0 - 10.255.255.255
    if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
      return false;
    }
    // 172.16.0.0 - 172.31.255.255
    if (/^172\.(1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
      return false;
    }
    // 192.168.0.0 - 192.168.255.255
    if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
      return false;
    }
    // 169.254.0.0 - 169.254.255.255 (AWS/Cloud metadata)
    if (/^169\.254\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
      return false;
    }
    // 127.0.0.0/8
    if (/^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
};

/**
 * Creates configured Axios instance with strict security bounds
 */
const createHttpClient = (): AxiosInstance => {
  return axios.create({
    timeout: REQUEST_TIMEOUT_MS,
    maxContentLength: MAX_CONTENT_LENGTH,
    maxBodyLength: MAX_CONTENT_LENGTH,
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    validateStatus: (status) => status >= 200 && status < 400,
  });
};

/**
 * Extracts clean, high-signal text content from raw HTML
 */
export const extractCleanText = (html: string): string => {
  const $ = cheerio.load(html);

  // Strip non-content and noisy elements
  $('script, style, noscript, svg, iframe, nav, footer, header').remove();

  // Target primary content containers if present, otherwise fallback to body
  let targetElement = $('main');
  if (targetElement.length === 0 || targetElement.text().trim().length < 50) {
    targetElement = $('article');
  }
  if (targetElement.length === 0 || targetElement.text().trim().length < 50) {
    targetElement = $('body');
  }

  const rawText = targetElement.text() || '';
  // Collapse whitespace and normalize newlines
  return rawText
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, '\n')
    .trim();
};

/**
 * Heuristic scoring for ranking same-domain links
 */
export const rankLinks = (html: string, baseUrlStr: string): string[] => {
  try {
    const $ = cheerio.load(html);
    const baseUrl = new URL(baseUrlStr);
    const rankedLinks: RankedLink[] = [];
    const seenUrls = new Set<string>();

    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;

      try {
        const resolvedUrl = new URL(href, baseUrlStr);

        // Keep to same domain only
        if (resolvedUrl.hostname !== baseUrl.hostname) {
          return;
        }

        // Avoid self-references and anchor links
        if (resolvedUrl.href === baseUrl.href || resolvedUrl.pathname === baseUrl.pathname) {
          return;
        }

        // SSRF check on resolved URL
        if (!validateUrl(resolvedUrl.href)) {
          return;
        }

        const normalizedHref = resolvedUrl.href.toLowerCase();
        if (seenUrls.has(normalizedHref)) {
          return;
        }
        seenUrls.add(normalizedHref);

        let score = 0;
        // Career / job keywords = +10 points
        if (normalizedHref.includes('career') || normalizedHref.includes('job')) {
          score += 10;
        }
        // Hiring / join keywords = +8 points
        if (normalizedHref.includes('hiring') || normalizedHref.includes('join')) {
          score += 8;
        }
        // About / team keywords = +5 points
        if (normalizedHref.includes('about') || normalizedHref.includes('team') || normalizedHref.includes('culture')) {
          score += 5;
        }

        if (score > 0) {
          rankedLinks.push({ url: resolvedUrl.href, score });
        }
      } catch {
        // Skip invalid link
      }
    });

    // Sort descending by score
    rankedLinks.sort((a, b) => b.score - a.score);
    return rankedLinks.map((item) => item.url);
  } catch (err) {
    console.warn('⚠️ Error ranking links:', err);
    return [];
  }
};

/**
 * Searches public online discussions (Reddit, Glassdoor) via googlethis
 */
export const searchPublicDiscussion = async (companyName: string): Promise<string> => {
  if (!companyName || companyName.trim().length === 0) {
    return '';
  }

  const query = `"${companyName}" interview process OR interview questions site:reddit.com OR site:glassdoor.com`;

  try {
    let googleSearch: any = googlethis;
    if (googleSearch.default) {
      googleSearch = googleSearch.default;
    }

    if (typeof googleSearch.search !== 'function') {
      console.warn('⚠️ googlethis.search is not available in current environment');
      return '';
    }

    const searchResults = await googleSearch.search(query, {
      page: 0,
      safe: false,
      additional_params: {
        hl: 'en',
      },
    });

    const snippets: string[] = [];
    if (searchResults && Array.isArray(searchResults.results)) {
      for (const res of searchResults.results.slice(0, 5)) {
        const title = res.title || '';
        const description = res.description || res.snippet || '';
        if (title || description) {
          snippets.push(`[${title}]: ${description}`);
        }
      }
    }

    return snippets.join('\n\n');
  } catch (error: any) {
    console.warn(`⚠️ Public discussion search failed for "${companyName}":`, error.message);
    return '';
  }
};

/**
 * Main Crawler Entrypoint: Crawls company URL, discovers career/team subpages,
 * and retrieves public community discussions.
 */
export const crawlCompanyData = async (
  companyUrl: string,
  companyName: string
): Promise<CrawlResult> => {
  const pagesUsed: string[] = [];
  let companyContext = '';
  let hiringContext = '';
  let publicDiscussion = '';

  const httpClient = createHttpClient();
  let normalizedUrl = companyUrl?.trim() || '';

  if (normalizedUrl && !normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
    normalizedUrl = `https://${normalizedUrl}`;
  }

  // Step 1 & 2: Fetch primary company URL & extract companyContext
  if (normalizedUrl && validateUrl(normalizedUrl)) {
    try {
      console.log(`🕷️ [Crawler] Crawling primary company URL: ${normalizedUrl}`);
      const response = await httpClient.get(normalizedUrl);

      if (response.data && typeof response.data === 'string') {
        pagesUsed.push(normalizedUrl);
        companyContext = extractCleanText(response.data);

        // Step 3 & 4: Link Ranking and subpage crawling for hiringContext
        const rankedLinks = rankLinks(response.data, normalizedUrl);

        if (rankedLinks.length > 0) {
          const topHiringUrl = rankedLinks[0];
          console.log(`🎯 [Crawler] Found high-scoring hiring/about subpage: ${topHiringUrl}`);

          try {
            const subpageResponse = await httpClient.get(topHiringUrl);
            if (subpageResponse.data && typeof subpageResponse.data === 'string') {
              pagesUsed.push(topHiringUrl);
              hiringContext = extractCleanText(subpageResponse.data);
            }
          } catch (subErr: any) {
            console.warn(`⚠️ [Crawler] Failed to fetch subpage ${topHiringUrl}:`, subErr.message);
          }
        }
      }
    } catch (error: any) {
      console.warn(`⚠️ [Crawler] Failed to crawl ${normalizedUrl}:`, error.message);
    }
  } else if (normalizedUrl) {
    console.warn(`🛡️ [Crawler] Blocked invalid or unsafe URL (SSRF Guard): ${normalizedUrl}`);
  }

  // Step 5: Search public discussions on Reddit & Glassdoor
  const inferredCompanyName =
    companyName?.trim() ||
    (normalizedUrl ? new URL(normalizedUrl).hostname.replace('www.', '').split('.')[0] : '');

  if (inferredCompanyName) {
    console.log(`🔎 [Crawler] Searching public interview discussions for: ${inferredCompanyName}`);
    publicDiscussion = await searchPublicDiscussion(inferredCompanyName);
  }

  // Step 6: Return structured results
  return {
    companyContext,
    hiringContext,
    publicDiscussion,
    pagesUsed,
  };
};

export default crawlCompanyData;
