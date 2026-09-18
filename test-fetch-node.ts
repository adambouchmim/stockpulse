async function fetchGoogleNews() {
  const query = "Boston Scientific Corporation";
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" },
  });
  
  const text = await response.text();
  const items = parseRSSItems(text, 5);
  console.log("Parsed items:", items.length);
  if (items.length > 0) {
    console.log("First item url:", items[0].url);
  } else {
    console.log("No items parsed! Let's see the first <item> match:");
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    const match = itemRegex.exec(text);
    if (match) console.log("Item XML:", match[1].slice(0, 300));
  }
}

function parseRSSItems(xml: string, limit: number): any[] {
  const items: any[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null && items.length < limit) {
    const itemXml = match[1];
    const headline = extractTag(itemXml, "title");
    const url = extractTag(itemXml, "link");
    const pubDate = extractTag(itemXml, "pubDate");
    const source = extractTag(itemXml, "source");
    const description = extractTag(itemXml, "description");

    if (headline && url) {
      items.push({
        headline, url, source, pubDate
      });
    } else {
       console.log("Missing headline or url! headline:", !!headline, "url:", !!url);
    }
  }

  return items;
}

function extractTag(xml: string, tag: string): string | null {
  const cdataRegex = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`);
  const cdataMatch = cdataRegex.exec(xml);
  if (cdataMatch) return cdataMatch[1].trim();

  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`);
  const match = regex.exec(xml);
  return match ? match[1].trim() : null;
}

fetchGoogleNews();
