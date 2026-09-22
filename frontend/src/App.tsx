import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import OverviewPage from "./pages/OverviewPage";
import ApprovalsPage from "./pages/ApprovalsPage";
import AttackLabPage from "./pages/AttackLabPage";
import SecurityEventsPage from "./pages/SecurityEventsPage";
import "./index.css";

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<OverviewPage />} />
        <Route path="approvals" element={<ApprovalsPage />} />
        <Route path="attack-lab" element={<AttackLabPage />} />
        <Route path="security-events" element={<SecurityEventsPage />} />
      </Route>
    </Routes>
  );
}

export default App;
