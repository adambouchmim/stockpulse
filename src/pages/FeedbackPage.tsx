import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  ArrowLeft,
  Send,
  Star,
  MessageSquare,
  Bug,
  Lightbulb,
  FileQuestion,
  Layers,
  CheckCircle2,
  TrendingUp,
  Loader2,
  Mail,
  AlertTriangle,
} from "lucide-react";

type FeedbackCategory = "feature" | "bug" | "content" | "general" | "other";

interface CategoryOption {
  id: FeedbackCategory;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const CATEGORIES: CategoryOption[] = [
  {
    id: "feature",
    label: "Feature Request",
    icon: Lightbulb,
    description: "Suggest an idea or new capability",
  },
  {
    id: "bug",
    label: "Bug Report",
    icon: Bug,
    description: "Something is broken or behaving unexpectedly",
  },
  {
    id: "content",
    label: "News / Content",
    icon: Layers,
    description: "Issue with ticker tags, digest, or sources",
  },
  {
    id: "general",
    label: "General Feedback",
    icon: MessageSquare,
    description: "Overall thoughts, praise, or critique",
  },
  {
    id: "other",
    label: "Other",
    icon: FileQuestion,
    description: "Anything else on your mind",
  },
];

export default function FeedbackPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [category, setCategory] = useState<FeedbackCategory>("general");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [includeDiagnostics, setIncludeDiagnostics] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showEmailAppFallback, setShowEmailAppFallback] = useState(false);

  const getMailtoUrl = () => {
    const categoryLabel = CATEGORIES.find((c) => c.id === category)?.label || category;
    const mailSubject = encodeURIComponent(`[StockPulse Feedback - ${categoryLabel}] ${subject}`);
    const mailBody = encodeURIComponent(
      `From: ${user?.email || "Authenticated User"}\n` +
      `Category: ${categoryLabel}\n` +
      `Rating: ${rating ? `${rating} of 5 stars` : "Not provided"}\n\n` +
      `Message:\n${message}\n\n` +
      (includeDiagnostics
        ? `---\nDiagnostics:\nURL: ${window.location.href}\nScreen: ${window.innerWidth}x${window.innerHeight}\nUser Agent: ${navigator.userAgent}\n`
        : "")
    );
    return `mailto:pulsedigeststock@gmail.com?subject=${mailSubject}&body=${mailBody}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!subject.trim()) {
      toast({
        title: "Subject required",
        description: "Please provide a short summary of your feedback.",
        variant: "destructive",
      });
      return;
    }

    if (!message.trim()) {
      toast({
        title: "Message required",
        description: "Please share details about your feedback or suggestion.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    setShowEmailAppFallback(false);

    const metadata = includeDiagnostics
      ? {
          userAgent: navigator.userAgent,
          screenSize: `${window.innerWidth}x${window.innerHeight}`,
          currentUrl: window.location.href,
          platform: navigator.platform,
          language: navigator.language,
        }
      : {};

    try {
      const categoryLabel = CATEGORIES.find((c) => c.id === category)?.label || category;

      // 1. Send feedback directly to pulsedigeststock@gmail.com via FormSubmit AJAX API
      const emailResponse = await fetch("https://formsubmit.co/ajax/pulsedigeststock@gmail.com", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          _subject: `[StockPulse Feedback - ${categoryLabel}] ${subject.trim()}`,
          _replyto: user?.email || "unknown@stockpulse.user",
          "User Email": user?.email || "Authenticated User",
          Category: categoryLabel,
          Rating: rating ? `${rating} of 5 stars` : "Not provided",
          Subject: subject.trim(),
          Message: message.trim(),
          Diagnostics: includeDiagnostics
            ? `URL: ${window.location.href} | Viewport: ${window.innerWidth}x${window.innerHeight} | UA: ${navigator.userAgent}`
            : "None",
          _template: "table",
          _captcha: "false",
        }),
      });

      const emailResult = await emailResponse.json();

      if (emailResponse.ok && (emailResult.success === "true" || emailResult.success === true || emailResult.message)) {
        // Also save to Supabase DB as a background effort (silent if migration hasn't been run)
        if (user) {
          try {
            await supabase.from("feedback").insert({
              user_id: user.id,
              user_email: user.email || "unknown@stockpulse.user",
              category,
              subject: subject.trim(),
              message: message.trim(),
              rating: rating || null,
              metadata: {
                ...metadata,
                submitted_at: new Date().toISOString(),
              },
            });
          } catch {
            // ignore DB errors since email was already dispatched
          }
        }

        setSubmitted(true);
        toast({
          title: "Feedback Sent!",
          description: "Thank you! Your feedback has been sent directly to pulsedigeststock@gmail.com.",
        });
        return;
      }

      // If FormSubmit was blocked or returned an error, attempt Edge function or throw
      throw new Error(emailResult?.message || "Failed to dispatch email.");
    } catch (err: unknown) {
      console.warn("Direct email delivery failed, checking fallbacks:", err);
      setShowEmailAppFallback(true);

      // Attempt DB insert fallback if email service was blocked (e.g. adblocker)
      if (user) {
        try {
          const { error: dbError } = await supabase.from("feedback").insert({
            user_id: user.id,
            user_email: user.email || "unknown@stockpulse.user",
            category,
            subject: subject.trim(),
            message: message.trim(),
            rating: rating || null,
            metadata: {
              ...metadata,
              submitted_at: new Date().toISOString(),
              fallback: true,
            },
          });

          if (!dbError) {
            setSubmitted(true);
            toast({
              title: "Feedback Saved",
              description: "Your feedback was saved. You can also send a copy directly via email below.",
            });
            return;
          }
        } catch {
          // ignore
        }
      }

      toast({
        title: "Could not send email automatically",
        description: "Please use the 'Send directly via Email App' button below.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setCategory("general");
    setSubject("");
    setMessage("");
    setRating(null);
    setHoverRating(null);
    setSubmitted(false);
    setShowEmailAppFallback(false);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Navbar */}
      <header className="h-14 border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => navigate(-1)}
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2 text-primary font-display font-bold">
            <TrendingUp className="h-5 w-5" />
            <span className="text-base tracking-tight">StockPulse</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-8 sm:py-10">
        {submitted ? (
          <div className="bg-card border border-border rounded-xl p-8 sm:p-10 text-center space-y-6 shadow-sm animate-in fade-in-50 zoom-in-95 duration-200">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <div className="space-y-2">
              <h2 className="font-display text-2xl font-bold tracking-tight text-foreground">
                Thank You for Your Feedback!
              </h2>
              <p className="text-muted-foreground text-sm max-w-md mx-auto">
                Your thoughts help us continuously refine StockPulse. A copy of
                your feedback has been sent to{" "}
                <span className="font-medium text-foreground">
                  pulsedigeststock@gmail.com
                </span>
                .
              </p>
            </div>
            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button
                variant="default"
                onClick={() => navigate("/")}
                className="w-full sm:w-auto"
              >
                Return to Dashboard
              </Button>
              <Button
                variant="outline"
                onClick={handleReset}
                className="w-full sm:w-auto"
              >
                Send Another Response
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                Feedback & Suggestions
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Help us make StockPulse better. Share your experience, report a
                bug, or request a feature.
              </p>
            </div>

            <form
              onSubmit={handleSubmit}
              className="bg-card border border-border rounded-xl p-6 sm:p-8 space-y-6 shadow-sm"
            >
              {/* User Email Info */}
              <div className="text-xs text-muted-foreground bg-muted/40 border border-border/50 rounded-lg p-3 flex items-center justify-between">
                <span>
                  Submitting as:{" "}
                  <strong className="text-foreground font-medium">
                    {user?.email || "Authenticated User"}
                  </strong>
                </span>
                <span className="text-muted-foreground text-[11px]">
                  Direct reply target
                </span>
              </div>

              {/* Category Picker */}
              <div className="space-y-2.5">
                <Label className="text-sm font-semibold text-foreground">
                  Category
                </Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {CATEGORIES.map((cat) => {
                    const Icon = cat.icon;
                    const isSelected = category === cat.id;
                    return (
                      <button
                        type="button"
                        key={cat.id}
                        onClick={() => setCategory(cat.id)}
                        className={`flex flex-col items-start p-3 rounded-lg border text-left transition-all duration-150 ${
                          isSelected
                            ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary"
                            : "border-border bg-background hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Icon
                            className={`h-4 w-4 ${
                              isSelected ? "text-primary" : "text-muted-foreground"
                            }`}
                          />
                          <span className="text-xs font-semibold">
                            {cat.label}
                          </span>
                        </div>
                        <span className="text-[11px] text-muted-foreground line-clamp-1">
                          {cat.description}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Satisfaction Rating */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold text-foreground">
                    Experience Rating (Optional)
                  </Label>
                  {rating && (
                    <button
                      type="button"
                      onClick={() => setRating(null)}
                      className="text-xs text-muted-foreground hover:underline"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  {[1, 2, 3, 4, 5].map((star) => {
                    const active = (hoverRating ?? rating ?? 0) >= star;
                    return (
                      <button
                        type="button"
                        key={star}
                        onClick={() => setRating(star)}
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(null)}
                        aria-label={`${star} star`}
                        className="p-1 rounded hover:bg-muted transition-colors focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <Star
                          className={`h-6 w-6 transition-colors ${
                            active
                              ? "fill-yellow-400 text-yellow-400"
                              : "text-muted-foreground/40 hover:text-muted-foreground"
                          }`}
                        />
                      </button>
                    );
                  })}
                  <span className="text-xs text-muted-foreground ml-2">
                    {rating ? `${rating} of 5 stars` : "Rate your experience"}
                  </span>
                </div>
              </div>

              {/* Subject */}
              <div className="space-y-2">
                <Label htmlFor="subject" className="text-sm font-semibold">
                  Subject <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="subject"
                  placeholder="e.g., Add support for European ETFs or Dark mode contrast issue"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  maxLength={120}
                  required
                />
              </div>

              {/* Message */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="message" className="text-sm font-semibold">
                    Detailed Message <span className="text-destructive">*</span>
                  </Label>
                  <span className="text-xs text-muted-foreground">
                    {message.length} characters
                  </span>
                </div>
                <Textarea
                  id="message"
                  placeholder="Tell us what happened, what you expected, or how we can make StockPulse better..."
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                />
              </div>

              {/* Diagnostics Toggle */}
              <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground border-t border-border/60">
                <label
                  htmlFor="diagnostics-checkbox"
                  className="flex items-center gap-2 cursor-pointer select-none"
                >
                  <input
                    id="diagnostics-checkbox"
                    type="checkbox"
                    checked={includeDiagnostics}
                    onChange={(e) => setIncludeDiagnostics(e.target.checked)}
                    className="rounded border-input text-primary focus:ring-primary h-3.5 w-3.5"
                  />
                  <span>Include browser and display info to assist troubleshooting</span>
                </label>
              </div>

              {/* Email Client Fallback */}
              {showEmailAppFallback && (
                <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs space-y-3 animate-in fade-in-50 duration-200">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-semibold text-foreground">
                        Need an alternative way to send?
                      </p>
                      <p className="text-muted-foreground leading-relaxed">
                        You can send your feedback directly to <strong className="text-foreground">pulsedigeststock@gmail.com</strong> in one click using your device's email app:
                      </p>
                    </div>
                  </div>
                  <div className="pt-1">
                    <a
                      href={getMailtoUrl()}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground font-medium text-xs shadow hover:bg-primary/90 transition-colors w-full sm:w-auto"
                    >
                      <Mail className="h-3.5 w-3.5" />
                      <span>Open in Email App</span>
                    </a>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 py-2.5"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Sending Feedback...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    <span>{showEmailAppFallback ? "Retry Submit" : "Submit Feedback"}</span>
                  </>
                )}
              </Button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
