import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./pwa"; // side effect only: install prompt capture + service worker (production)

const container = document.getElementById("root");
if (!container) throw new Error("#root container is missing from index.html");

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
