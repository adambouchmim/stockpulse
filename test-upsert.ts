import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://xyuetzzrybnstxtpvfou.supabase.co";
const serviceRoleKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5dWV0enpyeWJuc3R4dHB2Zm91Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODQ0MDA5MSwiZXhwIjoyMDk0MDE2MDkxfQ.VjVr9Z8u9L5Lt6aREfVAmd2zzLq0i4KeBSYAkWS_F8c";
const supabase = createClient(supabaseUrl, serviceRoleKey);
const userId = "7c63e589-d115-43ad-b2db-f7120a237b03";

async function main() {
  const article = {
    user_id: userId,
    section_type: "company",
    ticker_tags: ["BSX"],
    headline: "Test headline 2",
    url: "https://example.com/test2",
    source_name: "Test source",
    published_at: new Date().toISOString(),
    fetched_at: new Date().toISOString(),
  };

  console.log("Testing with onConflict...");
  const { error: err1 } = await supabase.from("digest_articles").upsert(
    article,
    { onConflict: "user_id,url", ignoreDuplicates: false }
  );

  if (err1) {
    console.error("Error with onConflict:", err1);
  } else {
    console.log("Success with onConflict!");
  }
}

main();
