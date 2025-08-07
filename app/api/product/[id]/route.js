import axios from 'axios';
import * as cheerio from 'cheerio';

export async function GET(request, { params }) {
  const { id } = params;
  
  try {
    // Construct the product URL
    const productUrl = `https://minutes.noon.com/uae-en/now-product/${id}/`;
    
    console.log(`Scraping product details from: ${productUrl}`);
    
    const { data } = await axios.get(productUrl, {
      headers: { 
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      }
    });

    const $ = cheerio.load(data);
    
    // Extract product details
    const productDetails = {
      // Basic product info
      brand: '',
      productName: '',
      size: '',
      price: '',
      currency: '',
      
      // Delivery info
      deliveryTime: '',
      
      // Promotional info
      combosAvailable: false,
      comboText: '',
      
      // Description and features
      description: '',
      features: [],
      
      // Images
      images: [],
      
      // Additional info
      origin: '',
      sku: id
    };

    // Extract brand and product name
    $('h1, .product-title, [data-testid*="title"]').each((i, el) => {
      const text = $(el).text().trim();
      if (text && !productDetails.productName) {
        // Try to separate brand and product name
        if (text.includes("'s")) {
          const parts = text.split("'s");
          productDetails.brand = parts[0].trim();
          productDetails.productName = parts[1] ? parts[1].trim() : text;
        } else {
          productDetails.productName = text;
        }
      }
    });

    // Extract price
    $('[class*="price"], .price, [data-testid*="price"]').each((i, el) => {
      const text = $(el).text().trim();
      if (text && text.match(/[\d.,]+/)) {
        const priceMatch = text.match(/[\d.,]+/);
        if (priceMatch) {
          productDetails.price = priceMatch[0];
          // Extract currency symbol
          const currencyMatch = text.match(/[^\d.,\s]+/);
          if (currencyMatch) {
            productDetails.currency = currencyMatch[0];
          }
        }
      }
    });

    // Extract size/quantity
    $('[class*="size"], [class*="weight"], [class*="quantity"]').each((i, el) => {
      const text = $(el).text().trim();
      if (text && (text.includes('g') || text.includes('kg') || text.includes('Punnet'))) {
        productDetails.size = text;
      }
    });

    // Extract delivery time
    $('[class*="delivery"], [class*="arrives"]').each((i, el) => {
      const text = $(el).text().trim();
      if (text && text.includes('mins')) {
        const timeMatch = text.match(/(\d+)\s*mins/);
        if (timeMatch) {
          productDetails.deliveryTime = `${timeMatch[1]} mins`;
        }
      }
    });

    // Extract combo information
    $('[class*="combo"], [class*="promotion"]').each((i, el) => {
      const text = $(el).text().trim();
      if (text && text.toLowerCase().includes('combo')) {
        productDetails.combosAvailable = true;
        productDetails.comboText = text;
      }
    });

    // Extract description and features using improved logic
    let desc = null;
    let features = [];

    // 1. Try with original selector (Horilla-like structure)
    const mainDescDiv = $('body > div.layout_pageWrapper__W_ZgS > div:nth-child(2) > div:nth-child(4)');
    if (mainDescDiv.length) {
      desc = mainDescDiv.text().trim();
      const ul = mainDescDiv.find('ul');
      if (ul.length) {
        features = ul.find('li').map((i, li) => $(li).text().trim()).get();
      }
    }

    // 2. Fallback to older style (description and features in styled div)
    if (!desc || features.length === 0) {
      $("div[style*='margin-top: 20px'][style*='color: rgb(126, 133, 155)']").each((i, div) => {
        const p = $(div).find('p').first();
        if (p.length) desc = p.text().trim();
        else desc = $(div).text().trim();

        // Append any <li> inside this block
        const localFeatures = $(div).find('li').map((i, li) => $(li).text().trim()).get();
        if (localFeatures.length) features = localFeatures;

        if (desc) return false; // Break loop
      });
    }

    // 3. Last resort: heuristic description
    if (!desc) {
      $('div').each((i, div) => {
        const t = $(div).text().trim();
        if (t && t.length > 30 && t.toLowerCase().includes('fruit')) {
          desc = t;
          return false;
        }
      });
    }

    // 4. Final fallback for features: find first <ul> in body
    if (features.length === 0) {
      const ul = $('ul').first();
      if (ul.length) {
        features = ul.find('li').map((i, li) => $(li).text().trim()).get();
      }
    }

    // Update product details with extracted description and features
    productDetails.description = desc || '';
    productDetails.features = features;

    // Extract images
    $('img[src*="nooncdn.com"]').each((i, el) => {
      const src = $(el).attr('src');
      if (src && !src.includes('svg')) {
        productDetails.images.push(src);
      }
    });

    // Extract origin/country
    $('[class*="origin"], [class*="country"]').each((i, el) => {
      const text = $(el).text().trim();
      if (text && !productDetails.origin) {
        productDetails.origin = text;
      }
    });

    // If no specific origin found, try to extract from description
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