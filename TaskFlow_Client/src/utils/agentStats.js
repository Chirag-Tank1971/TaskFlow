/**
 * Utility functions for calculating agent statistics
 */

/**
 * Calculate all statistics from tasks array
 * @param {Array} tasks - Array of task objects
 * @returns {Object} Statistics object
 */
export const calculateStats = (tasks) => {
  const totalTasks = tasks.length;
  const pendingTasks = tasks.filter((t) => t.status === "pending").length;
  const inProgressTasks = tasks.filter((t) => t.status === "in-progress").length;
  const completedTasks = tasks.filter((t) => t.status === "completed").length;

  // Calculate completion rate
  const completionRate =
    totalTasks > 0 ? parseFloat(((completedTasks / totalTasks) * 100).toFixed(1)) : 0;

  // Get today's date range
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Today's tasks (assigned today)
  const todayTasks = tasks.filter((task) => {
    const taskDate = new Date(task.createdAt);
    return taskDate >= today && taskDate < tomorrow;
  }).length;

  // Tasks completed today
  const todayCompleted = tasks.filter((task) => {
    if (task.status === "completed" && task.completedDate) {
      const completedDate = new Date(task.completedDate);
      return completedDate >= today && completedDate < tomorrow;
    }
    return false;
  }).length;

  // Calculate average completion time (in hours)
  const completedTasksWithTime = tasks.filter(
    (t) => t.status === "completed" && t.completedDate && t.createdAt
  );

  let avgCompletionTime = 0;
  if (completedTasksWithTime.length > 0) {
    const totalTime = completedTasksWithTime.reduce((sum, task) => {
      const timeDiff = new Date(task.completedDate) - new Date(task.createdAt);
      return sum + timeDiff;
    }, 0);
    avgCompletionTime = (totalTime / completedTasksWithTime.length) / (1000 * 60 * 60); // Convert to hours
  }

  return {
    totalTasks,
    pendingTasks,
    inProgressTasks,
    completedTasks,
    completionRate,
    todayTasks,
    todayCompleted,
    avgCompletionTime: parseFloat(avgCompletionTime.toFixed(2)),
  };
};

/**
 * Calculate performance metrics from tasks
 * @param {Array} tasks - Array of task objects
 * @returns {Object} Performance metrics
 */
export const calculatePerformance = (tasks) => {
  // Get last 7 days
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Weekly completion trend (last 7 days)
  const weeklyTrend = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);

    const dayTasks = tasks.filter((task) => {
      if (task.status === "completed" && task.completedDate) {
        const completedDate = new Date(task.completedDate);
        return completedDate >= date && completedDate < nextDate;
      }
      return false;
    }).length;

    weeklyTrend.push({
      date: date.toISOString().split("T")[0],
      count: dayTasks,
    });
  }

  // Calculate performance score
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === "completed").length;
  const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  // Average completion time
  const completedTasksWithTime = tasks.filter(
    (t) => t.status === "completed" && t.completedDate && t.createdAt
  );
  let avgCompletionTime = 0;
  if (completedTasksWithTime.length > 0) {
    const totalTime = completedTasksWithTime.reduce((sum, task) => {
      const timeDiff = new Date(task.completedDate) - new Date(task.createdAt);
      return sum + timeDiff;
    }, 0);
    avgCompletionTime = totalTime / completedTasksWithTime.length / (1000 * 60 * 60);
  }
  const timeScore = avgCompletionTime > 0 ? Math.max(0, 100 - (avgCompletionTime / 48) * 100) : 50;

  // Performance score (weighted)
  const performanceScore = completionRate * 0.7 + timeScore * 0.3;

  // Best day performance
  const dailyCompletions = {};
  tasks.forEach((task) => {
    if (task.status === "completed" && task.completedDate) {
      const date = new Date(task.completedDate).toISOString().split("T")[0];
      dailyCompletions[date] = (dailyCompletions[date] || 0) + 1;
    }
  });

  const bestDay = Object.entries(dailyCompletions).reduce(
    (max, [date, count]) => (count > max.count ? { date, count } : max),
    { date: null, count: 0 }
  );

  return {
    weeklyTrend,
    performanceScore: parseFloat(performanceScore.toFixed(1)),
    completionRate: parseFloat(completionRate.toFixed(1)),
    avgCompletionTime: parseFloat(avgCompletionTime.toFixed(2)),
    bestDay: bestDay.date ? { date: bestDay.date, count: bestDay.count } : null,
  };
};

/**
 * Get today's tasks
 * @param {Array} tasks - Array of task objects
 * @returns {Array} Today's tasks
 */
export const getTodayTasks = (tasks) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return tasks.filter((task) => {
    const taskDate = new Date(task.createdAt);
    return taskDate >= today && taskDate < tomorrow;
  });
};

/**
 * Get activity feed from tasks
 * @param {Array} tasks - Array of task objects
 * @param {Number} limit - Maximum number of activities (default: 20)
 * @returns {Array} Activity feed
 */
export const getActivityFeed = (tasks, limit = 20) => {
  const activities = tasks.map((task) => {
    const activity = {
      id: task._id,
      type: "task",
      taskId: task._id,
      taskNotes: task.notes,
      taskFirstName: task.firstName,
      status: task.status,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      completedDate: task.completedDate,
    };

    // Determine activity type
    if (task.status === "completed" && task.completedDate) {
      activity.activityType = "completed";
      activity.timestamp = task.completedDate;
      activity.message = `Completed task: ${task.notes || task.firstName}`;
    } else if (task.status === "in-progress") {
      activity.activityType = "in-progress";
      activity.timestamp = task.updatedAt;
      activity.message = `Started working on: ${task.notes || task.firstName}`;
    } else {
      activity.activityType = "assigned";
      activity.timestamp = task.createdAt;
      activity.message = `New task assigned: ${task.notes || task.firstName}`;
    }

    return activity;
  });

  // Sort by timestamp (most recent first)
  activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  return activities.slice(0, limit);
};

/**
 * Format completion time in a human-readable format
 * @param {Number} hours - Time in hours
 * @returns {String} Formatted time string
 */
export const formatCompletionTime = (hours) => {
  if (!hours || hours === 0) return "N/A";
  if (hours < 1) {
    const minutes = Math.round(hours * 60);
    return `${minutes} min`;
  } else if (hours < 24) {
    return `${hours.toFixed(1)} hrs`;
  } else {
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `${days}d ${remainingHours.toFixed(1)}h`;
  }
};

/**
 * Format date in a human-readable format
 * @param {String|Date} date - Date string or Date object
 * @returns {String} Formatted date string
 */
export const formatDate = (date) => {
  if (!date) return "Never";
  const d = new Date(date);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/**
 * Calculate days active from join date
 * @param {String|Date} joinDate - Join date
 * @returns {Number} Days active
 */
export const calculateDaysActive = (joinDate) => {
  if (!joinDate) return 0;
  const join = new Date(joinDate);
  const today = new Date();
  return Math.floor((today - join) / (1000 * 60 * 60 * 24));
};

