// app/api/products/route.js
import * as cheerio from "cheerio";

// Add headers to avoid being blocked
const fetchWithHeaders = async (url) => {
  return await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
    },
  });
};

async function fetchProductDetails(productId) {
  try {
    const productUrl = `https://minutes.noon.com/uae-en/now-product/${productId}/`;
    const response = await fetchWithHeaders(productUrl);
    const html = await response.text();
    const $ = cheerio.load(html);

    const productInfo = {
      productId,
      productUrl,
      images: [],
      productName: "",
      brand: "",
      price: "",
      currency: "",
      size: "",
      origin: "",
      description: "",
    };

    $('h1, .product-title, [data-testid*="title"]').each((i, el) => {
      const text = $(el).text().trim();
      if (text && !productInfo.productName) {
        if (text.includes("'s")) {
          const parts = text.split("'s");
          productInfo.brand = parts[0].trim();
          productInfo.productName = parts[1]?.trim() || text;
        } else {
          productInfo.productName = text;
        }
      }
    });

    const priceElement = $('span:contains("AED"), span:contains("\u062f.\u0625"), span')
      .filter((_, el) => $(el).text().trim().match(/^(AED|\u062f\.\u0625)?\s*\d+(\.\d+)?/))
      .first();

    if (priceElement.length) {
      const text = priceElement.text().trim();
      const priceMatch = text.match(/[\d.,]+/);
      if (priceMatch) {
        productInfo.price = priceMatch[0];
        const currencyMatch = text.match(/[^\d.,\s]+/);
        if (currencyMatch) {
          productInfo.currency = currencyMatch[0];
        }
      }
    }

    $('[class*="size"], [class*="weight"], [class*="quantity"]').each((_, el) => {
      const text = $(el).text().trim();
      if (text && /g|kg|Punnet/.test(text)) {
        productInfo.size = text;
      }
    });

    $('img[src*="nooncdn.com"]').each((_, el) => {
      const src = $(el).attr("src");
      if (src && !src.includes("svg") && !src.includes("data:")) {
        productInfo.images.push(src);
      }
    });

    $('[class*="origin"], [class*="country"]').each((_, el) => {
      const text = $(el).text().trim();
      if (text && !productInfo.origin) {
        productInfo.origin = text;
      }
    });

    $('[class*="description"], [class*="desc"], p').each((_, el) => {
      const text = $(el).text().trim();
      if (text.length > 50 && !productInfo.description) {
        productInfo.description = text;
      }
    });

    return productInfo;
  } catch (err) {
    console.error("fetchProductDetails error:", err.message);
    return null;
  }
}

async function scrapeOneListingPage(page = 1) {
  const url = `https://minutes.noon.com/uae-en/search/?f[category]=fruits_vegetables&page=${page}`;
  const response = await fetchWithHeaders(url);
  const html = await response.text();
  const $ = cheerio.load(html);

  const productIds = new Set();

  $('a[href*="/now-product/"]').each((_, el) => {
    const href = $(el).attr("href");
    const match = href?.match(/\/now-product\/([^\/]+)/);
    if (match) productIds.add(match[1]);
  });

  return Array.from(productIds);
}

async function processProductBatch(productIds, batchSize = 5) {
  const results = [];

  for (let i = 0; i < productIds.length; i += batchSize) {
    const batch = productIds.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(batch.map(fetchProductDetails));

    batchResults.forEach((res) => {
      if (res.status === "fulfilled" && res.value) {
        const p = res.value;
        results.push({
          productUrl: p.productUrl,
          images: p.images,
          productName: p.productName || p.brand || "Product",
          price: p.price ? `${p.currency || "AED"} ${p.price}` : "AED 0.00",
          weight: p.size || "",
          country: p.origin || "",
          countryFlag: "",
        });
      }
    });
  }

  return results;
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");

    const allIds = await scrapeOneListingPage(page);
    const paginatedIds = allIds.slice(0, limit);
    const products = await processProductBatch(paginatedIds, 5);

    return new Response(
      JSON.stringify({
        products,
        pagination: {
          page,
          limit,
          totalFound: allIds.length,
          totalPages: Math.ceil(allIds.length / limit),
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
