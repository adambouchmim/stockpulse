import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import WatchlistSidebar from "@/components/WatchlistSidebar";
import DigestFeed from "@/components/DigestFeed";
import { Button } from "@/components/ui/button";
import { TrendingUp, LogOut, Settings, Menu, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useTutorial } from "@/hooks/useTutorial";

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Initialize the tutorial on mount
  const { isTourActive } = useTutorial({
    isMobile,
    onOpenSidebar: () => setSidebarOpen(true),
    onCloseSidebar: () => setSidebarOpen(false),
  });

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Top Bar */}
      <nav className="h-14 border-b border-border bg-background/80 backdrop-blur-md flex items-center justify-between px-4 shrink-0 z-20">
        <div className="flex items-center gap-3">
          {isMobile && (
            <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen} modal={!isTourActive}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="left"
                className="p-0 w-80"
                onPointerDownOutside={(e) => {
                  if (isTourActive) e.preventDefault();
                }}
                onInteractOutside={(e) => {
                  if (isTourActive) e.preventDefault();
                }}
              >
                <WatchlistSidebar />
              </SheetContent>
            </Sheet>
          )}
          <div className="flex items-center gap-2 text-primary">
            <TrendingUp className="h-5 w-5" />
            <span className="font-display text-lg font-bold tracking-tight">StockPulse</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-mono hidden sm:block">
            {user?.email}
          </span>
          <ThemeToggle />
          <Button id="tour-settings-button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/settings")}>
            <Settings className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleSignOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </nav>

      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Desktop Sidebar */}
        {!isMobile && (
          <div className="w-80 shrink-0 border-r border-border overflow-hidden">
            <WatchlistSidebar />
          </div>
        )}
        {/* Feed */}
        <DigestFeed />
      </div>
    </div>
  );
}
