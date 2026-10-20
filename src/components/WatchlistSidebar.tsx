import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X, Plus, TrendingUp, BarChart3, Loader2 } from "lucide-react";
import { MarqueeText } from "@/components/MarqueeText";

interface WatchlistItem {
  id: string;
  ticker: string;
  company_name: string | null;
  sector: string | null;
  industry: string | null;
  country: string | null;
  exchange: string | null;
  asset_type: string | null;
}

interface SearchResult {
  symbol: string;
  name: string;
  exchange: string;
  country: string;
  type: string;
  sector?: string;
  industry?: string;
}

// Country to flag emoji mapping
const countryFlag = (country: string | null): string => {
  const flags: Record<string, string> = {
    US: "🇺🇸", USA: "🇺🇸", "United States": "🇺🇸",
    GB: "🇬🇧", UK: "🇬🇧", "United Kingdom": "🇬🇧",
    DE: "🇩🇪", Germany: "🇩🇪",
    JP: "🇯🇵", Japan: "🇯🇵",
    CN: "🇨🇳", China: "🇨🇳",
    FR: "🇫🇷", France: "🇫🇷",
    CA: "🇨🇦", Canada: "🇨🇦",
    AU: "🇦🇺", Australia: "🇦🇺",
    KR: "🇰🇷", "South Korea": "🇰🇷",
    IN: "🇮🇳", India: "🇮🇳",
    HK: "🇭🇰", "Hong Kong": "🇭🇰",
    CH: "🇨🇭", Switzerland: "🇨🇭",
  };
  if (!country) return "🌍";
  return flags[country] || "🌍";
};

export default function WatchlistSidebar() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);

  // Fetch watchlist
  useEffect(() => {
    if (!user) return;
    const fetchWatchlist = async () => {
      const { data, error } = await supabase
        .from("watchlist")
        .select("*")
        .order("ticker");
      if (error) {
        console.error("Error fetching watchlist:", error);
      } else {
        setWatchlist(data || []);
      }
      setLoading(false);
    };
    fetchWatchlist();
  }, [user]);

  // Debounced search
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const { data, error } = await supabase.functions.invoke("search-tickers", {
          body: { query: searchQuery },
        });
        if (error) {
          console.error("Search error:", error);
          setSearchResults([]);
        } else {
          setSearchResults((data || []).slice(0, 6));
        }
      } catch (err) {
        console.error("Search error:", err);
        setSearchResults([]);
      }
      setSearching(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const addTicker = useCallback(async (result: SearchResult) => {
    if (!user) return;

    // Check for duplicates
    const existing = watchlist.find(
      (w) => w.ticker.toLowerCase() === result.symbol.toLowerCase()
    );
    if (existing) {
      toast({
        title: "Already watching",
        description: `${result.symbol} is already in your watchlist`,
        variant: "destructive",
      });
      return;
    }

    const { data, error } = await supabase.from("watchlist").insert({
      user_id: user.id,
      ticker: result.symbol,
      company_name: result.name,
      sector: result.sector || null,
      industry: result.industry || null,
      country: result.country,
      exchange: result.exchange,
      asset_type: result.type as "stock" | "etf",
    }).select().single();

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else if (data) {
      setWatchlist((prev) => [...prev, data].sort((a, b) => a.ticker.localeCompare(b.ticker)));
      setSearchQuery("");
      setSearchResults([]);
      toast({ title: "Added", description: `${result.symbol} added to watchlist` });
      window.dispatchEvent(new Event("watchlist-changed"));
    }
  }, [user, watchlist, toast]);

  const removeTicker = async (id: string, ticker: string) => {
    const { error } = await supabase.from("watchlist").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setWatchlist((prev) => prev.filter((w) => w.id !== id));
      toast({ title: "Removed", description: `${ticker} removed from watchlist` });
    }
  };

  const stocks = watchlist.filter((w) => w.asset_type === "stock");
  const etfs = watchlist.filter((w) => w.asset_type === "etf");

  return (
    <aside className="w-full h-full flex flex-col bg-sidebar border-r border-sidebar-border">
      {/* Header */}
      <div className="p-4 lg:p-5 border-b border-sidebar-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h2 className="font-display text-lg font-semibold text-sidebar-foreground">Watchlist</h2>
          </div>
          {watchlist.length > 0 && (
            <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border">
              {watchlist.length} {watchlist.length === 1 ? "ticker" : "tickers"}
            </span>
          )}
        </div>

        {/* Search */}
        <div id="tour-watchlist-search" className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          {searching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
          )}
          <Input
            placeholder="Search tickers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-secondary border-sidebar-border text-sm font-mono h-10"
          />
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="mt-2 bg-popover border border-border rounded-md overflow-hidden shadow-lg">
            {searchResults.map((result) => (
              <button
                key={result.symbol}
                onClick={() => addTicker(result)}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 hover:bg-secondary transition-colors text-left"
              >
                <span className="ticker-badge shrink-0 min-w-[56px] text-center">{result.symbol}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{result.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {countryFlag(result.country)} {result.exchange}
                    {result.sector && <span className="ml-1.5 opacity-60">· {result.sector}</span>}
                  </p>
                </div>
                <Plus className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Watchlist */}
      <div className="flex-1 overflow-y-auto p-4 lg:p-5 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
          </div>
        ) : watchlist.length === 0 ? (
          <div className="text-center py-12 space-y-3">
            <BarChart3 className="h-10 w-10 text-muted-foreground/40 mx-auto" />
            <p className="text-sm text-muted-foreground">
              Add your first ticker to start building your digest
            </p>
            <div className="animate-pulse-glow text-primary text-xl">↑</div>
          </div>
        ) : (
          <>
            {stocks.length > 0 && (
              <WatchlistGroup
                title="Stocks"
                items={stocks}
                onRemove={removeTicker}
              />
            )}
            {etfs.length > 0 && (
              <WatchlistGroup
                title="ETFs"
                items={etfs}
                onRemove={removeTicker}
              />
            )}
          </>
        )}
      </div>
    </aside>
  );
}

function WatchlistGroup({
  title,
  items,
  onRemove,
}: {
  title: string;
  items: WatchlistItem[];
  onRemove: (id: string, ticker: string) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2.5">
        <h3 className="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider">
          {title}
        </h3>
        <span className="text-[11px] font-mono text-muted-foreground/60">
          {items.length}
        </span>
      </div>
      <div className="space-y-1.5">
        {items.map((item, i) => (
          <div
            key={item.id}
            className="group flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-secondary/80 transition-all min-h-[56px]"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <span className="ticker-badge shrink-0 min-w-[56px] text-center font-mono font-semibold">
              {item.ticker}
            </span>
            <div className="flex-1 min-w-0">
              <MarqueeText
                text={item.company_name || item.ticker}
                delayMs={(i * 600) % 3000}
                className="text-sm font-bold text-foreground"
              />
              <p
                className="text-xs text-muted-foreground truncate"
                title={`${item.country ? countryFlag(item.country) + " " : ""}${item.exchange || ""}${item.sector ? " · " + item.sector : ""}`}
              >
                {countryFlag(item.country)} {item.exchange}
                {item.sector && <span className="ml-1.5 opacity-60">· {item.sector}</span>}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
              onClick={() => onRemove(item.id, item.ticker)}
              aria-label={`Remove ${item.ticker}`}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
