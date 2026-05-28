import axios from "axios";
import * as cheerio from "cheerio";

export type ScrapedContent = {
  title: string;
  content: string;
  url: string;
  metadata: {
    scrapedAt: string;
    method: string;
    contentLength: number;
    [key: string]: string | number | boolean;
  };
};

/**
 * Scrapes content from a URL using Cheerio (fast, for static sites)
 */
export async function scrapeWithCheerio(
  url: string,
): Promise<ScrapedContent | null> {
  try {
    console.log(`Scraping ${url} with Cheerio...`);

    const response = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; RAG-Bot/1.0)",
      },
    });

    const $ = cheerio.load(response.data);

    // Remove unwanted elements
    $(
      "script, style, noscript, nav, header, footer, aside, .sidebar, .menu, .navigation, .breadcrumbs, .advertisement, .popup",
    ).remove();

    // Extract title
    // (Cheerio's text() function returns just the text content of an HTML element and strips out the tags)
    const title =
      $("title").text().trim() || $("h1").first().text().trim() || "Untitled";

    // Extract main content
    const contentElements = $("main, article, .content, .post-content, p");
    const content = contentElements
      .map((_, el) => $(el).text())
      .get()
      .join("\n\n");

    // Clean up content
    const cleanContent = cleanText(content);

    if (!cleanContent || cleanContent.length < 100) {
      console.warn(`Insufficient content from ${url}`);
      return null;
    }

    return {
      title,
      content: cleanContent,
      url,
      metadata: {
        scrapedAt: new Date().toISOString(),
        method: "cheerio",
        contentLength: cleanContent.length,
      },
    };
  } catch (error) {
    console.error(`Error scraping ${url}:`, error);
    return null;
  }
}

export function cleanText(text: String) {
  return (
    text
      // Normalize Unicode characters into more standard text forms (e.g. Ｈｅｌｌｏ -> Hello)
      .normalize("NFKC")

      // Normalize accented characters by decomposing them into their component parts and then removing the combining marks
      // e.g. `café` becomes `cafe + ◌́ ` with the normalize call and then the replace removes the `◌́ `, leaving us with just `cafe`
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")

      // Normalize smart quotes
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")

      // Normalize dashes
      .replace(/[–—]/g, "-")

      // Normalize ellipsis characters
      .replace(/…/g, "...")

      // Removing some boilerplate phrases
      .replace(/click here/gi, "")
      .replace(/buy now/gi, "")
      .replace(/terms and conditions/gi, "")
      .replace(/all rights reserved/gi, "")
      .replace(/accept cookies/gi, "")

      // Normalize non-breaking spaces
      .replace(/\u00A0/g, " ")

      // Normalize whitespace
      .replace(/\s+/g, " ")

      // Normalize line breaks
      .replace(/\n+/g, "\n")

      .trim()
  );
}
