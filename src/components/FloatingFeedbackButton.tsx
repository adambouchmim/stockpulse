import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { MessageSquarePlus } from "lucide-react";

export default function FloatingFeedbackButton() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Only display for authenticated users and not on the feedback page itself
  if (!user || location.pathname === "/feedback") {
    return null;
  }

  return (
    <div className="fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-40">
      <button
        type="button"
        onClick={() => navigate("/feedback")}
        aria-label="Send Feedback"
        className="group flex items-center gap-2 px-3.5 py-3 sm:px-4 sm:py-2.5 rounded-full bg-primary text-primary-foreground font-medium text-sm shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:scale-105 active:scale-95 transition-all duration-200 border border-primary/20 backdrop-blur-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        <MessageSquarePlus className="h-5 w-5 transition-transform duration-200 group-hover:rotate-6 shrink-0" />
        <span className="hidden sm:inline font-sans">Feedback</span>
      </button>
    </div>
  );
}
