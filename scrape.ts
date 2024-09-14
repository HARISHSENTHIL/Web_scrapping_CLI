import axios from "axios";
import * as cheerio from "cheerio";
import { configDotenv } from "dotenv";
configDotenv();

enum LogLevel {
  NONE = 'NONE',    // No logs will be output.
  ERROR = 'ERROR',  // For logging error messages that indicate a failure in a specific operation.
  WARN = 'WARN',    // For logging potentially harmful situations that are not necessarily errors.
  INFO = 'INFO',    // For logging informational messages that highlight the progress of the application.
  DEBUG = 'DEBUG',  // For logging detailed information on the flow through the system, primarily used for debugging.
  TRACE = 'TRACE'   // For logging more detailed information than the DEBUG level.
}
export class Logger {
  static colors = {
    ERROR: '\x1b[31m%s\x1b[0m', // Red
    WARN: '\x1b[33m%s\x1b[0m',  // Yellow
    INFO: '\x1b[34m%s\x1b[0m',  // Blue
    DEBUG: '\x1b[36m%s\x1b[0m', // Cyan
    TRACE: '\x1b[35m%s\x1b[0m'  // Magenta
  };

  static log (message: string, level: LogLevel) {
    const logLevel: LogLevel = LogLevel[process.env.LOGGING_LEVEL as keyof typeof LogLevel] || LogLevel.INFO;
    const levels = [LogLevel.NONE, LogLevel.ERROR, LogLevel.WARN, LogLevel.INFO, LogLevel.DEBUG, LogLevel.TRACE];
    const currentLevelIndex = levels.indexOf(logLevel);
    const messageLevelIndex = levels.indexOf(level);

    if (currentLevelIndex >= messageLevelIndex) {
      const color = Logger.colors[level];
      console[level.toLowerCase()](color, `[${new Date().toISOString()}]${level} - ${message}`);

      // const useDbAuthentication = process.env.USE_DB_AUTHENTICATION === 'true';
      // if (useDbAuthentication) {
      // save to supabase? another place?
      // supabase.from('logs').insert({ level: level, message: message, timestamp: new Date().toISOString(), success: boolean });
      // }
    }
  }
  static error(message: string | any) {
    Logger.log(message, LogLevel.ERROR);
  }

  static warn(message: string) {
    Logger.log(message, LogLevel.WARN);
  }

  static info(message: string) {
    Logger.log(message, LogLevel.INFO);
  }

  static debug(message: string) {
    Logger.log(message, LogLevel.DEBUG);
  }

  static trace(message: string) {
    Logger.log(message, LogLevel.TRACE);
  }
}


///////////////////////////////////////   scrapping strating from here /////////////////////////

/**
 * Scrapes data from a provided URL
 * @param url The URL to scrape
 * @returns Scraped content, list of extracted links, and metadata
 */
export async function scrapeDataFromUrl(
  url: string
): Promise<{ content: string; links: string[]; metadata: object; error?: string }> {
  try {
    // Send the request to the URL
    const response = await axios.get(url, {
      headers: {
        "Content-Type": "application/json",
      },
      timeout: 15000,
    });

    if (response.status !== 200) {
      Logger.debug(`Failed to fetch URL: ${url} with status code: ${response.status}`);
      return { content: "", links: [], metadata: {}, error: `HTTP Error: ${response.status}` };
    }

    const contentType = response.headers["content-type"];
    if (contentType && contentType.includes("application/pdf")) {
      Logger.debug(`PDF content found, cannot parse HTML from URL: ${url}`);
      return { content: "", links: [], metadata: {}, error: "Cannot scrape PDF content" };
    }

    const htmlContent = response.data;
    const $ = cheerio.load(htmlContent);

    const mainContent = extractMainContent($);
    const links = extractLinks(htmlContent, url);
    const metadata = extractMetadata($, url);

    Logger.debug(`Successfully scraped data from URL: ${url}`);

    return { content: formatContent(mainContent), links, metadata, error: undefined };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    Logger.debug(`Error scraping URL: ${url} - ${errorMessage}`);
    return { content: "", links: [], metadata: {}, error: errorMessage };
  }
}

/**
 * Extracts the main content by focusing on the primary content area
 * @param $ The Cheerio instance
 * @returns The cleaned HTML content
 */
function extractMainContent($: cheerio.CheerioAPI): string {
  const mainContentSelectors = [
    "#content", 
    "#main-content", 
    ".main-content", 
    ".article", 
    ".entry-content",
    ".mw-parser-output" 
  ];

  let mainContent = "";

  for (const selector of mainContentSelectors) {
    const content = $(selector).html();
    if (content) {
      mainContent = content;
      break;
    }
  }

  const excludeNonMainTags = [
    "header", "footer", "nav", "aside", ".header", ".top", ".navbar", "#header",
    ".footer", ".bottom", "#footer", ".sidebar", ".side", ".aside", "#sidebar",
    ".modal", ".popup", "#modal", ".overlay", ".ad", ".ads", ".advert", "#ad",
    ".lang-selector", ".language", "#language-selector", ".social", ".social-media",
    ".social-links", "#social", ".menu", ".navigation", "#nav", ".breadcrumbs",
    "#breadcrumbs", "#search-form", ".search", "#search", ".share", "#share",
    ".widget", "#widget", ".cookie", "#cookie"
  ];

  const $mainContent = cheerio.load(mainContent);
  excludeNonMainTags.forEach(selector => $mainContent(selector).remove());

  return $mainContent.html() || "";
}

/**
 * Formats the content to a specific format
 * @param content The HTML content to format
 * @returns Formatted content
 */
function formatContent(content: string): string {
  let formattedContent = content;

  formattedContent = formattedContent.replace(/<a href="([^"]+)"[^>]*>([^<]+)<\/a>/g, "[$2]($1)");

  formattedContent = formattedContent.replace(/<img src="([^"]+)"[^>]*>/g, "![]($1)");

  formattedContent = formattedContent.replace(/<i>([^<]+)<\/i>/g, "*$1*");
  formattedContent = formattedContent.replace(/<b>([^<]+)<\/b>/g, "**$1**");

  formattedContent = formattedContent.replace(/<\/?[^>]+>/g, "");

  return formattedContent;
}

/**
 * Extracts all the links from a webpage's HTML
 * @param html The HTML content of the page
 * @param baseUrl The base URL to resolve relative links
 * @returns An array of all the extracted links
 */
export function extractLinks(html: string, baseUrl: string): string[] {
  const $ = cheerio.load(html);
  const links: string[] = [];

  const urlObject = new URL(baseUrl);
  const origin = urlObject.origin;

  $('a').each((_, element) => {
    const href = $(element).attr('href');
    if (href) {
      if (href.startsWith('http://') || href.startsWith('https://')) {
        links.push(href); 
      } else if (href.startsWith('/')) {
        links.push(new URL(href, origin).href); 
      } else if (!href.startsWith('#') && !href.startsWith('mailto:')) {
        links.push(new URL(href, baseUrl).href); 
      }
    }
  });

  return [...new Set(links)];
}

/**
 * Extracts metadata from the page
 * @param $ The Cheerio instance
 * @param url The URL of the page
 * @returns The extracted metadata
 */
function extractMetadata($: cheerio.CheerioAPI, url: string): object {
  return {
    title: $("head title").text() || "",
    language: $("html").attr("lang") || "en",
    ogImage: $("meta[property='og:image']").attr("content") || "",
    sourceURL: url,
  };
}

/**
 * Main function for testing the scraping functionality
 * @param url The URL provided by the user to scrape
 */
async function main(url: string) {
  const { content, links, metadata, error } = await scrapeDataFromUrl(url);

  if (error) {
    console.error(`Error scraping the URL: ${error}`);
  } else {
    console.log("Scraped Content:", content);
    console.log("Extracted Links:", links);
    console.log("Metadata:", metadata);
  }
}

main("example url");
