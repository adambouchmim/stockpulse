import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Globe, Bell, Save, Send, Check, HelpCircle } from "lucide-react";

const AVAILABLE_LANGUAGES = [
  { code: "en-US", label: "English (US)" },
  { code: "en-GB", label: "English (UK)" },
  { code: "it-IT", label: "Italian" },
  { code: "nl-NL", label: "Dutch" },
  { code: "de-DE", label: "German" },
  { code: "fr-FR", label: "French" },
  { code: "es-ES", label: "Spanish" },
];

export default function SettingsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(["en-US"]);
  const [telegramChatId, setTelegramChatId] = useState("");
  const [emailDigest, setEmailDigest] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testingSend, setTestingSend] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fetchSettings = async () => {
      const { data } = await supabase
        .from("user_settings")
        .select("*")
        .eq("user_id", user.id)
        .single();
      if (data) {
        if (data.article_languages && Array.isArray(data.article_languages) && data.article_languages.length > 0) {
          setSelectedLanguages(data.article_languages);
        }
        setTelegramChatId((data as any).telegram_chat_id || "");
        setEmailDigest(data.email_digest_enabled || false);
      }
    };
    fetchSettings();
  }, [user]);

  const toggleLanguage = (code: string) => {
    if (selectedLanguages.includes(code)) {
      if (selectedLanguages.length === 1) {
        toast({
          title: "Minimum language required",
          description: "You must keep at least 1 language selected.",
          variant: "destructive",
        });
        return;
      }
      setSelectedLanguages(selectedLanguages.filter((l) => l !== code));
    } else {
      if (selectedLanguages.length >= 5) {
        toast({
          title: "Limit reached",
          description: "You can select up to 5 languages maximum.",
          variant: "destructive",
        });
        return;
      }
      setSelectedLanguages([...selectedLanguages, code]);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("user_settings")
      .upsert({
        user_id: user.id,
        article_languages: selectedLanguages,
        telegram_chat_id: telegramChatId,
        email_digest_enabled: emailDigest,
      } as any);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Settings saved", description: "Your preferences have been updated." });
    }
    setSaving(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-xl mx-auto px-4 py-12">
        <Button variant="ghost" onClick={() => navigate("/")} className="mb-8">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Digest
        </Button>

        <h1 className="font-display text-2xl font-bold mb-8">Settings</h1>

        <div className="space-y-8">
          {/* Article Languages */}
          <div className="bg-card border border-border rounded-lg p-6 space-y-4">
            <div className="flex items-center gap-2 text-primary">
              <Globe className="h-4 w-4" />
              <h2 className="font-display font-semibold">Article Languages</h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Select up to 5 preferred languages for fetching news articles ({selectedLanguages.length}/5 selected).
            </p>
            <div className="grid grid-cols-2 gap-2 pt-2">
              {AVAILABLE_LANGUAGES.map((lang) => {
                const isSelected = selectedLanguages.includes(lang.code);
                return (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => toggleLanguage(lang.code)}
                    className={`flex items-center justify-between px-3 py-2 rounded-md text-sm border font-mono transition-colors text-left ${
                      isSelected
                        ? "bg-primary/10 border-primary text-primary"
                        : "bg-secondary border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground"
                    }`}
                  >
                    <span>{lang.label}</span>
                    {isSelected && <Check className="h-4 w-4 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Telegram */}
          <div className="bg-card border border-border rounded-lg p-6 space-y-4">
            <div className="flex items-center gap-2 text-primary">
              <Send className="h-4 w-4" />
              <h2 className="font-display font-semibold">Telegram Notifications</h2>
            </div>
            <div className="space-y-2">
              <label htmlFor="telegram" className="text-sm text-muted-foreground">
                Telegram Chat ID
              </label>
              <input
                id="telegram"
                value={telegramChatId}
                onChange={(e) => setTelegramChatId(e.target.value)}
                placeholder="e.g. 123456789"
                className="w-full px-3 py-2 bg-secondary border border-border rounded-md font-mono text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <p className="text-xs text-muted-foreground">
                Message{" "}
                <a
                  href="https://t.me/userinfobot"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  @userinfobot
                </a>
                {" "}on Telegram to get your Chat ID. Then start a conversation with{" "}
                <a
                  href="https://t.me/StockPulsePush_bot"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  @StockPulsePush_bot
                </a>
                .
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={!telegramChatId || testingSend}
              onClick={async () => {
                setTestingSend(true);
                try {
                  const { error } = await supabase.functions.invoke("send-telegram");
                  if (error) {
                    toast({ title: "Error", description: "Failed to send test notification.", variant: "destructive" });
                  } else {
                    toast({ title: "Sent!", description: "Check your Telegram for the digest." });
                  }
                } catch {
                  toast({ title: "Error", description: "Something went wrong.", variant: "destructive" });
                }
                setTestingSend(false);
              }}
            >
              <Send className="h-3.5 w-3.5 mr-1.5" />
              {testingSend ? "Sending..." : "Send Test Notification"}
            </Button>
          </div>

          {/* Notifications */}
          <div className="bg-card border border-border rounded-lg p-6 space-y-4">
            <div className="flex items-center gap-2 text-primary">
              <Bell className="h-4 w-4" />
              <h2 className="font-display font-semibold">Notifications</h2>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm">Weekly email digest</p>
                <p className="text-xs text-muted-foreground">
                  Receive a summary every Monday morning
                </p>
              </div>
              <Switch
                checked={emailDigest}
                onCheckedChange={setEmailDigest}
              />
            </div>
          </div>
          {/* Tutorial & Guide */}
          <div className="bg-card border border-border rounded-lg p-6 space-y-4">
            <div className="flex items-center gap-2 text-primary">
              <HelpCircle className="h-4 w-4" />
              <h2 className="font-display font-semibold">App Tour & Guide</h2>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm">Replay Tutorial</p>
                <p className="text-xs text-muted-foreground">
                  View the interactive onboarding tour again
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => {
                sessionStorage.setItem("stockpulse_force_tutorial", "true");
                navigate("/");
              }}>
                Start Tour
              </Button>
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full">
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </div>
    </div>
  );
}
