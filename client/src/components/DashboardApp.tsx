import React from "react";
import DashboardLayout from "./DashboardLayout";
import "../App.css";

const DashboardApp: React.FC = () => {
  return (
    <div className="w-full h-screen">
      <DashboardLayout />
    </div>
  );
};

export default DashboardApp;