import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { query } = await req.json();
    if (!query || query.length < 1) {
      return new Response(JSON.stringify([]), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Use Yahoo Finance autocomplete API (no key required)
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=8&newsCount=0&listsCount=0&enableFuzzyQuery=false`;

    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    if (!response.ok) {
      // Fallback: try duckduckgo instant answer or return empty
      console.error("Yahoo Finance API error:", response.status);
      return new Response(JSON.stringify([]), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await response.json();
    const quotes = data.quotes || [];

    const results = quotes
      .filter((q: any) => q.quoteType === "EQUITY" || q.quoteType === "ETF")
      .map((q: any) => ({
        symbol: q.symbol,
        name: q.shortname || q.longname || q.symbol,
        exchange: q.exchDisp || q.exchange || "",
        country: extractCountry(q.exchange || ""),
        type: q.quoteType === "ETF" ? "etf" : "stock",
        sector: q.sector || null,
        industry: q.industry || null,
      }));

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Search error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function extractCountry(exchange: string): string {
  const map: Record<string, string> = {
    NMS: "US", NYQ: "US", NGM: "US", PCX: "US", BTS: "US", // US exchanges
    LSE: "GB", IOB: "GB",
    GER: "DE", FRA: "DE", XETRA: "DE",
    TYO: "JP", JPX: "JP",
    HKG: "HK",
    SHH: "CN", SHZ: "CN",
    PAR: "FR", EPA: "FR",
    TSE: "CA", TOR: "CA", CNQ: "CA",
    ASX: "AU",
    KSC: "KR", KOE: "KR",
    NSI: "IN", BSE: "IN", BOM: "IN",
    EBS: "CH", SWX: "CH",
    AMS: "NL",
    MIL: "IT",
    MCE: "ES", BME: "ES",
  };
  return map[exchange] || "US";
}
