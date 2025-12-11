// Demo UI Entry Point
// This file exports the DemoApp component that handles all demo routes

import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import DemoLayout from "./components/DemoLayout";
import DashboardDemo from "./pages/DashboardDemo";
import WorkloadsDemo from "./pages/WorkloadsDemo";
import PlatformsDemo from "./pages/PlatformsDemo";
import ScenariosDemo from "./pages/ScenariosDemo";
import StrategiesDemo from "./pages/StrategiesDemo";
import ExperimentsDemo from "./pages/ExperimentsDemo";
import ResultsDemo from "./pages/ResultsDemo";
import AnalyticsDemo from "./pages/AnalyticsDemo";

export const DemoApp: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<DemoLayout />}>
        <Route index element={<DashboardDemo />} />
        <Route path="workloads" element={<WorkloadsDemo />} />
        <Route path="platforms" element={<PlatformsDemo />} />
        <Route path="scenarios" element={<ScenariosDemo />} />
        <Route path="strategies" element={<StrategiesDemo />} />
        <Route path="experiments" element={<ExperimentsDemo />} />
        <Route path="results" element={<ResultsDemo />} />
        <Route path="analytics" element={<AnalyticsDemo />} />
        <Route path="*" element={<Navigate to="/demo" replace />} />
      </Route>
    </Routes>
  );
};

export default DemoApp;
