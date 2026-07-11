import { Routes, Route } from "react-router-dom";
import Sidebar from "./components/layout/Sidebar";

// Page Imports
import GlobalOverview from "./pages/GlobalOverview";
import NodeDirectory from "./pages/NodeDirectory";
import NodeBlastRadius from "./pages/NodeBlastRadius";

function App() {
  return (
    <div className="flex min-h-screen bg-neutral-950 text-neutral-50 font-sans">
      {/* The sticky left navigation */}
      <Sidebar />

      {/* The main content wrapper (offset by the 64-width sidebar: ml-64) */}
      <div className="flex-1 ml-64 flex flex-col min-h-screen">
        
        {/* The dynamic routing area */}
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<GlobalOverview />} />
            <Route path="/nodes" element={<NodeDirectory />} />
            {/* The :hostname syntax creates a dynamic URL parameter */}
            <Route path="/nodes/:hostname" element={<NodeBlastRadius />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default App;