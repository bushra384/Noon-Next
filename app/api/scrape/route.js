import * as cheerio from "cheerio";

async function fetchProductDetails(productId) {
  try {
    const productUrl = `https://minutes.noon.com/uae-en/now-product/${productId}/`;
    // It's a good practice to use a custom User-Agent 
    const response = await fetch(productUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36',
      },
    });

    if (!response.ok) {
      console.error(`Error fetching product details for ${productId}: ${response.statusText}`);
      return null;
    }

    const data = await response.text();
    const $ = cheerio.load(data);

    // ... (rest of your scraping logic for a single product) 
  } catch (error) {
    console.error(`Error in fetchProductDetails for ${productId}:`, error.message);
    return null;
  }
}

async function scrapeAllListingPages() {
  const allProductIds = new Set();
  const totalPages = 5;

  for (let page = 1; page <= totalPages; page++) {
    try {
      const listingUrl = `https://minutes.noon.com/uae-en/search/?f[category]=fruits_vegetables&page=${page}`;
      const response = await fetch(listingUrl);
      console.log(">>>> Debug response:", response);
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