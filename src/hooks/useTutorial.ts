import { useEffect, useCallback, useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";

export interface UseTutorialOptions {
  isMobile?: boolean;
  onOpenSidebar?: () => void;
  onCloseSidebar?: () => void;
}

export function useTutorial(options?: UseTutorialOptions) {
  const { user } = useAuth();
  const [isTourActive, setIsTourActive] = useState(false);
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const hasTriggeredRef = useRef(false);

  const markTutorialCompleted = useCallback(async () => {
    if (!user) return;
    const key = `stockpulse_tutorial_completed_${user.id}`;
    localStorage.setItem(key, "true");

    if (!user.user_metadata?.tutorial_completed) {
      try {
        await supabase.auth.updateUser({
          data: { tutorial_completed: true },
        });
      } catch (err) {
        console.error("Failed to update tutorial_completed in Supabase Auth:", err);
      }
    }
  }, [user]);

  const isDrawerMode = () => {
    if (optionsRef.current?.isMobile !== undefined) {
      return optionsRef.current.isMobile;
    }
    // Fallback: check viewport width or check if the search input is missing from normal layout
    return (
      (typeof window !== "undefined" && window.innerWidth < 768) ||
      !document.querySelector("#tour-watchlist-search")
    );
  };

  const startTour = useCallback(() => {
    if (!user) return;

    const isNarrow = isDrawerMode();

    // Force open the hamburger menu on narrow screens so the ticker section is visible
    if (isNarrow) {
      optionsRef.current?.onOpenSidebar?.();
    }

    setIsTourActive(true);

    // Give the drawer animation time to mount and slide in
    const delay = isNarrow ? 350 : 100;

    setTimeout(() => {
      const driverObj = driver({
        showProgress: true,
        animate: true,
        steps: [
          {
            element: "#tour-watchlist-search",
            waitForElement: 2000,
            popover: {
              title: "Adding Tickers",
              description:
                "Start by searching for stocks and ETFs worldwide. Add them to your watchlist to track their latest news and updates.",
              side: "bottom",
              align: "start",
              onNextClick: (_el, _step, { driver: d }) => {
                const isCurrentNarrow = isDrawerMode();
                if (isCurrentNarrow) {
                  // Close the sidebar to reveal the main digest feed
                  optionsRef.current?.onCloseSidebar?.();
                  setTimeout(() => {
                    d.moveNext();
                  }, 300);
                } else {
                  d.moveNext();
                }
              },
            },
          },
          {
            element: "#tour-refresh-button",
            popover: {
              title: "Refreshing Digest",
              description:
                "Your personalized news digest is generated based on your watchlist. Click Refresh to fetch the latest AI-curated articles.",
              side: "bottom",
              align: "start",
              onPrevClick: (_el, _step, { driver: d }) => {
                const isCurrentNarrow = isDrawerMode();
                if (isCurrentNarrow) {
                  // Re-open the sidebar when going back to the ticker search step
                  optionsRef.current?.onOpenSidebar?.();
                  setTimeout(() => {
                    d.movePrevious();
                  }, 350);
                } else {
                  d.movePrevious();
                }
              },
            },
          },
          {
            element: "#tour-digest-tabs",
            popover: {
              title: "Organized Digest Sections",
              description:
                "Articles are categorized so you can focus on what matters. Filter by time range and search within articles.",
              side: "bottom",
              align: "start",
            },
          },
          {
            element: "#tour-settings-button",
            popover: {
              title: "Preferences & Alerts",
              description:
                "Tailor StockPulse to your needs. Set up Telegram notifications and choose your preferred article languages.",
              side: "bottom",
              align: "end",
            },
          },
        ],
        onDestroyStarted: () => {
          setIsTourActive(false);
          optionsRef.current?.onCloseSidebar?.();
          markTutorialCompleted();
          driverObj.destroy();
        },
      });

      driverObj.drive();
    }, delay);
  }, [user, markTutorialCompleted]);

  useEffect(() => {
    if (!user) return;

    const key = `stockpulse_tutorial_completed_${user.id}`;
    const isCompletedInMeta = Boolean(user.user_metadata?.tutorial_completed);
    const isCompletedInLocal = localStorage.getItem(key) === "true";
    const isCompleted = isCompletedInMeta || isCompletedInLocal;

    // Sync localStorage if previously completed on another device/browser
    if (isCompletedInMeta && !isCompletedInLocal) {
      localStorage.setItem(key, "true");
    }

    // Check if there is a pending manual start from the settings page
    const forceStart = sessionStorage.getItem("stockpulse_force_tutorial");

    if (forceStart === "true") {
      sessionStorage.removeItem("stockpulse_force_tutorial");
      startTour();
      return;
    }

    if (!isCompleted && !hasTriggeredRef.current) {
      hasTriggeredRef.current = true;
      markTutorialCompleted();
      startTour();
    }
  }, [user, startTour, markTutorialCompleted]);

  return {
    startTour,
    isTourActive,
  };
}
