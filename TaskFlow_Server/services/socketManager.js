const { Server } = require("socket.io");
const { parseCookie } = require("cookie");
const jwt = require("jsonwebtoken");

let io = null;

// In-memory registry of active users and locks
// onlineUsers: Map<userId, { user: Object, socketIds: Set<string> }>
const onlineUsers = new Map();

// taskLocks: Map<taskId, { userId: string, userName: string, role: string, lockedAt: number, expiresAt: number }>
const taskLocks = new Map();

const LOCK_DURATION_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Return sanitized list of currently online AGENTS only (not admins/managers).
 * This is what the "Active Team" presence panel shows — the people working leads.
 */
const getOnlineAgents = () => {
  const list = [];
  for (const entry of onlineUsers.values()) {
    if (entry.user.role === "agent") {
      list.push({
        id: entry.user.id,
        name: entry.user.name,
        role: entry.user.role,
        email: entry.user.email,
      });
    }
  }
  return list;
};

/**
 * Return the count of ALL connected users (agents + admins) — used for internal tracking.
 */
const getTotalOnlineCount = () => onlineUsers.size;

/**
 * Get all active locks as an array
 */
const getActiveLocks = () => {
  const now = Date.now();
  const locks = [];
  for (const [taskId, lock] of taskLocks.entries()) {
    if (lock.expiresAt > now) {
      locks.push({ taskId, ...lock });
    } else {
      taskLocks.delete(taskId);
    }
  }
  return locks;
};

/**
 * Clean up expired locks periodically
 */
setInterval(() => {
  const now = Date.now();
  for (const [taskId, lock] of taskLocks.entries()) {
    if (lock.expiresAt <= now) {
      taskLocks.delete(taskId);
      if (io) {
        io.emit("task:unlocked", { taskId, reason: "expired" });
      }
    }
  }
}, 30 * 1000);

/**
 * Initialize Socket.io on the HTTP server
 */
const initSocket = (httpServer, corsOriginChecker) => {
  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (corsOriginChecker(origin)) {
          return callback(null, true);
        }
        callback(new Error("Not allowed by CORS"));
      },
      credentials: true,
      methods: ["GET", "POST"],
    },
    pingInterval: 25000,
    pingTimeout: 20000,
  });

  // Authentication Middleware for WebSocket handshakes
  io.use((socket, next) => {
    try {
      let token = null;

      // 1. Check cookies
      const rawCookie = socket.handshake.headers.cookie;
      if (rawCookie) {
        const parsed = parseCookie(rawCookie);
        if (parsed.token) token = parsed.token;
      }

      // 2. Check auth payload (for token-based or Bearer fallback)
      if (!token && socket.handshake.auth && socket.handshake.auth.token) {
        token = socket.handshake.auth.token;
      }

      if (token) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.id && decoded.role) {
          socket.user = decoded;
          return next();
        }
      }

      // 3. Fallback: authenticated session user passed in socket handshake auth
      const authUser = socket.handshake.auth?.user;
      if (authUser && (authUser.id || authUser._id) && authUser.role) {
        socket.user = {
          id: (authUser.id || authUser._id).toString(),
          name: authUser.name || "Agent",
          role: authUser.role,
          email: authUser.email || "",
        };
        return next();
      }

      console.warn("[Socket Auth] Handshake rejected: No valid cookie or auth payload provided");
      return next(new Error("Authentication token required"));
    } catch (err) {
      console.error("[Socket Auth Error]", err.message);
      next(new Error("Authentication failed: " + err.message));
    }
  });

  io.on("connection", (socket) => {
    const user = socket.user;
    const userId = user.id;

    // Join a personal room so we can send targeted events to this user
    socket.join(`user:${userId}`);

    // Admins and managers join a shared room to receive all task broadcasts
    if (user.role === "admin" || user.role === "manager") {
      socket.join("room:admins");
    }

    // Track online state
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, { user, socketIds: new Set() });
    }
    onlineUsers.get(userId).socketIds.add(socket.id);

    // Send initial bootstrap state to the connected client
    socket.emit("init:state", {
      locks: getActiveLocks(),
      onlineCount: onlineUsers.size,
      onlineAgentCount: getOnlineAgents().length,
      activeAgents: getOnlineAgents(),
    });

    // Broadcast presence update to everyone
    io.emit("presence:update", {
      onlineCount: onlineUsers.size,
      onlineAgentCount: getOnlineAgents().length,
      activeAgents: getOnlineAgents(),
    });

    console.log(`[Socket] User connected: ${user.name || user.email} (${user.role}) [${socket.id}]`);

    // --- TASK LOCKING EVENTS ---

    // Acquire lock on a task
    socket.on("task:acquire_lock", ({ taskId }, callback = () => {}) => {
      if (!taskId) {
        return callback({ success: false, message: "Task ID is required" });
      }

      const now = Date.now();
      const existing = taskLocks.get(taskId);

      // Check if locked by someone else and still valid
      if (existing && existing.userId !== userId && existing.expiresAt > now) {
        return callback({
          success: false,
          message: `Lead is currently being worked on by ${existing.userName}`,
          lock: existing,
        });
      }

      // Assign or refresh lock
      const lockData = {
        userId,
        userName: user.name || "Agent",
        role: user.role,
        lockedAt: now,
        expiresAt: now + LOCK_DURATION_MS,
      };

      taskLocks.set(taskId, lockData);

      // Broadcast lock to all other connected clients
      socket.broadcast.emit("task:locked", { taskId, ...lockData });

      callback({ success: true, lock: lockData });
    });

    // Extend / refresh lock heartbeat
    socket.on("task:heartbeat_lock", ({ taskId }) => {
      const existing = taskLocks.get(taskId);
      if (existing && existing.userId === userId) {
        existing.expiresAt = Date.now() + LOCK_DURATION_MS;
      }
    });

    // Release lock on a task
    socket.on("task:release_lock", ({ taskId }, callback = () => {}) => {
      if (!taskId) return callback({ success: false });

      const existing = taskLocks.get(taskId);
      // Only the lock owner or admin/manager can unlock
      if (existing && (existing.userId === userId || user.role === "admin" || user.role === "manager")) {
        taskLocks.delete(taskId);
        io.emit("task:unlocked", { taskId });
        return callback({ success: true });
      }

      callback({ success: false, message: "Not permitted to unlock this task" });
    });

    // Handle Disconnect
    socket.on("disconnect", () => {
      console.log(`[Socket] User disconnected: ${user.name || user.email} [${socket.id}]`);

      const userEntry = onlineUsers.get(userId);
      if (userEntry) {
        userEntry.socketIds.delete(socket.id);

        // If this user has no other active browser tabs open
        if (userEntry.socketIds.size === 0) {
          onlineUsers.delete(userId);

          // Auto-release all locks held by this user
          for (const [taskId, lock] of taskLocks.entries()) {
            if (lock.userId === userId) {
              taskLocks.delete(taskId);
              io.emit("task:unlocked", { taskId, reason: "agent_disconnected" });
            }
          }

          // Broadcast updated presence
          io.emit("presence:update", {
            onlineCount: onlineUsers.size,
            onlineAgentCount: getOnlineAgents().length,
            activeAgents: getOnlineAgents(),
          });
        }
      }
    });
  });

  return io;
};

// Helper broadcast functions for REST controllers
const notifyTaskCreated = (task) => {
  if (!io) return;
  // Emit only to the assigned agent's personal room + all admin/manager room.
  // This ensures Agent A never sees Agent B's newly assigned tasks.
  const agentId = task.agent?._id?.toString() || task.agent?.toString();
  if (agentId) {
    io.to(`user:${agentId}`).emit("task:created", task);
  }
  // Admins and managers always receive every new task
  io.to("room:admins").emit("task:created", task);
};

const notifyTaskUpdated = (task) => {
  if (!io) return;
  // Updates are broadcast to everyone so dashboards and admin views stay in sync
  io.emit("task:updated", task);
};

const notifyTaskDeleted = (taskId) => {
  if (io) {
    taskLocks.delete(taskId);
    io.emit("task:deleted", { taskId });
    io.emit("task:unlocked", { taskId });
  }
};

const notifyTasksBulkUpdated = (taskIds, updates) => {
  if (io) io.emit("tasks:bulk_updated", { taskIds, updates });
};

module.exports = {
  initSocket,
  getIO: () => io,
  getActiveLocks,
  getOnlineAgents,
  getTotalOnlineCount,
  notifyTaskCreated,
  notifyTaskUpdated,
  notifyTaskDeleted,
  notifyTasksBulkUpdated,
};
