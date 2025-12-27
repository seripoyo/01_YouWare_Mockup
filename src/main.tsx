import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "@edgespark/client/styles.css"; // EdgeSpark auth UI styles
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
