"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

// Keyword extraction function
function extractProductKeywords(productName, description, topN = 10) {
  const priorityWords = new Set([
    "fresh",
    "freshness",
    "convenience",
    "organic",
    "healthy",
    "fiber",
    "vitamin",
    "low",
    "fat",
    "cholesterol",
    "potassium",
    "natural",
    "premium",
  ]);
  const nameWords = productName
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2);
  const stopwords = new Set([
    "a",
    "an",
    "the",
    "and",
    "or",
    "but",
    "of",
    "for",
    "to",
    "in",
    "on",
    "at",
    "with",
    "this",
    "that",
    "it",
    "its",
    "as",
    "by",
    "from",
    "was",
    "are",
    "be",
    "been",
    "their",
    "they",
    "you",
    "your",
    "day",
    "offers",
    "making",
    "perfect",
    "choice",
    "way",
    "stay",
    "ready",
    "light",
    "ideal",
  ]);
  const words = description
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopwords.has(w));
  const freqMap = {};
  words.forEach((word, idx) => {
    let weight = 1;
    if (nameWords.includes(word)) weight += 3;
    if (priorityWords.has(word)) weight += 2;
    if (idx < 15) weight += 1;
    freqMap[word] = (freqMap[word] || 0) + weight;
  });
  const sorted = Object.entries(freqMap).sort((a, b) => b[1] - a[1]);
  const topWords = sorted.slice(0, topN).map(([word]) => word);
  const phrases = [];
  if (topWords.includes("potatoes") && topWords.includes("roasting")) {
    phrases.push("roasting potatoes");
  }
  if (topWords.includes("miss") && topWords.includes("blush")) {
    phrases.push("Miss Blush Potatoes");
  }
  return [...new Set([...topWords, ...phrases])];
}

export default function ProductDetail() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchProductDetail = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/product/${id}`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        if (data.error) {
          throw new Error(data.error);
        }

        setProduct(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchProductDetail();
    }
  }, [id]);

  if (loading) {
    return (
      <div className="loader-wrapper">
        <div className="loader-spinner" />
        <style jsx>{`
          .loader-wrapper {
            height: 80vh;
            display: flex;
            justify-content: center;
            align-items: center;
          }
  
          .loader-spinner {
            width: 50px;
            height: 50px;
            border: 6px solid #e5e7eb;
            border-top-color: #6366f1;
            border-radius: 50%;
            animation: spin 1s linear infinite;
          }
  
          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </div>
    );
  }
  if (error) {
    return (
      <div className="no-results">
        <p>😕 {error}</p>
      </div>
    );
  }
  if (!product) {
    return (
      <div className="no-results">
        <p>Product not found.</p>
      </div>
    );
  }

  // Layout fields
  const name = product.name || product.title || product.origin || "";
  const size = product.size || product.weight || product.unit || "";
  const price =
    product.original_price && product.original_price !== ""
      ? product.original_price
      : product.price || "";
  const description =
    product.description || product.details || product.desc || "";
  const features =
    product.features || product.specs || product.attributes || [];

  // Generate keywords from product name and description
  const topKeywords = extractProductKeywords(name, description, 10);

  return (
    <div className="product-detail-page">
      <div className="header">
        <button onClick={() => window.history.back()} className="back-button">
          ← Back
        </button>
      </div>

      <div className="product-container">
        <div className="product-images">
          {product.images && product.images.length > 0 ? (
            <img
              src={product.images[0]}
              alt={product.productName || "Product"}
              className="main-image"
            />
          ) : (
            <div className="image-placeholder">
              <span>🥬</span>
            </div>
          )}
        </div>

        <div className="product-info">
          <div className="brand-section">
            {product.brand && <span className="brand">{product.brand}</span>}
            <h1 className="product-title">
              {product.productName || "Product"}
            </h1>
          </div>

          <div className="product-meta">
            {product.size && (
              <div className="meta-item">
                <span className="label">Size:</span>
                <span className="value">{product.size}</span>
              </div>
            )}

            {product.origin && (
              <div className="meta-item">
                <span className="label">Origin:</span>
                <span className="value">{product.origin}</span>
              </div>
            )}
          </div>

          <div className="price-section">
            <div className="price">
              {product.currency && (
                <span className="currency">{product.currency}</span>
              )}
              <span className="amount">{product.price || "N/A"}</span>
            </div>
          </div>

          {product.deliveryTime && (
            <div className="delivery-info">
              <span className="delivery-icon">⚡</span>
              <span>Arrives in {product.deliveryTime}</span>
            </div>
          )}

          {product.combosAvailable && (
            <div className="combo-section">
              <div className="combo-banner">
                <span className="combo-icon">🎯</span>
                <div className="combo-text">
                  <h3>Combos available</h3>
                  <p>Save big on curated combos</p>
                </div>
              </div>
            </div>
          )}

          {product.description && (
            <div className="description-section">
              <h3>Description</h3>
              <p>{product.description}</p>
            </div>
          )}

          {product.features && product.features.length > 0 && (
            <div className="features-section">
              <h3>Key Features</h3>
              <ul className="features-list">
                {product.features.map((feature, index) => (
                  <li key={index}>{feature}</li>
                ))}
              </ul>
            </div>
          )}

          {topKeywords.length > 0 && (
            <div className="keywords-section">
              <h3>Keywords</h3>
              <div className="keywords-list">
                {topKeywords.map((kw, i) => (
                  <span className="keyword-chip" key={i}>
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .product-detail-page {
          min-height: 100vh;
          background: #f8fafc;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
            sans-serif;
        }

        .header {
          background: white;
          padding: 0.75rem 1.25rem;
          border-bottom: 1px solid #e2e8f0;
        }

        .back-button {
          background: none;
          border: none;
          color: #667eea;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          padding: 0.25rem 0;
        }

        .back-button:hover {
          color: #5a67d8;
        }

        .product-container {
          max-width: 1000px;
          margin: 0 auto;
          padding: 1rem;
          display: grid;
          grid-template-columns: 1fr 1fr;
         gap: 4rem;
        }

        .product-images {
          width: 100%;
          display: flex;
          justify-content: center;
          align-items: center;
          background: white;
          border-radius: 10px;
          padding: 1rem;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        }

        .main-image {
          max-width: 100%;
          max-height: 350px;
          object-fit: contain;
          border-radius: 8px;
        }

        .image-placeholder {
          width: 90%;
          height: 350px;
          background: #f1f5f9;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 3rem;
        }

        .product-info {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .brand-section {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .brand {
          color: #667eea;
          font-weight: 600;
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .product-title {
          font-size: 1.5rem;
          font-weight: 700;
          color: #1e293b;
          margin: 0;
          line-height: 1.3;
        }

        .product-meta {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .meta-item {
          display: flex;
          gap: 0.5rem;
          align-items: center;
        }

        .label {
          color: #64748b;
          font-weight: 500;
          min-width: 60px;
        }

        .value {
          color: #1e293b;
          font-weight: 600;
        }

        .price-section {
          padding: 0.5rem 0;
          border-bottom: 1px solid #e2e8f0;
        }

        .price {
          display: flex;
          align-items: baseline;
          gap: 0.25rem;
        }

        .currency {
          font-size: 1rem;
          font-weight: 600;
          color: #059669;
        }

        .amount {
          font-size: 1.5rem;
          font-weight: 700;
          color: #059669;
        }

        .delivery-info {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: #059669;
          font-weight: 600;
          font-size: 0.875rem;
        }

        .delivery-icon {
          font-size: 1rem;
        }

        .combo-section {
          background: #fef3c7;
          border-radius: 6px;
          padding: 0.75rem;
        }

        .combo-banner {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .combo-icon {
          font-size: 1.25rem;
        }

        .combo-text h3 {
          margin: 0 0 0.25rem 0;
          font-size: 0.95rem;
          font-weight: 600;
          color: #92400e;
        }

        .combo-text p {
          margin: 0;
          font-size: 0.8rem;
          color: #a16207;
        }

        .description-section,
        .features-section,
        .keywords-section {
          padding: 0.5rem 0;
          border-bottom: 1px solid #e2e8f0;
        }

        .description-section h3,
        .features-section h3,
        .keywords-section h3 {
          font-size: 1rem;
          font-weight: 600;
          color: #1e293b;
          margin: 0 0 0.5rem 0;
        }

        .description-section p {
          color: #475569;
          line-height: 1.5;
          margin: 0;
        }

        .features-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .features-list li {
          padding: 0.4rem 0;
          color: #475569;
          position: relative;
          padding-left: 1.25rem;
        }

        .features-list li:before {
          content: "✓";
          position: absolute;
          left: 0;
          color: #059669;
          font-weight: bold;
        }

        .keywords-list {
          display: flex;
          flex-wrap: wrap;
          gap: 0.4rem;
        }

        .keyword-chip {
          background: #667eea;
          color: white;
          padding: 0.4rem 0.75rem;
          border-radius: 16px;
          font-size: 0.75rem;
          font-weight: 500;
        }

        .detail-loader,
        .no-results {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 50vh;
          text-align: center;
        }

        .detail-loader-spinner {
          width: 36px;
          height: 36px;
          border: 3px solid #e2e8f0;
          border-top: 3px solid #667eea;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-bottom: 1rem;
        }

        @keyframes spin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 768px) {
          .product-container {
            grid-template-columns: 1fr;
            gap: 1rem;
            padding: 0.75rem;
          }

          .product-title {
            font-size: 1.25rem;
          }

          .main-image,
          .image-placeholder {
            height: 250px;
          }
        }
      `}</style>
    </div>
  );
}
