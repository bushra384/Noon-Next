"use client";

import { useState, useEffect, useMemo } from "react";

function ProductCard({ product, onClick }) {
  const handleClick = () => {
    if (onClick) {
      onClick(product);
    } else {
      // Extract product ID from URL for navigation

      const productId = product.productUrl
        ?.split("/now-product/")[1]
        ?.split("/")[0];
      if (productId) {
        window.location.href = `/product/${productId}`;
      }
    }
  };

  return (
    <div className="product-card" onClick={handleClick}>
      <div className="card-image-container">
        {product.images && product.images.length > 0 ? (
          <img
            src={product.images[0]}
            alt={product.productName || "Product"}
            className="card-image"
          />
        ) : (
          <div className="image-placeholder">
            <span>🥬</span>
          </div>
        )}
      </div>
      <h3 className="card-title">{product.productName || "Product Name"}</h3>
      <div className="detail-text">
        {product.weight || ""} {product.country ? `| ${product.country}` : ""}
      </div>
      <div className="price">{product.price || "N/A"}</div>
      <button className="add-to-cart-btn" onClick={() => window.location.href = `/product/${product.productId}`}>More Info</button>
    </div>
  );
}

export default function Home() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [usingMockData, setUsingMockData] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const fetchProducts = async (append = false) => {
    try {
      if (append) setLoadingMore(true);
      else setLoading(true);

      const response = await fetch(`/api/scrape?page=${page}&limit=20`);
      if (!response.ok) throw new Error("Failed to fetch products");

      const data = await response.json();
      setProducts((prev) =>
        append ? [...prev, ...data.products] : data.products
      );
      setHasMore(
        data.pagination?.hasMore || page < data.pagination?.totalPages
      );
      setUsingMockData(false);

      
      console.log(">>>> Debug product scraped:", {
        products: data.products
      });
    } catch (err) {
      console.error("Error fetching products:", err);
      setError(err.message);
      if (!append) {
        setUsingMockData(true);
        setProducts([
          {
            productName: "Driscoll's Blueberry",
            price: "฿ 10.65",
            weight: "1 Punnet (125g)",
            country: "Morocco",
            productUrl: "/now-product/blueberry-12345",
            images: [
              "https://www.driscolls.com/-/media/images/products/blueberries.ashx",
            ],
          },
          {
            productName: "Potato",
            price: "฿ 15.00",
            weight: "1kg",
            country: "India",
            productUrl: "/now-product/potato-98765",
            images: ["https://via.placeholder.com/220x150?text=Potato"],
          },
        ]);

      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    if (page > 1) fetchProducts(true);
  }, [page]);

  const loadMore = () => setPage((prev) => prev + 1);

  const filteredProducts = useMemo(() => {
    if (!searchTerm) return products;
    return products.filter(
      (product) =>
        product.productName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.country?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.weight?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, products]);

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-content">
          <h1 className="app-title">🍃 Fresh Market</h1>
          <div className="search-container">
            <input
              type="text"
              placeholder="Search fruits, vegetables..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content">
        {loading ? (
          <div className="loading-container">
            <div className="spinner"></div>
          </div>
        ) : error && products.length === 0 ? (
          <div className="error-container">
            <p>😕 {error}</p>
            <button onClick={fetchProducts} className="retry-btn">
              Try Again
            </button>
          </div>
        ) : (
          <>
            <div className="results-info">
              <span>
                {filteredProducts.length}{" "}
                {searchTerm ? `results for "${searchTerm}"` : "products"}
              </span>
              {usingMockData && (
                <span className="mock-data">Using sample data</span>
              )}
            </div>

            {/* Products Grid */}
            <div className="products-grid">
              {filteredProducts.length > 0 ? (
                filteredProducts.map((product, index) => (
                  <ProductCard key={index} product={product} />
                ))
              ) : (
                <div className="no-results">
                  <p>No products found for "{searchTerm}"</p>
                  <button onClick={() => setSearchTerm("")}>
                    Clear Search
                  </button>
                </div>
              )}
            </div>

            {/* Load More */}
            {hasMore && !searchTerm && (
              <div className="load-more-container">
                <button
                  className="load-more-btn"
                  onClick={loadMore}
                  disabled={loadingMore}
                >
                  {loadingMore ? "Loading..." : "Load More"}
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* Styles */}
      <style jsx>{`
        .app {
          min-height: 100vh;
          background: #fafafa;
          font-family: Arial, sans-serif;
        }

        .header-content {
          display: flex;
          align-items: center;
          gap: 1.5rem; /* Adjust spacing here */
        }

        .app-title {
          font-size: 1.75rem;
          font-weight: bold;
          color: #333;
        }

        .search-container {
          max-width: 400px;
          width: 100%;
        }

        .search-input {
          width: 100%;
          padding: 0.75rem 1rem;
          border: 1px solid #ccc;
          border-radius: 8px;
          font-size: 1rem;
        }

        .main-content {
          max-width: 1200px;
          margin: 0 auto;
          padding: 2rem;
        }

        .results-info {
          font-size: 1rem;
          margin-bottom: 1rem;
        }

        .mock-data {
          background: #ffe8cc;
          color: #b86b00;
          padding: 4px 8px;
          border-radius: 6px;
          font-size: 0.8rem;
        }

        .products-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 20px;
        }

        .product-card {
          width: 220px;
          height: 320px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
          padding: 12px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          text-align: center;
          cursor: pointer;
          transition: all 0.2s;
        }

        .product-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .card-image-container {
          width: 100%;
          height: 150px;
          display: flex;
          justify-content: center;
          align-items: center;
          background: #f9f9f9;
        }

        .card-image {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
        }

        .card-title {
          font-size: 14px;
          font-weight: 600;
          margin: 8px 0;
          color: #333;
        }

        .detail-text {
          font-size: 12px;
          color: #888;
        }

        .price {
          font-size: 16px;
          font-weight: 700;
          color: #000;
        }

        .add-to-cart-btn {
          background: #e60023;
          color: white;
          border: none;
          border-radius: 8px;
          padding: 8px 12px;
          font-size: 14px;
          font-weight: bold;
          cursor: pointer;
          margin-top: 10px;
        }

        .add-to-cart-btn:hover {
          background: #c5001e;
        }

        .load-more-container {
          text-align: center;
          margin-top: 20px;
        }

        .loading-container {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 400px;
        }

        .spinner {
          width: 48px;
          height: 48px;
          border: 5px solid rgba(0, 0, 0, 0.1);
          border-top-color: #e60023;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        .load-more-btn {
          background: #e60023;
          color: white;
          border: none;
          border-radius: 8px;
          padding: 10px 16px;
          font-size: 14px;
          cursor: pointer;
        }

        .load-more-btn:hover {
          background: rgb(230, 31, 61);
        }

        .load-more-btn:disabled {
          background: #999;
          cursor: not-allowed;
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