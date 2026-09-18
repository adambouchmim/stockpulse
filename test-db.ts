import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://xyuetzzrybnstxtpvfou.supabase.co";
const serviceRoleKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5dWV0enpyeWJuc3R4dHB2Zm91Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODQ0MDA5MSwiZXhwIjoyMDk0MDE2MDkxfQ.VjVr9Z8u9L5Lt6aREfVAmd2zzLq0i4KeBSYAkWS_F8c";
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkArticles() {
  const { data, error } = await supabase
    .from("digest_articles")
    .select("id, section_type, ticker_tags, headline, url")
    .neq("section_type", "company");
  
  if (error) {
    console.error(error);
    return;
  }

  console.log("Non-company articles:", data);
}

checkArticles();
