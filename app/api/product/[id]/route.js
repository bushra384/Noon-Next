// app/api/product-details/[id]/route.js
import * as cheerio from 'cheerio';

const API_KEY = "K6EQ1YS3N0UTBMNE0BD93DO6JULUSAX9PWHYAXFW19DRJTH6HNXVQZ0OWLREW2D0GYQB10T8MPPYGL0Y";

export async function GET(request, { params }) {
  const { id } = params;

  try {
    const productUrl = `https://minutes.noon.com/uae-en/now-product/${id}/`;
    console.log(`Scraping product details from: ${productUrl}`);

    // Use ScrapingBee API
    const scrapingBeeUrl = `https://app.scrapingbee.com/api/v1/?api_key=${API_KEY}&url=${encodeURIComponent(productUrl)}&render_js=false&block_resources=true`;
    const response = await fetch(scrapingBeeUrl);
    if (!response.ok) throw new Error(`ScrapingBee failed: ${response.status}`);

    const data = await response.text();
    const $ = cheerio.load(data);

    const productDetails = {
      brand: '',
      productName: '',
      size: '',
      price: '',
      currency: '',
      deliveryTime: '',
      combosAvailable: false,
      comboText: '',
      description: '',
      features: [],
      images: [],
      origin: '',
      sku: id
    };

    // Title
    $('h1, .product-title, [data-testid*="title"]').each((i, el) => {
      const text = $(el).text().trim();
      if (text && !productDetails.productName) {
        if (text.includes("'s")) {
          const parts = text.split("'s");
          productDetails.brand = parts[0].trim();
          productDetails.productName = parts[1]?.trim() || text;
        } else {
          productDetails.productName = text;
        }
      }
    });

    // Price
    $('[class*="price"], .price, [data-testid*="price"]').each((i, el) => {
      const text = $(el).text().trim();
      if (text && text.match(/[\d.,]+/)) {
        const priceMatch = text.match(/[\d.,]+/);
        if (priceMatch) {
          productDetails.price = priceMatch[0];
          const currencyMatch = text.match(/[^\d.,\s]+/);
          if (currencyMatch) {
            productDetails.currency = currencyMatch[0];
          }
        }
      }
    });

    // Size
    $('[class*="size"], [class*="weight"], [class*="quantity"]').each((i, el) => {
      const text = $(el).text().trim();
      if (text && (text.includes('g') || text.includes('kg') || text.includes('Punnet'))) {
        productDetails.size = text;
      }
    });

    // Delivery
    $('[class*="delivery"], [class*="arrives"]').each((i, el) => {
      const text = $(el).text().trim();
      if (text.includes('mins')) {
        const timeMatch = text.match(/(\d+)\s*mins/);
        if (timeMatch) productDetails.deliveryTime = `${timeMatch[1]} mins`;
      }
    });

    // Combo info
    $('[class*="combo"], [class*="promotion"]').each((i, el) => {
      const text = $(el).text().trim();
      if (text.toLowerCase().includes('combo')) {
        productDetails.combosAvailable = true;
        productDetails.comboText = text;
      }
    });

    // Description + Features (multi-approach)
    let desc = null;
    let features = [];

    // 1. Horilla-style container
    const mainDescDiv = $('body > div.layout_pageWrapper__W_ZgS > div:nth-child(2) > div:nth-child(4)');
    if (mainDescDiv.length) {
      desc = mainDescDiv.text().trim();
      const ul = mainDescDiv.find('ul');
      if (ul.length) {
        features = ul.find('li').map((_, li) => $(li).text().trim()).get();
      }
    }

    // 2. Alternative styled div
    if (!desc || features.length === 0) {
      $("div[style*='margin-top: 20px'][style*='color: rgb(126, 133, 155)']").each((_, div) => {
        const p = $(div).find('p').first();
        desc = p.length ? p.text().trim() : $(div).text().trim();
        const localFeatures = $(div).find('li').map((_, li) => $(li).text().trim()).get();
        if (localFeatures.length) features = localFeatures;
        if (desc) return false; // break
      });
    }

    // 3. Heuristic fallback
    if (!desc) {
      $('div').each((_, div) => {
        const t = $(div).text().trim();
        if (t.length > 30 && t.toLowerCase().includes('fruit')) {
          desc = t;
          return false;
        }
      });
    }

    // 4. Last feature fallback
    if (features.length === 0) {
      const ul = $('ul').first();
      if (ul.length) {
        features = ul.find('li').map((_, li) => $(li).text().trim()).get();
      }
    }

    productDetails.description = desc || '';
    productDetails.features = features;

    // Images
    $('img[src*="nooncdn.com"]').each((i, el) => {
      const src = $(el).attr('src');
      if (src && !src.includes('svg')) {
        productDetails.images.push(src);
      }
    });

    // Origin
    $('[class*="origin"], [class*="country"]').each((i, el) => {
      const text = $(el).text().trim();
      if (text && !productDetails.origin) {
        productDetails.origin = text;
      }
    });

    // Fallback origin from description
    if (!productDetails.origin && productDetails.description) {
      const originMatch = productDetails.description.match(/from\s+([A-Za-z]+)/);
      if (originMatch) {
        productDetails.origin = originMatch[1];
      }
    }

    console.log('Extracted product details:', productDetails);

    return new Response(JSON.stringify(productDetails), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error scraping product details:', error.message);
    return new Response(JSON.stringify({
      error: 'Failed to fetch product details',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
