import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import io from "socket.io-client";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import "./App.css";

const API_BASE_URL = "http://localhost:5000";

const App = () => {
  const [logs, setLogs] = useState([]); // Raw logs from API
  const [filteredLogs, setFilteredLogs] = useState([]); // Filtered logs for display
  const [stats, setStats] = useState({
    INFO: 0,
    WARN: 0,
    ERROR: 0,
    total: 0,
    errorRate: 0,
  });
  const [filters, setFilters] = useState({
    level: "",
    service: "",
    search: "",
    limit: 50,
    page: 1,
  });
  const [loading, setLoading] = useState(false);
  const [socket, setSocket] = useState(null);
  const [realTimeEnabled, setRealTimeEnabled] = useState(true);
  const [pagination, setPagination] = useState({});

  // Initialize socket connection
  useEffect(() => {
    const newSocket = io(API_BASE_URL);
    setSocket(newSocket);

    return () => newSocket.close();
  }, []);

  // Helper function to check if a log matches current filters
  const logMatchesFilters = useCallback(
    (log) => {
      if (filters.level && log.level !== filters.level) return false;
      if (filters.service && log.service !== filters.service) return false;
      if (
        filters.search &&
        !log.message.toLowerCase().includes(filters.search.toLowerCase())
      )
        return false;
      return true;
    },
    [filters]
  );

  // Apply filters to logs
  const applyFilters = useCallback(
    (logsToFilter) => {
      if (!filters.level && !filters.service && !filters.search) {
        return logsToFilter;
      }
      return logsToFilter.filter(logMatchesFilters);
    },
    [filters, logMatchesFilters]
  );

  // Socket event handlers
  useEffect(() => {
    if (!socket) return;

    socket.on("newLog", (newLog) => {
      if (realTimeEnabled) {
        // Add to raw logs
        setLogs((prev) => [newLog, ...prev]);

        // Only add to filtered logs if it matches current filters
        if (logMatchesFilters(newLog)) {
          setFilteredLogs((prev) => [
            newLog,
            ...prev.slice(0, filters.limit - 1),
          ]);
        }
      }
    });

    socket.on("statsUpdate", (newStats) => {
      setStats(newStats);
    });

    return () => {
      socket.off("newLog");
      socket.off("statsUpdate");
    };
  }, [socket, realTimeEnabled, filters.limit, logMatchesFilters]);

  // Update filtered logs when filters change or logs change
  useEffect(() => {
    const filtered = applyFilters(logs);
    setFilteredLogs(filtered.slice(0, filters.limit));
  }, [logs, filters, applyFilters]);

  // Fetch logs
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();

      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });

      const response = await axios.get(`${API_BASE_URL}/logs?${params}`);

      // Set both raw logs and filtered logs
      setLogs(response.data.logs);
      setFilteredLogs(response.data.logs); // API already returns filtered data
      setPagination(response.data.pagination);
    } catch (error) {
      console.error("Error fetching logs:", error);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/logs/stats?seconds=60`);
      setStats(response.data);
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  }, []);

  // Initial load and periodic refresh
  useEffect(() => {
    fetchLogs();
    fetchStats();

    if (!realTimeEnabled) {
      const interval = setInterval(() => {
        fetchLogs();
        fetchStats();
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [fetchLogs, fetchStats, realTimeEnabled]);

  // Handle filter changes
  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
      page: 1, // Reset to first page when filters change
    }));
  };

  // Handle pagination
  const handlePageChange = (newPage) => {
    setFilters((prev) => ({ ...prev, page: newPage }));
  };

  // Format timestamp
  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  // Get level color
  const getLevelColor = (level) => {
    switch (level) {
      case "INFO":
        return "#4CAF50";
      case "WARN":
        return "#FF9800";
      case "ERROR":
        return "#F44336";
      default:
        return "#757575";
    }
  };

  // Prepare chart data
  const chartData = [
    { name: "INFO", count: stats.INFO, color: "#4CAF50" },
    { name: "WARN", count: stats.WARN, color: "#FF9800" },
    { name: "ERROR", count: stats.ERROR, color: "#F44336" },
  ];

  // Check if any filters are active
  const hasActiveFilters = filters.level || filters.service || filters.search;

  return (
    <div className="app">
      {/* Stats Dashboard */}
      <div className="stats-section">
        <div className="stats-cards">
          <div className="stat-card">
            <h3>Total Logs</h3>
            <div className="stat-value">{stats.total}</div>
          </div>
          <div className="stat-card">
            <h3>Error Rate</h3>
            <div className="stat-value">{stats.errorRate}%</div>
          </div>
          <div className="stat-card info">
            <h3>INFO</h3>
            <div className="stat-value">{stats.INFO}</div>
          </div>
          <div className="stat-card warn">
            <h3>WARN</h3>
            <div className="stat-value">{stats.WARN}</div>
          </div>
          <div className="stat-card error">
            <h3>ERROR</h3>
            <div className="stat-value">{stats.ERROR}</div>
          </div>
        </div>

        <div className="charts-section">
          <div className="chart-container">
            <h3>Log Levels Distribution (Last 60s)</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-container">
            <h3>Log Levels Pie Chart</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                  label
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-section">
        <div className="filters">
          <select
            value={filters.level}
            onChange={(e) => handleFilterChange("level", e.target.value)}
          >
            <option value="">All Levels</option>
            <option value="INFO">INFO</option>
            <option value="WARN">WARN</option>
            <option value="ERROR">ERROR</option>
          </select>

          <select
            value={filters.service}
            onChange={(e) => handleFilterChange("service", e.target.value)}
          >
            <option value="">All Services</option>
            <option value="auth">Auth</option>
            <option value="payments">Payments</option>
            <option value="notifications">Notifications</option>
          </select>

          <input
            type="text"
            placeholder="Search messages..."
            value={filters.search}
            onChange={(e) => handleFilterChange("search", e.target.value)}
          />

          <select
            value={filters.limit}
            onChange={(e) => handleFilterChange("limit", e.target.value)}
          >
            <option value="25">25 per page</option>
            <option value="50">50 per page</option>
            <option value="100">100 per page</option>
          </select>

          {hasActiveFilters && (
            <button
              className="clear-filters-btn"
              onClick={() =>
                setFilters({
                  level: "",
                  service: "",
                  search: "",
                  limit: 50,
                  page: 1,
                })
              }
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Logs Table */}
      <div className="logs-section">
        <div className="logs-header">
          <h2>Logs</h2>
          {loading && <div className="loading">Loading...</div>}
        </div>

        <div className="logs-table-container">
          <table className="logs-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Level</th>
                <th>Service</th>
                <th>Message</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log) => (
                <tr
                  key={log._id}
                  className={`log-row ${log.level.toLowerCase()}`}
                >
                  <td>{formatTimestamp(log.timestamp)}</td>
                  <td>
                    <span
                      className="level-badge"
                      style={{ backgroundColor: getLevelColor(log.level) }}
                    >
                      {log.level}
                    </span>
                  </td>
                  <td>{log.service}</td>
                  <td>{log.message}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredLogs.length === 0 && !loading && (
            <div className="no-logs-message">
              {hasActiveFilters
                ? "No logs match the current filters."
                : "No logs available."}
            </div>
          )}
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="pagination">
            <button
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page === 1}
            >
              Previous
            </button>

            <span>
              Page {pagination.page} of {Math.ceil(stats.total / filters.limit)}
              ({stats.total} total logs)
            </span>

            <button
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page === pagination.pages}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
