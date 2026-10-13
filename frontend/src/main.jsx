import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import "./index.css";
import "./styles/site.css";
import "./styles/auth.css";
import "./styles/setup.css";
import "./styles/app.css";
import "./styles/monitor.css";
import "./styles/history.css";
import "./styles/analytics.css";
import "./styles/profile.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);