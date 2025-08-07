import * as cheerio from "cheerio";

async function fetchProductDetails(productId) {
  try {
    const productUrl = `https://minutes.noon.com/uae-en/now-product/${productId}/`;
    const response = await fetch(productUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "Accept": "application/json",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://minutes.noon.com/",
        "Origin": "https://minutes.noon.com",
      }      
    });

    const data = await response.text();
    const $ = cheerio.load(data);

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
          productInfo.productName = parts[1] ? parts[1].trim() : text;
        } else {
          productInfo.productName = text;
        }
      }
    });

    const priceElement = $('span:contains("AED"), span:contains("\u062f.\u0625"), span')
      .filter((i, el) => $(el).text().trim().match(/^(AED|\u062f\.\u0625)?\s*\d+(\.\d+)?/))
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

    $('[class*="size"], [class*="weight"], [class*="quantity"]').each((i, el) => {
      const text = $(el).text().trim();
      if (text && /g|kg|Punnet/.test(text)) {
        productInfo.size = text;
      }
    });

    $('img[src*="nooncdn.com"]').each((i, el) => {
      const src = $(el).attr("src");
      if (src && !src.includes("svg") && !src.includes("data:")) {
        productInfo.images.push(src);
      }
    });

    $('[class*="origin"], [class*="country"]').each((i, el) => {
      const text = $(el).text().trim();
      if (text && !productInfo.origin) {
        productInfo.origin = text;
      }
    });

    $('[class*="description"], [class*="desc"], p').each((i, el) => {
      const text = $(el).text().trim();
      if (text.length > 50 && !productInfo.description) {
        productInfo.description = text;
      }
    });

    return productInfo;
  } catch (error) {
    console.error(`Error fetching product details for ${productId}:`, error.message);
    return null;
  }
}

async function scrapeAllListingPages() {
  const allProductIds = new Set();
  const totalPages = 5;

  for (let page = 1; page <= totalPages; page++) {
    try {
      const listingUrl = `https://minutes.noon.com/uae-en/search/?f[category]=fruits_vegetables&page=${page}`;
      const response = await fetch(listingUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
          "Accept": "application/json",
          "Accept-Language": "en-US,en;q=0.9",
          "Referer": "https://minutes.noon.com/",
          "Origin": "https://minutes.noon.com",
        },
      });
      const data = await response.text();
      const $ = cheerio.load(data);

      $('a[href*="/now-product/"]').each((_, el) => {
        const href = $(el).attr("href");
        const match = href.match(/\/now-product\/([^\/]+)/);
        if (match) allProductIds.add(match[1]);
      });
    } catch (error) {
      console.error(`Error scraping page ${page}:`, error);
    }
  }

  return Array.from(allProductIds);
}

async function processProductBatch(productIds, batchSize = 10) {
  const results = [];

  for (let i = 0; i < productIds.length; i += batchSize) {
    const batch = productIds.slice(i, i + batchSize);
    const batchPromises = batch.map((id) => fetchProductDetails(id));
    const batchResults = await Promise.allSettled(batchPromises);

    batchResults.forEach((result) => {
      if (result.status === "fulfilled" && result.value) {
        const p = result.value;
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

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page")) || 1;
    const limit = parseInt(searchParams.get("limit")) || 20;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;

    const allProductIds = await scrapeAllListingPages();
    if (allProductIds.length === 0) throw new Error("No product IDs found");

    const paginatedProductIds = allProductIds.slice(startIndex, endIndex);
    const products = await processProductBatch(paginatedProductIds);

    return new Response(JSON.stringify({
      products,
      pagination: {
        page,
        limit,
        totalProducts: allProductIds.length,
        totalPages: Math.ceil(allProductIds.length / limit),
        hasNextPage: endIndex < allProductIds.length,
        hasPrevPage: page > 1,
      },
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error scraping products:", error.message);
    return new Response(JSON.stringify({
      error: "Failed to fetch products",
      details: error.message,
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}