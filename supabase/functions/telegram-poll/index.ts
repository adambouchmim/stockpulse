import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");

  if (!botToken) {
    return new Response(JSON.stringify({ error: "No bot token" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    // Get current offset
    const { data: state, error: stateErr } = await supabase
      .from("telegram_bot_state")
      .select("update_offset")
      .eq("id", 1)
      .single();

    if (stateErr) throw new Error(`State read failed: ${stateErr.message}`);

    const offset = state.update_offset;

    // Poll for updates (short poll, no long timeout since cron runs every minute)
    const res = await fetch(
      `https://api.telegram.org/bot${botToken}/getUpdates`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offset,
          timeout: 0,
          allowed_updates: ["message"],
        }),
      }
    );

    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(`Telegram API error: ${JSON.stringify(data)}`);
    }

    const updates = data.result ?? [];
    if (updates.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let processed = 0;

    for (const update of updates) {
      const message = update.message;
      if (!message?.text) continue;

      const chatId = String(message.chat.id);
      const text = message.text.trim().toLowerCase();

      if (text === "/refresh" || text === "/update") {
        await handleRefreshCommand(supabase, botToken, chatId);
        processed++;
      } else if (text === "/start") {
        await sendTelegram(
          botToken,
          chatId,
          "👋 Welcome to StockPulse!\n\nCommands:\n/refresh — Refresh your news digest\n/status — Check your digest status"
        );
        processed++;
      } else if (text === "/status") {
        await handleStatusCommand(supabase, botToken, chatId);
        processed++;
      }
    }

    // Update offset
    const newOffset =
      Math.max(...updates.map((u: any) => u.update_id)) + 1;
    await supabase
      .from("telegram_bot_state")
      .update({ update_offset: newOffset, updated_at: new Date().toISOString() })
      .eq("id", 1);

    console.log(`Processed ${processed} commands from ${updates.length} updates`);

    return new Response(
      JSON.stringify({ ok: true, processed, updates: updates.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("telegram-poll error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function handleRefreshCommand(
  supabase: any,
  botToken: string,
  chatId: string
) {
  // Find user by chat_id
  const { data: settings } = await supabase
    .from("user_settings")
    .select("user_id")
    .eq("telegram_chat_id", chatId)
    .single();

  if (!settings) {
    await sendTelegram(
      botToken,
      chatId,
      "❌ Your Telegram is not linked to a StockPulse account.\n\nGo to Settings in the app and add your Chat ID."
    );
    return;
  }

  await sendTelegram(botToken, chatId, "🔄 Refreshing your digest...");

  // Fetch news for this user using the edge function internally
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const fetchRes = await fetch(
    `${Deno.env.get("SUPABASE_URL")}/functions/v1/fetch-news`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${anonKey}`,
        "x-trigger-user-id": settings.user_id,
      },
    }
  );

  if (fetchRes.ok) {
    // fetch-news will send the formatted digest message directly to the user's Telegram chat.
    // No additional message needed here.
  } else {
    await sendTelegram(botToken, chatId, "⚠️ Refresh failed. Please try again later.");
  }
}

async function handleStatusCommand(
  supabase: any,
  botToken: string,
  chatId: string
) {
  const { data: settings } = await supabase
    .from("user_settings")
    .select("user_id")
    .eq("telegram_chat_id", chatId)
    .single();

  if (!settings) {
    await sendTelegram(botToken, chatId, "❌ Account not linked.");
    return;
  }

  const { data: articles } = await supabase
    .from("digest_articles")
    .select("fetched_at")
    .eq("user_id", settings.user_id)
    .order("fetched_at", { ascending: false })
    .limit(1);

  const { count } = await supabase
    .from("watchlist")
    .select("*", { count: "exact", head: true })
    .eq("user_id", settings.user_id);

  const lastFetched = articles?.[0]?.fetched_at
    ? new Date(articles[0].fetched_at).toUTCString()
    : "Never";

  await sendTelegram(
    botToken,
    chatId,
    `📊 StockPulse Status\n\n🔖 Watchlist: ${count || 0} tickers\n🕐 Last refresh: ${lastFetched}`
  );
}

async function sendTelegram(botToken: string, chatId: string, text: string) {
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    }),
  });
}
