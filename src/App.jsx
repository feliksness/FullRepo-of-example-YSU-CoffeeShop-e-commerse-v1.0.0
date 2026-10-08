// Coffee Lab — app shell & routes (HashRouter works on GitHub Pages without server rewrites).
import { lazy, Suspense } from "react";
import { HashRouter, Route, Routes } from "react-router-dom";
import { LanguageProvider } from "./context/LanguageContext.jsx";
import { StoreProvider } from "./context/StoreContext.jsx";
import { CartProvider } from "./context/CartContext.jsx";
import { ToastProvider } from "./context/ToastContext.jsx";
import { AdminProvider } from "./context/AdminContext.jsx";
import Header from "./components/Header.jsx";
import Footer from "./components/Footer.jsx";
import ScrollToTop from "./components/ScrollToTop.jsx";
import { Spinner } from "./components/States.jsx";
import Home from "./pages/Home.jsx";
import Shop from "./pages/Shop.jsx";
import ProductDetail from "./pages/ProductDetail.jsx";
import Cart from "./pages/Cart.jsx";
import TrackOrder from "./pages/TrackOrder.jsx";
import NotFound from "./pages/NotFound.jsx";

const Checkout = lazy(() => import("./pages/Checkout.jsx"));
const OrderSuccess = lazy(() => import("./pages/OrderSuccess.jsx"));
const Admin = lazy(() => import("./pages/admin/Admin.jsx"));

export default function App() {
  return (
    <LanguageProvider>
      <ToastProvider>
        <StoreProvider>
          <CartProvider>
            <AdminProvider>
              <HashRouter>
                <ScrollToTop />
                <div className="app">
                  <Header />
                  <main className="app__main">
                    <Suspense fallback={<Spinner />}>
                      <Routes>
                        <Route path="/" element={<Home />} />
                        <Route path="/shop" element={<Shop />} />
                        <Route path="/product/:id" element={<ProductDetail />} />
                        <Route path="/cart" element={<Cart />} />
                        <Route path="/checkout" element={<Checkout />} />
                        <Route path="/order/success" element={<OrderSuccess />} />
                        <Route path="/track" element={<TrackOrder />} />
                        <Route path="/admin/*" element={<Admin />} />
                        <Route path="*" element={<NotFound />} />
                      </Routes>
                    </Suspense>
                  </main>
                  <Footer />
                </div>
              </HashRouter>
            </AdminProvider>
          </CartProvider>
        </StoreProvider>
      </ToastProvider>
    </LanguageProvider>
  );
}
