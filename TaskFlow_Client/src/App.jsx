import React from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import AskPanel from "./components/knowledge/AskPanel";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import Login from "./pages/Login";
import Agentlogin from "./pages/Agentlogin";
import Agentsignup from "./pages/Agentsignup";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import AgentDashboard from "./pages/Agentdashboard";
import AgentTasks from "./pages/AgentTasks";
import Agents from "./pages/Agents";
import UploadCSV from "./pages/UploadCSV";
import Analytics from "./pages/Analytics";
import ActivityLog from "./pages/ActivityLog";
import KnowledgeBase from "./pages/KnowledgeBase";
import ProtectedRoute from "./components/ProtectedRoute";

/**
 * The TaskFlow AI panel lives here, outside <Routes>, so it isn't unmounted on navigation:
 * it stays open with its conversation while the user moves between pages.
 * Keyed by user so a different login never sees the previous user's conversation.
 */
const GlobalAskPanel = () => {
  const { user, loading } = useAuth();
  if (loading || !user) return null;
  return <AskPanel key={user._id || user.id} />;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public Authentication Routes */}
          <Route path="/" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/agent/login" element={<Agentlogin />} />
          <Route path="/agent/signup" element={<Agentsignup />} />

          {/* Protected Admin Routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute requiredRole="admin">
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tasks"
            element={
              <ProtectedRoute requiredRole="admin">
                <AgentTasks />
              </ProtectedRoute>
            }
          />
          <Route
            path="/agents"
            element={
              <ProtectedRoute requiredRole="admin">
                <Agents />
              </ProtectedRoute>
            }
          />
          <Route
            path="/upload"
            element={
              <ProtectedRoute requiredRole="admin">
                <UploadCSV />
              </ProtectedRoute>
            }
          />
          <Route
            path="/analytics"
            element={
              <ProtectedRoute requiredRole="admin">
                <Analytics />
              </ProtectedRoute>
            }
          />

          <Route
            path="/activity"
            element={
              <ProtectedRoute requiredRole="admin">
                <ActivityLog />
              </ProtectedRoute>
            }
          />

          <Route
            path="/knowledge"
            element={
              <ProtectedRoute requiredRole="admin">
                <KnowledgeBase />
              </ProtectedRoute>
            }
          />

          {/* Protected Agent Routes */}
          <Route
            path="/agent/dashboard"
            element={
              <ProtectedRoute requiredRole="agent">
                <AgentDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/agent/tasks"
            element={
              <ProtectedRoute requiredRole="agent">
                <AgentTasks />
              </ProtectedRoute>
            }
          />

          {/* Fallback /tasks route redirects to agent tasks */}
          <Route
            path="/tasks/:agentId"
            element={
              <ProtectedRoute>
                <AgentTasks />
              </ProtectedRoute>
            }
          />
        </Routes>

        {/* Persistent across page navigation (only shown when logged in) */}
        <GlobalAskPanel />
      </Router>

      <ToastContainer
        position="bottom-right"
        autoClose={3500}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="dark"
      />
    </AuthProvider>
  );
}

export default App;
