import React from "react";
import { createRoot } from "react-dom/client";
import MedicalInventoryStandardizer from "./MedicalInventoryStandardizer.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <MedicalInventoryStandardizer />
  </React.StrictMode>
);
