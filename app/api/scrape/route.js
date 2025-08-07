import axios from "axios";
import * as cheerio from "cheerio";

async function fetchProductDetails(productId) {
  try {
    const productUrl = `https://minutes.noon.com/uae-en/now-product/${productId}/`;
    const { data } = await axios.get(productUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate, br",
        Connection: "keep-alive",
        "Upgrade-Insecure-Requests": "1",
      },
      timeout: 10000, // 10 second timeout
    });

    const $ = cheerio.load(data);

    // Extract basic product info
    const productInfo = {
      productId,
      productUrl: productUrl,
      images: [],
      productName: "",
      brand: "",
      price: "",
      currency: "",
      size: "",
      origin: "",
      description: "",
    };

    // Extract product name and brand
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

    // Extract price
    // Use a robust selector for price
    const priceElement = $('span:contains("AED"), span:contains("د.إ"), span')
      .filter((i, el) => {
        return $(el)
          .text()
          .trim()
          .match(/^\s*(AED|د\.إ)?\s*\d+(\.\d+)?/);
      })
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

    // Extract size/quantity
    $('[class*="size"], [class*="weight"], [class*="quantity"]').each(
      (i, el) => {
        const text = $(el).text().trim();
        if (
          text &&
          (text.includes("g") || text.includes("kg") || text.includes("Punnet"))
        ) {
          productInfo.size = text;
        }
      }
    );

    // Extract images (higher quality from product detail page)
    $('img[src*="nooncdn.com"]').each((i, el) => {
      const src = $(el).attr("src");
      if (src && !src.includes("svg") && !src.includes("data:")) {
        productInfo.images.push(src);
      }
    });

    // Extract origin/country
    $('[class*="origin"], [class*="country"]').each((i, el) => {
      const text = $(el).text().trim();
      if (text && !productInfo.origin) {
        productInfo.origin = text;
      }
    });

    // Extract description
    $('[class*="description"], [class*="desc"], p').each((i, el) => {
      const text = $(el).text().trim();
      if (text && text.length > 50 && !productInfo.description) {
        productInfo.description = text;
      }
    });

    return productInfo;
  } catch (error) {
    console.error(
      `Error fetching product details for ${productId}:`,
      error.message
    );
    return null;
  }
}

// Scrape all listing pages to get all product IDs
async function scrapeAllListingPages() {
  const allProductIds = new Set();
  const totalPages = 5; // There are 5 pages of products

  console.log(`Scraping all ${totalPages} listing pages...`);

  for (let page = 1; page <= totalPages; page++) {
    try {
      const listingUrl = `https://minutes.noon.com/uae-en/search/?f[category]=fruits_vegetables&page=${page}`;
      console.log(`Scraping listing page ${page}...`);

      // const { data } = await axios.get(listingUrl, {
      //   headers: {
      //     "User-Agent": "Mozilla/5.0",
      //     Accept:
      //       "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      //     "Accept-Language": "en-US,en;q=0.5",
      //     "Accept-Encoding": "gzip, deflate, br",
      //     Connection: "keep-alive",
      //     "Upgrade-Insecure-Requests": "1",
      //   },
      //   timeout: 15000,
      // });

      const response = await fetch(listingUrl);
      const data = await response.text();

      const $ = cheerio.load(data);

      // Extract product IDs from this page
      let pageProductCount = 0;
      $('a[href*="/now-product/"]').each((i, el) => {
        const href = $(el).attr("href");
        if (href) {
          const match = href.match(/\/now-product\/([^\/]+)/);
          if (match) {
            allProductIds.add(match[1]);
            pageProductCount++;
          }
        }
      });

      console.log(`Page ${page}: Found ${pageProductCount} product IDs`);

      // Small delay between pages to be respectful
      if (page < totalPages) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    } catch (error) {
      console.error(`Error scraping page ${page}:`, error.message);
      // Continue with next page even if one fails
    }
  }

  console.log(
    `Total unique product IDs found across all pages: ${allProductIds.size}`
  );
  return Array.from(allProductIds);
}

// Process products in batches with parallel requests
async function processProductBatch(productIds, batchSize = 10) {
  const results = [];

  for (let i = 0; i < productIds.length; i += batchSize) {
    const batch = productIds.slice(i, i + batchSize);
    console.log(
      `Processing batch ${Math.floor(i / batchSize) + 1}: ${
        batch.length
      } products`
    );

    // Process batch in parallel
    const batchPromises = batch.map(async (productId) => {
      try {
        const result = await fetchProductDetails(productId);
        return result;
      } catch (error) {
        console.error(`Failed to fetch ${productId}:`, error.message);
        return null;
      }
    });

    // Wait for all requests in batch to complete
    const batchResults = await Promise.allSettled(batchPromises);

    // Extract successful results
    batchResults.forEach((result, index) => {
      if (result.status === "fulfilled" && result.value) {
        const productDetails = result.value;
        console.log(">>>> Debug product scraped:", {
          productId: productDetails.productId,
          productName: productDetails.productName,
          price: productDetails.price,
          currency: productDetails.currency,
        });
        results.push({
          productUrl: productDetails.productUrl,
          images: productDetails.images,
          productName:
            productDetails.productName || productDetails.brand || "Product",
          price: productDetails.price
            ? `${productDetails.currency || ""} ${productDetails.price}`
            : "฿ 10.65",
          weight: productDetails.size || "",
          country: productDetails.origin || "",
          countryFlag: "", // Will be empty for now
        });
      }
    });

    // Small delay between batches to be respectful
    if (i + batchSize < productIds.length) {
      await new Promise((resolve) => setTimeout(resolve, 100)); // Reduced delay
    }
  }

  return results;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page")) || 1;
    const limit = parseInt(searchParams.get("limit")) || 50; // Default 50 per page
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;

    // Scrape all listing pages to get all product IDs
    const allProductIds = await scrapeAllListingPages();

    if (allProductIds.length === 0) {
      throw new Error("No product IDs found on any listing page");
    }

    console.log(`Total products available: ${allProductIds.length}`);

    // Apply pagination to all products
    const totalProducts = allProductIds.length;
    const paginatedProductIds = allProductIds.slice(startIndex, endIndex);

    console.log(
      `Processing products ${startIndex + 1} to ${Math.min(
        endIndex,
        totalProducts
      )} of ${totalProducts}`
    );

    // Process products in parallel batches
    const products = await processProductBatch(paginatedProductIds, 10); // Process 10 at a time

    console.log(
      `Successfully fetched ${products.length} products for page ${page}`
    );

    return new Response(
      JSON.stringify({
        products,
        pagination: {
          page,
          limit,
          totalProducts,
          totalPages: Math.ceil(totalProducts / limit),
          hasNextPage: endIndex < totalProducts,
          hasPrevPage: page > 1,
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error scraping products:", error.message);
    return new Response(
      JSON.stringify({
        error: "Failed to fetch products",
        details: error.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}