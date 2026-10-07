import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface FeedbackPayload {
  category: string;
  subject: string;
  message: string;
  rating?: number | null;
  metadata?: Record<string, unknown>;
}

const CATEGORY_LABELS: Record<string, string> = {
  feature: "Feature Request",
  bug: "Bug Report",
  content: "Data / Content Issue",
  general: "General Feedback",
  other: "Other",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
      Deno.env.get("SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    // Authenticate user via Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await anonClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: FeedbackPayload = await req.json();
    const { category = "general", subject, message, rating, metadata = {} } = body;

    if (!subject?.trim() || !message?.trim()) {
      return new Response(
        JSON.stringify({ error: "Subject and message are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const userEmail = user.email || "unknown@stockpulse.user";
    const categoryLabel = CATEGORY_LABELS[category] || category;

    // 1. Insert into feedback database table
    const adminClient = createClient(
      supabaseUrl,
      serviceRoleKey || anonKey
    );

    const { data: feedbackRecord, error: dbError } = await adminClient
      .from("feedback")
      .insert({
        user_id: user.id,
        user_email: userEmail,
        category,
        subject: subject.trim(),
        message: message.trim(),
        rating: rating || null,
        metadata: {
          ...metadata,
          submitted_at: new Date().toISOString(),
        },
      })
      .select()
      .single();

    if (dbError) {
      console.error("Database insert error:", dbError);
    }

    // 2. Prepare email content
    const targetEmail = "pulsedigeststock@gmail.com";
    const ratingDisplay = rating ? `${"⭐".repeat(rating)} (${rating}/5)` : "Not provided";
    const userAgent = (metadata?.userAgent as string) || "Unknown";
    const currentUrl = (metadata?.currentUrl as string) || "N/A";
    const screenSize = (metadata?.screenSize as string) || "N/A";

    const textContent = `
New StockPulse User Feedback
============================
From: ${userEmail} (User ID: ${user.id})
Category: ${categoryLabel}
Rating: ${ratingDisplay}
Subject: ${subject}
Date: ${new Date().toUTCString()}

Message:
----------------------------------------
${message}
----------------------------------------

Diagnostics:
- URL: ${currentUrl}
- Screen: ${screenSize}
- User Agent: ${userAgent}
    `.trim();

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; }
    .header { background: #0f172a; color: #ffffff; padding: 24px; text-align: left; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 700; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: 600; background: #2563eb; color: #fff; margin-top: 8px; }
    .content { padding: 24px; }
    .meta-box { background: #f1f5f9; border-radius: 8px; padding: 16px; margin-bottom: 20px; font-size: 14px; }
    .meta-row { display: flex; justify-content: space-between; margin-bottom: 6px; }
    .meta-label { font-weight: 600; color: #64748b; }
    .subject-title { font-size: 18px; font-weight: 600; color: #0f172a; margin-bottom: 12px; }
    .message-box { background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 16px; font-size: 15px; line-height: 1.6; white-space: pre-wrap; color: #334155; }
    .footer { padding: 16px 24px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>StockPulse Feedback</h1>
      <span class="badge">${categoryLabel}</span>
    </div>
    <div class="content">
      <div class="meta-box">
        <div><strong>From:</strong> <a href="mailto:${userEmail}">${userEmail}</a></div>
        <div><strong>Rating:</strong> ${ratingDisplay}</div>
        <div><strong>Date:</strong> ${new Date().toUTCString()}</div>
      </div>

      <div class="subject-title">${subject}</div>
      <div class="message-box">${message.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
    </div>
    <div class="footer">
      <div><strong>Diagnostics:</strong></div>
      <div>Path: ${currentUrl} | Viewport: ${screenSize}</div>
      <div>User Agent: ${userAgent}</div>
    </div>
  </div>
</body>
</html>
    `.trim();

    // 3. Send email
    let emailSent = false;
    let emailErrorDetail: string | null = null;

    if (resendApiKey) {
      try {
        const resendRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "StockPulse Feedback <onboarding@resend.dev>",
            to: [targetEmail],
            reply_to: userEmail,
            subject: `[StockPulse Feedback - ${categoryLabel}] ${subject}`,
            text: textContent,
            html: htmlContent,
          }),
        });

        const resendData = await resendRes.json();
        if (resendRes.ok) {
          emailSent = true;
          console.log("Feedback email sent successfully via Resend:", resendData.id);
        } else {
          console.error("Resend API error:", resendData);
          emailErrorDetail = resendData.message || JSON.stringify(resendData);
        }
      } catch (err: unknown) {
        console.error("Failed to send email via Resend:", err);
        emailErrorDetail = err instanceof Error ? err.message : String(err);
      }
    } else {
      console.warn(
        "RESEND_API_KEY is not configured in Supabase secrets. Feedback was saved to the database."
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        feedbackId: feedbackRecord?.id,
        emailSent,
        warning: !resendApiKey
          ? "Feedback stored in database. Configure RESEND_API_KEY in Supabase secrets to enable live email delivery to pulsedigeststock@gmail.com."
          : emailErrorDetail
          ? `Feedback saved, but email dispatch failed: ${emailErrorDetail}`
          : undefined,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: unknown) {
    console.error("Unexpected error in send-feedback:", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Internal Server Error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
