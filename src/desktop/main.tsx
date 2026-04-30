import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import PhotoServe from "../pages/PhotoServe";
import CupCupperCuppers from "../pages/CupCupperCuppers";
import DaelOrNoDaelSingle from "../pages/DaelOrNoDael";
import TupGradeSolver from "../pages/TupGradeSolver";
import DesktopOptions from "./DesktopOptions";
import "../index.css";
import "../App.css";
import "./desktop.css";
import { applyDesktopAppearance } from "./settings";

function resolveAppletRoute() {
  const params = new URLSearchParams(window.location.search);
  const applet = params.get("applet")?.trim() ?? "";

  if (applet === "cup-cupper-cuppers") {
    return "/cup-cupper-cuppers";
  }

  if (applet === "dael-single") {
    return "/dael-or-no-dael";
  }

  if (applet === "tup-grade-solver") {
    return "/tup-grade-solver";
  }

  if (applet === "options") {
    return "/desktop-options";
  }

  return "/photo-serve";
}

function DesktopAppletApp() {
  return (
    <div className="desktop-applet-root">
      <Routes>
        <Route path="/photo-serve" element={<PhotoServe />} />
        <Route path="/cup-cupper-cuppers" element={<CupCupperCuppers />} />
        <Route path="/dael-or-no-dael" element={<DaelOrNoDaelSingle />} />
        <Route path="/tup-grade-solver" element={<TupGradeSolver />} />
        <Route path="/desktop-options" element={<DesktopOptions />} />
        <Route path="*" element={<PhotoServe />} />
      </Routes>
    </div>
  );
}

const container = document.getElementById("root");

if (container) {
  applyDesktopAppearance();
  const root = createRoot(container);
  root.render(
    <MemoryRouter initialEntries={[resolveAppletRoute()]}>
      <DesktopAppletApp />
    </MemoryRouter>,
  );
}
