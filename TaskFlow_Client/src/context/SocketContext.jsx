import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from "react";
import { io } from "socket.io-client";
import { useAuth } from "./AuthContext";

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { user } = useAuth();
  const socketRef = useRef(null);

  const [isConnected, setIsConnected] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);
  const [onlineAgentCount, setOnlineAgentCount] = useState(0);
  const [activeAgents, setActiveAgents] = useState([]);
  const [locks, setLocks] = useState({}); // { [taskId]: { userId, userName, role, lockedAt, expiresAt } }
  const [lastTaskEvent, setLastTaskEvent] = useState(null);

  // Heartbeat interval ref for any lock held by the current user
  const activeHeldTaskIdRef = useRef(null);

  useEffect(() => {
    // Only connect if user is authenticated
    if (!user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setIsConnected(false);
      setLocks({});
      setOnlineCount(0);
      setActiveAgents([]);
      return;
    }

    const socketUrl =
      import.meta.env.VITE_SOCKET_URL ||
      (import.meta.env.DEV ? "http://localhost:5000" : "https://taskflow-5zsy.onrender.com");

    const socket = io(socketUrl, {
      withCredentials: true,
      transports: ["polling", "websocket"],
      auth: {
        user: {
          id: user._id || user.id,
          name: user.name,
          role: user.role,
          email: user.email,
        },
      },
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setIsConnected(true);
      console.log("[Socket] Connected to TaskFlow real-time server");
    });

    socket.on("connect_error", (err) => {
      console.warn("[Socket] Connection error:", err.message);
      setIsConnected(false);
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
      console.log("[Socket] Disconnected from server");
    });

    // Initial state received on handshake
    socket.on("init:state", (data) => {
      if (data.locks) {
        const lockMap = {};
        data.locks.forEach((l) => {
          lockMap[l.taskId] = l;
        });
        setLocks(lockMap);
      }
      if (typeof data.onlineCount === "number") setOnlineCount(data.onlineCount);
      if (typeof data.onlineAgentCount === "number") setOnlineAgentCount(data.onlineAgentCount);
      if (Array.isArray(data.activeAgents)) setActiveAgents(data.activeAgents);
    });

    // Presence updates
    socket.on("presence:update", (data) => {
      if (typeof data.onlineCount === "number") setOnlineCount(data.onlineCount);
      if (typeof data.onlineAgentCount === "number") setOnlineAgentCount(data.onlineAgentCount);
      if (Array.isArray(data.activeAgents)) setActiveAgents(data.activeAgents);
    });

    // Lock acquired by any agent
    socket.on("task:locked", (lockData) => {
      setLocks((prev) => ({
        ...prev,
        [lockData.taskId]: lockData,
      }));
    });

    // Lock released
    socket.on("task:unlocked", ({ taskId }) => {
      setLocks((prev) => {
        const next = { ...prev };
        delete next[taskId];
        return next;
      });
      if (activeHeldTaskIdRef.current === taskId) {
        activeHeldTaskIdRef.current = null;
      }
    });

    // Real-time task changes
    socket.on("task:created", (task) => {
      setLastTaskEvent({ type: "created", task, timestamp: Date.now() });
    });

    socket.on("task:updated", (task) => {
      setLastTaskEvent({ type: "updated", task, timestamp: Date.now() });
    });

    socket.on("task:deleted", ({ taskId }) => {
      setLastTaskEvent({ type: "deleted", taskId, timestamp: Date.now() });
    });

    socket.on("tasks:bulk_updated", ({ taskIds, updates }) => {
      setLastTaskEvent({ type: "bulk_updated", taskIds, updates, timestamp: Date.now() });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [user]);

  // Periodic lock heartbeat for currently active task
  useEffect(() => {
    const timer = setInterval(() => {
      if (socketRef.current && isConnected && activeHeldTaskIdRef.current) {
        socketRef.current.emit("task:heartbeat_lock", {
          taskId: activeHeldTaskIdRef.current,
        });
      }
    }, 60 * 1000); // Heartbeat every 1 minute
    return () => clearInterval(timer);
  }, [isConnected]);

  /**
   * Acquire a collision lock on a task
   */
  const acquireLock = useCallback((taskId) => {
    return new Promise((resolve) => {
      if (!socketRef.current || !socketRef.current.connected) {
        // Fallback gracefully if socket is disconnected
        return resolve({ success: true, fallback: true });
      }

      socketRef.current.emit("task:acquire_lock", { taskId }, (response) => {
        if (response && response.success) {
          activeHeldTaskIdRef.current = taskId;
          setLocks((prev) => ({
            ...prev,
            [taskId]: response.lock,
          }));
        }
        resolve(response || { success: false });
      });
    });
  }, []);

  /**
   * Release a collision lock on a task
   */
  const releaseLock = useCallback((taskId) => {
    return new Promise((resolve) => {
      if (activeHeldTaskIdRef.current === taskId) {
        activeHeldTaskIdRef.current = null;
      }

      if (!socketRef.current || !socketRef.current.connected) {
        return resolve({ success: true });
      }

      socketRef.current.emit("task:release_lock", { taskId }, (response) => {
        setLocks((prev) => {
          const next = { ...prev };
          delete next[taskId];
          return next;
        });
        resolve(response || { success: true });
      });
    });
  }, []);

  /**
   * Check if a task is locked, and by whom
   */
  const getTaskLockStatus = useCallback(
    (taskId) => {
      const lock = locks[taskId];
      if (!lock) return { isLocked: false, lockedByOther: false, lock: null };

      const isLockedByOther = user && lock.userId !== (user._id || user.id);
      return {
        isLocked: true,
        lockedByOther: isLockedByOther,
        lock,
      };
    },
    [locks, user]
  );

  return (
    <SocketContext.Provider
      value={{
        socket: socketRef.current,
        isConnected,
        onlineCount,
        onlineAgentCount,
        activeAgents,
        locks,
        lastTaskEvent,
        acquireLock,
        releaseLock,
        getTaskLockStatus,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error("useSocket must be used within a SocketProvider");
  }
  return context;
};

export default SocketContext;
