import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-trigger-user-id",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");

    if (!serviceRoleKey || !anonKey) {
      console.error("Missing env vars:", { hasServiceRole: !!serviceRoleKey, hasAnon: !!anonKey });
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Determine if this is a cron (no auth) or user-initiated call
    const authHeader = req.headers.get("Authorization");
    const triggerUserId = req.headers.get("x-trigger-user-id");
    const isCronMode = !authHeader || authHeader === `Bearer ${anonKey}`;
    let userIds: string[] = [];

    if (triggerUserId) {
      // Triggered for a specific user (e.g. from Telegram bot)
      console.log(`Targeted refresh for user ${triggerUserId}`);
      userIds = [triggerUserId];
    } else if (!isCronMode) {
      // User-initiated: fetch only for this user
      const anonClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: userError } = await anonClient.auth.getUser();
      if (userError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userIds = [user.id];
    } else {
      // Cron-initiated: fetch for all users who have watchlist items
      console.log("Cron mode: fetching for all users");
      const { data: users, error } = await supabase
        .from("watchlist")
        .select("user_id")
        .limit(1000);
      if (error || !users) {
        console.error("Failed to get users:", error);
        return new Response(JSON.stringify({ error: "Failed to get users" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userIds = [...new Set(users.map((u) => u.user_id))];
      console.log(`Found ${userIds.length} users with watchlist items`);
    }

    if (userIds.length === 0) {
      return new Response(
        JSON.stringify({ message: "No users with watchlist items", articles: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let totalInserted = 0;
    let telegramSent = 0;

    for (const userId of userIds) {
      const { inserted, newArticles } = await fetchNewsForUser(supabase, userId, isCronMode);
      totalInserted += inserted;

      // Send Telegram summary always (cron, targeted, or manual app refresh)
      if (botToken) {
        const notified = await sendTelegramRefreshSummaryForUser(supabase, botToken, userId, newArticles);
        if (notified) telegramSent++;
      }
    }

    console.log(`Done: ${totalInserted} articles for ${userIds.length} users, telegram sent: ${telegramSent}`);

    return new Response(
      JSON.stringify({ 
        message: "News fetched", 
        articles: totalInserted, 
        users: userIds.length, 
        telegram_sent: telegramSent
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Fetch news error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// --- Helper Functions ---
function cleanCompanyName(name: string | null): string {
  if (!name) return "";
  let cleanName = name.replace(/\b(Inc\.?|Corp\.?|Ltd\.?|LLC|PLC|S\.p\.A\.?|S\.A\.?|AG|NV|SE|GmbH|Co\.?|Holdings?|Group|Enterprises|Technologies|New|\(The\))\b/gi, "");
  // Remove non-word characters except spaces and hyphens, then normalize spaces
  cleanName = cleanName.replace(/[^\w\s-]/g, "").replace(/\s+/g, " ").trim();
  return cleanName;
}

// --- Per-user news fetching (parallelized) ---

async function fetchNewsForUser(supabase: any, userId: string, lightweightMode = false): Promise<{ inserted: number; newArticles: any[] }> {
  const { data: watchlist, error: wlError } = await supabase
    .from("watchlist")
    .select("*")
    .eq("user_id", userId);

  if (wlError || !watchlist || watchlist.length === 0) return { inserted: 0, newArticles: [] };

  // Build a watchlist lookup for ticker → company name (used in Telegram formatting)
  const tickerToCompany: Record<string, string> = {};
  for (const w of watchlist) {
    if (w.ticker && w.company_name) tickerToCompany[w.ticker] = w.company_name;
  }

  const companyItems = lightweightMode ? watchlist.slice(0, 4) : watchlist;
  const countryLimit = lightweightMode ? 1 : Number.MAX_SAFE_INTEGER;
  const sectorLimit = lightweightMode ? 1 : Number.MAX_SAFE_INTEGER;
  const articlesPerQuery = lightweightMode ? 1 : 2;
  const queryRetries = lightweightMode ? 1 : 2;

  // Fetch user settings to get preferred article languages
  const { data: userSettings } = await supabase
    .from("user_settings")
    .select("article_languages")
    .eq("user_id", userId)
    .single();

  const userLanguages: string[] = userSettings?.article_languages && userSettings.article_languages.length > 0
    ? userSettings.article_languages
    : ["en-US"];

  const localesToFetch = userLanguages.map((langCode) => {
    const parts = langCode.split("-");
    const region = parts.length > 1 ? parts[1] : parts[0].toUpperCase();
    return { lang: langCode, region };
  });

  // Build base fetch tasks (query + metadata), then expand per locale below
  const baseTasks: { query: string; sectionType: string; tickerTags: string[] }[] = [];

  // Company News
  for (const item of companyItems) {
    const query = item.company_name ? cleanCompanyName(item.company_name) : item.ticker;
    baseTasks.push({ query, sectionType: "company", tickerTags: [item.ticker] });
  }

  // Market News
  const countries = [...new Set(watchlist.map((w: any) => w.country).filter(Boolean))];
  const countryQueries: Record<string, string> = {
    US: "S&P 500",
    GB: "FTSE 100",
    DE: "DAX",
    JP: "Nikkei 225",
    CN: "Shanghai Composite",
    FR: "CAC 40",
    CA: "S&P/TSX Composite",
    AU: "S&P/ASX 200",
    KR: "KOSPI",
    IN: "Nifty 50",
    HK: "Hang Seng",
    CH: "SMI",
    IT: "FTSE MIB",
    NL: "AEX",
    ES: "IBEX 35",
  };
  for (const country of countries.slice(0, countryLimit)) {
    const q = countryQueries[country as string] || `${country} stock index`;
    baseTasks.push({ query: q, sectionType: "market", tickerTags: [country as string] });
  }

  // Industry News
  const sectors = [...new Set(watchlist.map((w: any) => w.sector).filter(Boolean))];
  for (const sector of sectors.slice(0, sectorLimit)) {
    baseTasks.push({ query: sector as string, sectionType: "industry", tickerTags: [sector as string] });
  }

  // Expand each base task across all configured user locales
  const fetchTasks: { query: string; sectionType: string; tickerTags: string[]; lang: string; region: string }[] = [];
  for (const task of baseTasks) {
    for (const locale of localesToFetch) {
      fetchTasks.push({ ...task, lang: locale.lang, region: locale.region });
    }
  }

  // Execute fetches in parallel batches (lighter in cron mode)
  const allArticles: any[] = [];
  const BATCH_SIZE = lightweightMode ? 6 : 5;
  const BATCH_DELAY_MS = lightweightMode ? 0 : 500;

  for (let i = 0; i < fetchTasks.length; i += BATCH_SIZE) {
    const batch = fetchTasks.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (task) => {
        const articles = await fetchYahooNews(task.query, articlesPerQuery, queryRetries, task.lang, task.region);
        return articles.map((a) => ({
          ...a,
          user_id: userId,
          section_type: task.sectionType,
          ticker_tags: task.tickerTags,
        }));
      })
    );
    for (const res of results) {
      allArticles.push(...res);
    }
    // Small delay between batches to avoid rate limiting
    if (BATCH_DELAY_MS > 0 && i + BATCH_SIZE < fetchTasks.length) {
      await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
    }
  }

  // Deduplicate and upsert
  const seen = new Set<string>();
  const uniqueArticles = allArticles.filter((a) => {
    if (seen.has(a.url)) return false;
    seen.add(a.url);
    return true;
  });

  // Prefetch existing URLs for this user so we can identify which articles are genuinely new
  const urls = uniqueArticles.map((a) => a.url);
  const existingUrls = new Set<string>();
  if (urls.length > 0) {
    const { data: existing } = await supabase
      .from("digest_articles")
      .select("url")
      .eq("user_id", userId)
      .in("url", urls);
    if (existing) {
      for (const row of existing) existingUrls.add(row.url);
    }
  }

  let inserted = 0;
  const newArticles: any[] = [];
  for (const article of uniqueArticles) {
    const isNew = !existingUrls.has(article.url);
    const { error } = await supabase.from("digest_articles").upsert(
      {
        user_id: article.user_id,
        section_type: article.section_type,
        ticker_tags: article.ticker_tags,
        headline: article.headline,
        description: article.description,
        url: article.url,
        source_name: article.source_name,
        published_at: article.published_at,
        fetched_at: new Date().toISOString(),
      },
      { onConflict: "user_id,url", ignoreDuplicates: false }
    );
    if (!error) {
      inserted++;
      if (isNew) {
        newArticles.push({
          ...article,
          company_name: article.section_type === "company" ? tickerToCompany[article.ticker_tags?.[0]] : undefined,
        });
      }
    }
  }

  return { inserted, newArticles, debug_all_len: allArticles.length, debug_uniq_len: uniqueArticles.length, debug_tasks: fetchTasks.length, debug_wl: watchlist.length };
}

async function sendTelegramRefreshSummaryForUser(
  supabase: any,
  botToken: string,
  userId: string,
  newArticles: any[],
): Promise<boolean> {
  const { data: settings, error } = await supabase
    .from("user_settings")
    .select("telegram_chat_id")
    .eq("user_id", userId)
    .single();

  if (error || !settings?.telegram_chat_id) return false;

  try {
    if (newArticles.length === 0) {
      await sendTelegram(botToken, settings.telegram_chat_id, "📭 Daily digest checked: no new articles found.");
      return true;
    }

    const messages = formatDigestMessages(newArticles);
    for (const msg of messages) {
      await sendTelegram(botToken, settings.telegram_chat_id, msg, "HTML");
    }
    return true;
  } catch (error) {
    console.error(`Telegram send failed for user ${userId}:`, error);
    return false;
  }
}

// --- Telegram digest formatter (HTML mode, splits into <=4096 char messages) ---

const TELEGRAM_MAX_LEN = 4000; // safety margin under 4096

export function formatDigestMessages(articles: any[]): string[] {
  // Group by label. Order: markets → industries → companies.
  const marketGroups = new Map<string, any[]>();
  const industryGroups = new Map<string, any[]>();
  const companyGroups = new Map<string, any[]>();

  for (const a of articles) {
    const tag = a.ticker_tags?.[0] ?? "Other";
    if (a.section_type === "market") {
      const label = `${tag} Market`;
      if (!marketGroups.has(label)) marketGroups.set(label, []);
      marketGroups.get(label)!.push(a);
    } else if (a.section_type === "industry") {
      if (!industryGroups.has(tag)) industryGroups.set(tag, []);
      industryGroups.get(tag)!.push(a);
    } else {
      // company
      const label = a.company_name ? `${tag} (${a.company_name})` : tag;
      if (!companyGroups.has(label)) companyGroups.set(label, []);
      companyGroups.get(label)!.push(a);
    }
  }

  const orderedGroups: [string, any[]][] = [
    ...marketGroups.entries(),
    ...industryGroups.entries(),
    ...companyGroups.entries(),
  ];

  const total = articles.length;
  const header = `✅ Digest refreshed — ${total} new article${total === 1 ? "" : "s"}\n`;

  const messages: string[] = [];
  let current = header;

  for (const [label, items] of orderedGroups) {
    const groupHeader = `\n— <b>${escapeHtml(label)}</b>\n`;
    const lines: string[] = [];
    for (const item of items) {
      const source = item.source_name ? escapeHtml(item.source_name) : "Source";
      const title = escapeHtml(item.headline ?? "Untitled");
      const url = item.url;
      lines.push(` ${source}: <a href="${escapeAttr(url)}">${title}</a>`);
    }

    // Try to fit the entire group; if too big, split item-by-item.
    const fullBlock = groupHeader + lines.join("\n") + "\n";
    if (current.length + fullBlock.length <= TELEGRAM_MAX_LEN) {
      current += fullBlock;
      continue;
    }

    // Flush current and start fresh with the group header
    if (current.trim().length > 0) {
      messages.push(current.trimEnd());
      current = "";
    }
    current += groupHeader;
    for (const line of lines) {
      const lineWithNl = line + "\n";
      if (current.length + lineWithNl.length > TELEGRAM_MAX_LEN) {
        messages.push(current.trimEnd());
        current = groupHeader + lineWithNl; // repeat header for continuity
      } else {
        current += lineWithNl;
      }
    }
  }

  if (current.trim().length > 0) messages.push(current.trimEnd());
  return messages;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

async function sendTelegram(botToken: string, chatId: string, text: string, parseMode?: string) {
  const body: any = {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
  };
  if (parseMode) body.parse_mode = parseMode;

  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Telegram API error ${res.status}: ${body}`);
  }
}

// --- Yahoo Finance API helper ---

async function fetchYahooNews(
  query: string,
  limit: number,
  maxRetries = 2,
  lang = "en-US",
  region = "US",
): Promise<any[]> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&newsCount=${limit}&lang=${lang}&region=${region}`;
      const response = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
      });

      if (!response.ok) {
        console.error(`Yahoo API error for "${query.slice(0, 30)}":`, response.status);
        if (response.status === 429 && attempt < maxRetries - 1) {
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }
        return [];
      }

      const data = await response.json();
      const news = data.news || [];
      
      const items: any[] = [];
      for (const item of news) {
        if (item.title && item.link) {
          items.push({
            headline: item.title,
            url: item.link,
            source_name: item.publisher || null,
            published_at: item.providerPublishTime ? new Date(item.providerPublishTime * 1000).toISOString() : new Date().toISOString(),
            description: null,
          });
        }
      }
      return items.slice(0, limit);
    } catch (err) {
      console.error(`Error for "${query.slice(0, 30)}":`, err);
      if (attempt < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }
      return [];
    }
  }
  return [];
}
