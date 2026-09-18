async function testQuery(query: string) {
  const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&newsCount=3&lang=en-US&region=US`;
  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
  });
  if (response.ok) {
    const data = await response.json();
    const titles = (data.news || []).map((n: any) => n.title);
    console.log(`Query: "${query}" -> returned ${titles.length} articles:`);
    titles.forEach((t: string) => console.log(`  - ${t}`));
  } else {
    console.log(`Query: "${query}" -> error ${response.status}`);
  }
}

async function run() {
  await testQuery("Intesa");
  await testQuery("ASML");
  await testQuery("Adaptive");
  await testQuery("Boeing");
  await testQuery("Chevron");
  await testQuery("Buffett");
}

run();
