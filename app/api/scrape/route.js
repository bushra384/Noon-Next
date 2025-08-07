import axios from "axios";
import * as cheerio from "cheerio";

const PLACEHOLDER_IMG = "https://placehold.co/220x150?text=No+Image";

// ✅ Fetch product details
async function fetchProductDetails(productId) {
  try {
    const productUrl = `https://minutes.noon.com/uae-en/now-product/${productId}/`;
    const { data } = await axios.get(productUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "text/html,application/xhtml+xml",
      },
      timeout: 8000, // 8s
    });

    const $ = cheerio.load(data);

    const productInfo = {
      productId,
      productUrl,
      productName: "",
      brand: "",
      price: "",
      currency: "",
      size: "",
      origin: "",
      description: "",
      images: [],
    };

    // ✅ Extract product name
    const title = $('h1, .product-title, [data-testid*="title"]').first().text().trim();
    productInfo.productName = title || `Product ${productId}`;

    // ✅ Extract price
    const priceElement = $('span:contains("AED"), span:contains("د.إ")').first();
    if (priceElement.length) {
      const text = priceElement.text().trim();
      const priceMatch = text.match(/[\d.,]+/);
      productInfo.price = priceMatch ? priceMatch[0] : "";
      productInfo.currency = text.includes("AED") ? "AED" : "د.إ";
    }

    // ✅ Extract image
    $('img[src*="nooncdn.com"]').each((i, el) => {
      const src = $(el).attr("src");
      if (src && !src.includes("svg")) {
        productInfo.images.push(src);
      }
    });

    return {
      productUrl: productInfo.productUrl,
      images: productInfo.images.length ? productInfo.images : [PLACEHOLDER_IMG],
      productName: productInfo.productName,
      price: productInfo.price ? `${productInfo.currency} ${productInfo.price}` : "AED 0.00",
      weight: productInfo.size || "",
      country: productInfo.origin || "",
    };
  } catch (error) {
    console.error(`Error fetching product details for ${productId}: ${error.message}`);
    return {
      productUrl: `https://minutes.noon.com/uae-en/now-product/${productId}/`,
      images: [PLACEHOLDER_IMG],
      productName: `Product ${productId}`,
      price: "AED 0.00",
      weight: "",
      country: "",
    };
  }
}

// ✅ Scrape one listing page for product IDs
async function scrapeListingPage(page = 1) {
  try {
    const url = `https://minutes.noon.com/uae-en/search/?f[category]=fruits_vegetables&page=${page}`;
    const { data } = await axios.get(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      timeout: 1000000,
    });
    const $ = cheerio.load(data);
    const ids = [];
    $('a[href*="/now-product/"]').each((i, el) => {
      const href = $(el).attr("href");
      const match = href.match(/\/now-product\/([^\/]+)/);
      if (match) ids.push(match[1]);
    });
    return ids;
  } catch (err) {
    console.error(`Error scraping listing page ${page}: ${err.message}`);
    return [];
  }
}

// ✅ API handler
export async function GET(request) {
  try {
    if (request.method !== "GET") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page")) || 1;
    const limit = parseInt(searchParams.get("limit")) || 20;

    const productIds = await scrapeListingPage(page);
    if (!productIds.length) {
      return new Response(JSON.stringify({ products: [], pagination: {} }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const paginatedIds = productIds.slice(0, limit);
    const results = await Promise.allSettled(paginatedIds.map(id => fetchProductDetails(id)));
    const products = results.filter(r => r.status === "fulfilled").map(r => r.value);

    return new Response(
      JSON.stringify({
        products,
        pagination: {
          page,
          limit,
          totalProducts: productIds.length,
          hasNextPage: limit < productIds.length,
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("API Error:", error.message);
    return new Response(JSON.stringify({ error: "Failed to fetch products" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
