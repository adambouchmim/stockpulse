import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  RefreshCw,
  Bookmark,
  ExternalLink,
  Clock,
  Building2,
  Globe,
  Factory,
  Loader2,
  Search,
  X } from
"lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Article {
  id: string;
  section_type: string | null;
  ticker_tags: string[] | null;
  headline: string;
  description: string | null;
  url: string;
  source_name: string | null;
  published_at: string | null;
  fetched_at: string | null;
}

type TimeRange = "week" | "prev_week" | "two_weeks";

export default function DigestFeed() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>("week");
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [bookmarkedArticles, setBookmarkedArticles] = useState<Article[]>([]);
  const [activeTab, setActiveTab] = useState("company");
  const [searchQuery, setSearchQuery] = useState("");

  // Listen for watchlist changes to auto-refresh
  useEffect(() => {
    const handler = () => handleRefresh();
    window.addEventListener("watchlist-changed", handler);
    return () => window.removeEventListener("watchlist-changed", handler);
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchArticles();
    fetchBookmarks();

    const channel = supabase
      .channel("digest_articles_changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "digest_articles",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          setArticles((prev) => {
            if (prev.some((a) => a.url === payload.new.url)) return prev;
            const newArticle = payload.new as Article;
            return [newArticle, ...prev].sort((a, b) => {
               const dateA = a.published_at ? new Date(a.published_at).getTime() : 0;
               const dateB = b.published_at ? new Date(b.published_at).getTime() : 0;
               return dateB - dateA;
            });
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, timeRange]);

  const fetchArticles = async () => {
    if (!user) return;
    setLoading(true);

    const now = new Date();
    let startDate: Date;
    let endDate: Date = now;

    switch (timeRange) {
      case "prev_week":
        startDate = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
        endDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "two_weeks":
        startDate = new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000);
        endDate = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    const { data, error } = await supabase.
    from("digest_articles").
    select("*").
    gte("fetched_at", startDate.toISOString()).
    lte("fetched_at", endDate.toISOString()).
    order("published_at", { ascending: false });

    if (error) {
      console.error("Error fetching articles:", error);
    } else {
      setArticles(data || []);
    }
    setLoading(false);
  };

  const fetchBookmarks = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("bookmarks")
      .select(`
        article_id,
        digest_articles (*)
      `)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error fetching bookmarks:", error);
      return;
    }

    if (data) {
      setBookmarkedIds(new Set(data.map((b) => b.article_id)));
      
      const articlesList = data
        .map((b: any) => b.digest_articles)
        .filter(Boolean) as Article[];

      // Sort bookmarks by publishedDate descending
      articlesList.sort((a, b) => {
        const dateA = a.published_at ? new Date(a.published_at).getTime() : 0;
        const dateB = b.published_at ? new Date(b.published_at).getTime() : 0;
        return dateB - dateA;
      });

      setBookmarkedArticles(articlesList);
    }
  };

  const toggleBookmark = async (articleId: string) => {
    if (!user) return;
    const isBookmarked = bookmarkedIds.has(articleId);

    if (isBookmarked) {
      await supabase.from("bookmarks").delete().eq("article_id", articleId).eq("user_id", user.id);
      setBookmarkedIds((prev) => {
        const next = new Set(prev);
        next.delete(articleId);
        return next;
      });
      setBookmarkedArticles((prev) => prev.filter((a) => a.id !== articleId));
    } else {
      await supabase.from("bookmarks").insert({ user_id: user.id, article_id: articleId });
      setBookmarkedIds((prev) => new Set(prev).add(articleId));
      
      // Find the article in the current list to add it to bookmarkedArticles
      const article = articles.find((a) => a.id === articleId);
      if (article) {
        setBookmarkedArticles((prev) => {
          const next = [article, ...prev];
          next.sort((a, b) => {
            const dateA = a.published_at ? new Date(a.published_at).getTime() : 0;
            const dateB = b.published_at ? new Date(b.published_at).getTime() : 0;
            return dateB - dateA;
          });
          return next;
        });
      }
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-news", {
        headers: { "x-trigger-user-id": user?.id ?? "" },
      });
      if (error) {
        console.error("Fetch news error:", error);
        toast({
          title: "Refresh Failed",
          description: error.message || "Failed to fetch news from backend.",
          variant: "destructive",
        });
      } else {
        console.log("News fetched:", data);
        const articleCount = data?.articles ?? 0;
        const telegramSent = data?.telegram_sent ?? 0;
        
        if (articleCount > 0) {
          toast({
            title: "Refresh Complete",
            description: `Successfully fetched ${articleCount} new article(s). Telegram notification sent: ${telegramSent ? 'Yes' : 'No'}.`,
          });
        } else {
          toast({
            title: "Refresh Complete",
            description: data?.message || "No new articles found.",
          });
        }
      }
    } catch (err: any) {
      console.error("Refresh error:", err);
      toast({
        title: "Refresh Error",
        description: err.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    }
    await fetchArticles();
    setRefreshing(false);
  };

  const filteredArticles = useMemo(() => {
    if (!searchQuery.trim()) return articles;
    const q = searchQuery.toLowerCase();
    return articles.filter(
      (a) =>
      a.ticker_tags?.some((t) => t.toLowerCase().includes(q)) ||
      a.headline.toLowerCase().includes(q) ||
      a.source_name?.toLowerCase().includes(q)
    );
  }, [articles, searchQuery]);

  const filteredBookmarkedArticles = useMemo(() => {
    if (!searchQuery.trim()) return bookmarkedArticles;
    const q = searchQuery.toLowerCase();
    return bookmarkedArticles.filter(
      (a) =>
      a.ticker_tags?.some((t) => t.toLowerCase().includes(q)) ||
      a.headline.toLowerCase().includes(q) ||
      a.source_name?.toLowerCase().includes(q)
    );
  }, [bookmarkedArticles, searchQuery]);

  const companyArticles = filteredArticles.filter((a) => a.section_type === "company");
  const marketArticles = filteredArticles.filter((a) => a.section_type === "market");
  const industryArticles = filteredArticles.filter((a) => a.section_type === "industry");

  const lastFetched = articles.length > 0 ? articles[0].fetched_at : null;

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Header - Title, Search Bar, Tabs */}
        <header className="shrink-0 bg-background/80 backdrop-blur-md border-b border-border px-6 py-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "'Malayalam MN', sans-serif" }}>Weekly Digest</h1>
              {lastFetched && (
                <p className="text-xs text-muted-foreground mt-1 font-mono">
                  <Clock className="inline h-3 w-3 mr-1" />
                  Last updated: {formatDistanceToNow(new Date(lastFetched), { addSuffix: true })}
                </p>
              )}
            </div>
            {activeTab !== "saved" && (
              <div className="flex items-center gap-3">
                {/* Time Range Selector */}
                <div className="flex bg-secondary rounded-md p-0.5">
                  {([
                    ["week", "This Week"],
                    ["prev_week", "Last Week"],
                    ["two_weeks", "2 Weeks Ago"]
                  ] as const).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setTimeRange(key)}
                      className={`px-3 py-1.5 text-xs font-mono rounded transition-colors ${
                        timeRange === key
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <Button
                  id="tour-refresh-button"
                  variant="outline"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={refreshing}
                >
                  <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>
            )}
          </div>

          {/* Search Bar */}
          <div className="relative max-w-4xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Filter by ticker, keyword, or source…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-9 py-2 text-sm bg-secondary border border-border rounded-md font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Company/market/industry sections tab */}
          <TabsList id="tour-digest-tabs" className="w-full justify-start bg-secondary">
            <TabsTrigger value="company" className="gap-1.5 font-mono text-xs">
              <Building2 className="h-4 w-4" />
              Company ({companyArticles.length})
            </TabsTrigger>
            <TabsTrigger value="market" className="gap-1.5 font-mono text-xs">
              <Globe className="h-4 w-4" />
              Market ({marketArticles.length})
            </TabsTrigger>
            <TabsTrigger value="industry" className="gap-1.5 font-mono text-xs">
              <Factory className="h-4 w-4" />
              Industry ({industryArticles.length})
            </TabsTrigger>
            <TabsTrigger value="saved" className="gap-1.5 font-mono text-xs">
              <Bookmark className="h-4 w-4" />
              Saved ({bookmarkedArticles.length})
            </TabsTrigger>
          </TabsList>
        </header>

        {/* Content Section - Independent Scroll */}
        <div className="flex-1 overflow-y-auto px-6 py-6 min-h-0">
          <div className="max-w-4xl">
            {loading ? (
              <div className="space-y-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="bg-card rounded-lg border border-border p-6 animate-pulse">
                    <div className="h-4 bg-secondary rounded w-3/4 mb-3" />
                    <div className="h-3 bg-secondary rounded w-1/2 mb-2" />
                    <div className="h-3 bg-secondary rounded w-full" />
                  </div>
                ))}
              </div>
            ) : (activeTab !== "saved" && articles.length === 0) ? (
              <div className="text-center py-20 space-y-4">
                <Globe className="h-12 w-12 text-muted-foreground/30 mx-auto" />
                <h3 className="font-display text-xl text-muted-foreground">No articles yet</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  Add tickers to your watchlist and refresh to fetch the latest news. Articles will appear here organized by company, market, and industry.
                </p>
              </div>
            ) : (
              <>
                <TabsContent value="company" className="m-0 mt-0 focus-visible:outline-none">
                  <ArticleList
                    articles={companyArticles}
                    bookmarkedIds={bookmarkedIds}
                    onToggleBookmark={toggleBookmark}
                    emptyMessage="No company news found"
                  />
                </TabsContent>
                <TabsContent value="market" className="m-0 mt-0 focus-visible:outline-none">
                  <ArticleList
                    articles={marketArticles}
                    bookmarkedIds={bookmarkedIds}
                    onToggleBookmark={toggleBookmark}
                    emptyMessage="No market news found"
                  />
                </TabsContent>
                <TabsContent value="industry" className="m-0 mt-0 focus-visible:outline-none">
                  <ArticleList
                    articles={industryArticles}
                    bookmarkedIds={bookmarkedIds}
                    onToggleBookmark={toggleBookmark}
                    emptyMessage="No industry news found"
                  />
                </TabsContent>
                <TabsContent value="saved" className="m-0 mt-0 focus-visible:outline-none">
                  <ArticleList
                    articles={filteredBookmarkedArticles}
                    bookmarkedIds={bookmarkedIds}
                    onToggleBookmark={toggleBookmark}
                    emptyMessage="No bookmarked articles yet. Click the bookmark icon on any article to save it here."
                  />
                </TabsContent>
              </>
            )}
          </div>
        </div>
      </Tabs>
    </div>
  );

}

function ArticleList({ articles, bookmarkedIds, onToggleBookmark, emptyMessage }: { articles: Article[]; bookmarkedIds: Set<string>; onToggleBookmark: (id: string) => void; emptyMessage: string }) {
  if (articles.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">{emptyMessage}</p>;
  }
  return (
    <div className="space-y-3">
      {articles.map((article, i) => (
        <ArticleCard
          key={article.id}
          article={article}
          index={i}
          isBookmarked={bookmarkedIds.has(article.id)}
          onToggleBookmark={() => onToggleBookmark(article.id)}
        />
      ))}
    </div>
  );
}

function ArticleCard({
  article,
  index,
  isBookmarked,
  onToggleBookmark





}: {article: Article;index: number;isBookmarked: boolean;onToggleBookmark: () => void;}) {
  return (
    <div
      className="bg-card border border-border rounded-lg p-5 card-glow animate-fade-in-up group"
      style={{ animationDelay: `${index * 80}ms` }}>
      
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Source */}
          <div className="flex items-center gap-2 mb-2">
            {article.source_name &&
            <span className="text-xs font-mono text-muted-foreground">
                {article.source_name}
              </span>
            }
            {article.published_at &&
            <span className="text-xs text-muted-foreground">
                · {formatDistanceToNow(new Date(article.published_at), { addSuffix: true })}
              </span>
            }
          </div>

          {/* Headline */}
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-display text-base font-semibold leading-snug hover:text-primary transition-colors inline-flex items-start gap-1.5">
            
            {article.headline}
            <ExternalLink className="h-3.5 w-3.5 shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
          </a>


          {/* Tags */}
          {article.ticker_tags && article.ticker_tags.length > 0 &&
          <div className="flex flex-wrap gap-1.5 mt-3">
              {article.ticker_tags.map((tag) =>
            <span key={tag} className="ticker-badge">
                  {tag}
                </span>
            )}
            </div>
          }
        </div>

        {/* Bookmark */}
        <button
          onClick={onToggleBookmark}
          className="shrink-0 p-1.5 rounded hover:bg-secondary transition-colors"
          aria-label={isBookmarked ? "Remove bookmark" : "Add bookmark"}>
          
          <Bookmark
            className={`h-4 w-4 ${
            isBookmarked ? "fill-primary text-primary" : "text-muted-foreground"}`
            } />
          
        </button>
      </div>
    </div>);

}