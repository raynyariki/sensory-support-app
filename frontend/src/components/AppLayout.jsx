import { useEffect } from "react";
import { Navigate, Outlet, useNavigate } from "react-router-dom";
import AppHeader from "./AppHeader";
import Footer from "./Footer";
import { isSignedIn } from "../api";

function AppLayout() {
  const navigate = useNavigate();

  // api.js raises this event when the server rejects the saved token (expired or logged out elsewhere).
  useEffect(() => {
    function handleSignedOut() {
      navigate("/login", { replace: true });
    }
    window.addEventListener("sensory:signed-out", handleSignedOut);
    return () => window.removeEventListener("sensory:signed-out", handleSignedOut);
  }, [navigate]);

  if (!isSignedIn()) {
    return <Navigate to="/login" replace />;
  }

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      <AppHeader />
      <main id="main">
        <Outlet />
      </main>
      <Footer />
    </>
  );
}

export default AppLayout;