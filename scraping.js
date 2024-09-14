const fetch = require('node-fetch'); 
const { JSDOM } = require('jsdom'); 
const TurndownService = require('turndown');

async function fetchHtmlToJson(url) {
  try {
    const response = await fetch(url);
    const htmlText = await response.text();

    const dom = new JSDOM(htmlText);
    const doc = dom.window.document;

    const base = new URL(url);
    doc.querySelectorAll('img').forEach((img) => {
      const src = img.getAttribute('src');
      if (src && !src.startsWith('http')) {
        img.setAttribute('src', new URL(src, base).href);
      }
    });

    /* doc.querySelectorAll('a').forEach((a) => {
      const href = a.getAttribute('href');
      if (href && href.startsWith('/') && !href.startsWith('//')) {
        a.setAttribute('href', new URL(href, base).href);
      }
    });*/

    doc.querySelectorAll('[style]').forEach((element) => {
      element.removeAttribute('style');
    });

    doc
      .querySelectorAll('script, style, iframe, noscript, meta, head, footer')
      .forEach((element) => {
        element.remove();
      });

    // Remove all <a> tags with href that contains "#"
    /*doc.querySelectorAll('a').forEach((a) => {
      const href = a.getAttribute('href');
      if (href) {
        // Remove `#` from href if it is the only part
        if (href === '#') {
          a.removeAttribute('href');
        } else if (href.startsWith('#')) {
          a.setAttribute('href', '');
        }
      }
    });*/

    const cleanedHtml = doc.body.innerHTML;

    //console.log('cleanedHtml', cleanedHtml);

    // Create a new Turndown service instance
    const turndownService = new TurndownService();

    const jsonResult = {
      success: true,
      data: {
        markdown: turndownService.turndown(cleanedHtml),
        metadata: {
          title: doc.querySelector('title')?.innerText || '',
          language: doc.documentElement.lang || 'en',
          robots:
            doc.querySelector('meta[name="robots"]')?.getAttribute('content') ||
            '',
          ogTitle:
            doc
              .querySelector('meta[property="og:title"]')
              ?.getAttribute('content') || '',
          ogDescription:
            doc
              .querySelector('meta[property="og:description"]')
              ?.getAttribute('content') || '',
          ogImage:
            doc
              .querySelector('meta[property="og:image"]')
              ?.getAttribute('content') || '',
          ogLocaleAlternate:
            Array.from(
              doc.querySelectorAll('meta[property="og:locale:alternate"]')
            ).map((el) => el.getAttribute('content')) || [],
          sourceURL: url,
          statusCode: response.status,
        },
      },
    };

    console.log(JSON.stringify(jsonResult, null, 2));
    return jsonResult;
  } catch (error) {
    console.error('Error fetching or parsing HTML:', error);
    return { success: false, error: error.message };
  }
}

fetchHtmlToJson('scrape url here.coms');