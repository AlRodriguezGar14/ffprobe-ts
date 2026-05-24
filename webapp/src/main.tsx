import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ProbeDemo } from "./ProbeDemo";
import "./app.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ProbeDemo />
  </StrictMode>,
);
