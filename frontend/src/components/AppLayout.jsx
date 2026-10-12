import { Outlet } from "react-router-dom";
import AppHeader from "./AppHeader";
import Footer from "./Footer";

function AppLayout() {
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