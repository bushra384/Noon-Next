// app/api/search/route.js

import * as cheerio from "cheerio";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");

  const listingUrl = `https://minutes.noon.com/uae-en/search/?f[category]=fruits_vegetables&page=${page}`;
  try {
    const response = await fetch(listingUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "text/html",
      },
      cache: "no-store", // ensures fresh content
    });

    if (!response.ok) {
      return Response.json({ error: `Failed to fetch listing page: ${response.status}` }, { status: 500 });
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const productLinks = $("a[href*='/uae-en/now-product/']")
      .map((_, el) => {
        const href = $(el).attr("href");
        const match = href.match(/now-product\/(\d+)\//);
        return match ? match[1] : null;
      })
      .get()
      .filter(Boolean);

    const uniqueProductIds = [...new Set(productLinks)];
    const limitedProductIds = uniqueProductIds.slice(0, limit);

    const products = await processProductBatch(limitedProductIds);

    return Response.json({ products });
  } catch (err) {
    return Response.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

// 🧠 Process product IDs in a batch with delays
async function processProductBatch(productIds, batchSize = 5, delayMs = 500) {
  const results = [];
  for (let i = 0; i < productIds.length; i += batchSize) {
    const batch = productIds.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((productId) =>
        fetchProductDetails(productId).catch((e) => {
          console.error("Error fetching product:", e.message);
          return null;
        })
      )
    );
    results.push(...batchResults.filter(Boolean));
    if (i + batchSize < productIds.length) await delay(delayMs);
  }
  return results;
}

// 🧠 Fetch individual product detail page
async function fetchProductDetails(productId) {
  const productUrl = `https://minutes.noon.com/uae-en/now-product/${productId}/`;

  const response = await fetch(productUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      Accept: "text/html",
    },
    cache: "no-store",
  });

  if (!response.ok) throw new Error(`Failed to fetch product page: ${productUrl}`);

  const html = await response.text();
  const $ = cheerio.load(html);

  const title = $("h1.pd-title").text().trim();
  const price = $("div.priceNow").text().trim();
  const description = $("div.description-content").text().trim();

  const imageUrl =
    $("img.pd-main-img").attr("src") ||
    $("img.pd-main-img").attr("data-src") ||
    "https://placehold.co/220x150?text=No+Image";

  return {
    id: productId,
    title,
    price,
    description,
    image: imageUrl.startsWith("http") ? imageUrl : `https://minutes.noon.com${imageUrl}`,
    url: productUrl,
  };
}

// 💤 Delay utility
function delay(ms) {
  return new Promise((res) => setTimeout(res, ms));
}
