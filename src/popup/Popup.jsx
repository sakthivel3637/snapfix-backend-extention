import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { API_BASE_URL } from "../config";

const Popup = () => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [error, setError] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef(null);

  useEffect(() => {
    // Check if token exists in chrome storage
    chrome.storage.local.get(
      ["token", "user", "isTesting", "selectedProject"],
      (result) => {
        if (result.token) {
          setToken(result.token);
          setUser(result.user);
          axios.defaults.headers.common["Authorization"] =
            `Bearer ${result.token}`;
          fetchProjects(result.selectedProject);
        }
        if (result.isTesting) {
          setIsTesting(result.isTesting);
        }
      },
    );

    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);

    const handleStorageChange = (changes, areaName) => {
      if (areaName === "local" && changes.isTesting) {
        setIsTesting(changes.isTesting.newValue || false);
      }
    };
    chrome.storage.onChanged.addListener(handleStorageChange);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  const fetchProjects = async (savedProjectId) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/projects`);
      setProjects(response.data);
      if (response.data.length > 0) {
        const idToSelect =
          savedProjectId && response.data.some((p) => p.id === savedProjectId)
            ? savedProjectId
            : response.data[0].id;
        setSelectedProjectId(idToSelect);
        chrome.storage.local.set({ selectedProject: idToSelect });
      }
    } catch (err) {
      console.error("Fetch projects error:", err);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoggingIn(true);
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/auth/login`,
        { email, password },
      );
      const { token: newToken, user: newUser } = response.data;

      chrome.storage.local.set({ token: newToken, user: newUser }, () => {
        setToken(newToken);
        setUser(newUser);
        axios.defaults.headers.common["Authorization"] = `Bearer ${newToken}`;
        fetchProjects();
        setIsLoggingIn(false);
      });
    } catch (err) {
      setError(err.response?.data?.error || "Invalid credentials");
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    chrome.storage.local.remove(
      ["token", "user", "isTesting", "selectedProject"],
      () => {
        setToken("");
        setUser(null);
        setProjects([]);
        setIsTesting(false);
        setSelectedProjectId("");
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, { type: "STOP_TESTING" });
          }
        });
      },
    );
  };

  const handleStartTesting = () => {
    if (!selectedProjectId) {
      alert("Please select a project first!");
      return;
    }
    chrome.storage.local.set(
      { isTesting: true, selectedProject: selectedProjectId },
      () => {
        setIsTesting(true);
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]) {
            chrome.tabs.sendMessage(
              tabs[0].id,
              {
                type: "START_TESTING",
                projectId: selectedProjectId,
                token: token,
              },
              () => {
                if (chrome.runtime.lastError) {
                  chrome.scripting.executeScript({
                    target: { tabId: tabs[0].id },
                    files: ["contentScript.js"]
                  }, () => {
                    setTimeout(() => {
                      chrome.tabs.sendMessage(tabs[0].id, {
                        type: "START_TESTING",
                        projectId: selectedProjectId,
                        token: token,
                      });
                    }, 100);
                  });
                }
              }
            );
          }
        });
      },
    );
  };

  const handleStopTesting = () => {
    chrome.storage.local.set({ isTesting: false }, () => {
      setIsTesting(false);
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { type: "STOP_TESTING" });
        }
      });
    });
  };

  const currentProject = projects.find((p) => p.id === selectedProjectId);

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const selectProject = (projectId) => {
    setSelectedProjectId(projectId);
    chrome.storage.local.set({ selectedProject: projectId });
    setIsOpen(false);
    setSearchQuery("");
  };

  if (!token) {
    return (
      <div
        style={{
          padding: "24px 20px",
          display: "flex",
          flexDirection: "column",
          height: "100%",
          boxSizing: "border-box",
        }}
      >
        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
        <h3
          style={{
            color: "#c25845",
            margin: "0 0 20px 0",
            textAlign: "center",
            fontSize: "18px",
            fontWeight: "bold",
          }}
        >
          Snapfix Login
        </h3>
        {error && (
          <div
            style={{
              color: "#c25845",
              marginBottom: "12px",
              fontSize: "12px",
              textAlign: "center",
            }}
          >
            {error}
          </div>
        )}
        <form
          onSubmit={handleLogin}
          style={{ display: "flex", flexDirection: "column", gap: "12px" }}
        >
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
            required
            disabled={isLoggingIn}
          />
          <div style={{ position: "relative", width: "100%" }}>
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ ...inputStyle, paddingRight: "40px" }}
              required
              disabled={isLoggingIn}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              disabled={isLoggingIn}
              style={{
                position: "absolute",
                right: "12px",
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                cursor: isLoggingIn ? "not-allowed" : "pointer",
                padding: "4px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                outline: "none",
              }}
            >
              {showPassword ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8c827a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                  <line x1="1" y1="1" x2="23" y2="23"></line>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8c827a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
              )}
            </button>
          </div>
          <button
            type="submit"
            disabled={isLoggingIn}
            style={{
              ...btnStyle,
              opacity: isLoggingIn ? 0.75 : 1,
              cursor: isLoggingIn ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
          >
            {isLoggingIn ? (
              <>
                <svg
                  style={{
                    animation: "spin 0.8s linear infinite",
                    width: "16px",
                    height: "16px",
                  }}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeOpacity="0.25"
                    strokeWidth="3"
                  />
                  <path
                    d="M12 2a10 10 0 0 1 10 10"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </svg>
                Logging in...
              </>
            ) : (
              "Login"
            )}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
        position: "relative",
      }}
    >
      {/* Top Header Actions */}
      <div style={{ padding: "16px 20px 8px 20px" }}>
        <div
          style={{
            color: "#c25845",
            fontSize: "13px",
            fontWeight: "500",
            cursor: "pointer",
            marginBottom: "8px",
            display: "inline-flex",
            alignItems: "center",
          }}
        >
          <span style={{ marginRight: "4px" }}>←</span> Back
        </div>
        <div
          style={{
            fontSize: "10px",
            fontWeight: "bold",
            color: "#8c827a",
            letterSpacing: "0.8px",
            marginBottom: "4px",
          }}
        >
          SELECT PROJECT
        </div>
      </div>

      {/* Main Form Area */}
      <div style={{ padding: "0 20px", flex: 1 }}>
        <div style={{ position: "relative" }} ref={dropdownRef}>
          {/* Custom Search Selector Input Header */}
          <div onClick={() => setIsOpen(!isOpen)} style={dropdownHeaderStyle}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                flex: 1,
                gap: "8px",
              }}
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#c25845"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input
                type="text"
                placeholder="Search projects..."
                value={
                  isOpen
                    ? searchQuery
                    : currentProject
                      ? currentProject.name
                      : ""
                }
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (!isOpen) setIsOpen(true);
                }}
                onClick={(e) => {
                  e.stopPropagation(); // Always prevent dropdown close/toggle on input click
                }}
                style={searchInputStyle}
              />
            </div>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#c25845"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                transform: isOpen ? "rotate(180deg)" : "none",
                transition: "transform 0.2s ease",
                cursor: "pointer",
              }}
            >
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </div>

          {/* Custom Dropdown Overlay Menu */}
          {isOpen && (
            <div style={dropdownOverlayStyle}>
              {filteredProjects.length === 0 ? (
                <div
                  style={{
                    padding: "12px 16px",
                    fontSize: "12px",
                    color: "#8c827a",
                  }}
                >
                  No projects found
                </div>
              ) : (
                filteredProjects.map((project) => (
                  <div
                    key={project.id}
                    onClick={() => {
                      setSelectedProjectId(project.id);
                      chrome.storage.local.set({ selectedProject: project.id });
                      setIsOpen(false);
                      setSearchQuery("");
                    }}
                    style={{
                      ...projectItemStyle,
                      backgroundColor:
                        selectedProjectId === project.id
                          ? "#F7F2EB"
                          : "transparent",
                    }}
                  >
                    <div
                      style={{
                        fontWeight: "500",
                        fontSize: "13px",
                        color: "#4A3F3A",
                      }}
                    >
                      {project.name}
                    </div>
                  </div>
                ))
              )}

              <div
                style={{
                  height: "1px",
                  backgroundColor: "#EDE7DE",
                  margin: "4px 0",
                }}
              ></div>

              <div
                onClick={() => {
                  // Stub/Action to create a project
                  alert("Redirecting to dashboard to create a new project...");
                  setIsOpen(false);
                }}
                style={createProjectActionStyle}
              >
                <span
                  style={{
                    fontSize: "16px",
                    fontWeight: "bold",
                    marginRight: "6px",
                    lineHeight: "0",
                  }}
                >
                  +
                </span>
                Create new project
              </div>
            </div>
          )}
        </div>

        {/* Start / Stop Commenting Action Button */}
        <div style={{ marginTop: "30px", marginBottom: "20px" }}>
          {isTesting ? (
            <button
              onClick={handleStopTesting}
              style={{
                ...btnStyle,
                backgroundColor: "#c25845",
                boxShadow: "0 2px 6px rgba(194, 88, 69, 0.2)",
              }}
            >
              Stop commenting
            </button>
          ) : (
            <button onClick={handleStartTesting} style={btnStyle}>
              Start commenting
            </button>
          )}
        </div>
      </div>

      {/* Footer Area */}
      <div style={footerStyle}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            fontSize: "12px",
            color: "#8c827a",
          }}
        >
          <span
            style={{
              display: "inline-block",
              width: "7px",
              height: "7px",
              borderRadius: "50%",
              backgroundColor: isTesting ? "#2ecc71" : "#8c827a",
              marginRight: "6px",
            }}
          ></span>
          {isTesting ? "Active" : "Inactive"}
        </div>
        <div onClick={handleLogout} style={signOutLinkStyle}>
          Sign out
        </div>
      </div>
    </div>
  );
};

// Styles
const inputStyle = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: "10px",
  border: "1.5px solid #EDE7DE",
  backgroundColor: "#FFF",
  color: "#4A3F3A",
  fontSize: "13px",
  boxSizing: "border-box",
  outline: "none",
  transition: "border-color 0.2s",
};

const dropdownHeaderStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "10px 14px",
  borderRadius: "12px",
  border: "1.5px solid #c25845",
  backgroundColor: "#FFF",
  cursor: "pointer",
  userSelect: "none",
};

const searchInputStyle = {
  border: "none",
  outline: "none",
  padding: "0",
  width: "100%",
  fontSize: "13px",
  color: "#4A3F3A",
  backgroundColor: "transparent",
};

const dropdownOverlayStyle = {
  position: "absolute",
  top: "calc(100% + 4px)",
  left: 0,
  right: 0,
  backgroundColor: "#FFF",
  borderRadius: "12px",
  boxShadow: "0 4px 20px rgba(0, 0, 0, 0.08)",
  border: "1px solid #EDE7DE",
  zIndex: 100,
  padding: "6px 0",
  maxHeight: "180px",
  overflowY: "auto",
};

const projectItemStyle = {
  padding: "10px 16px",
  cursor: "pointer",
  transition: "background-color 0.15s ease",
};

const createProjectActionStyle = {
  padding: "12px 16px",
  color: "#c25845",
  fontSize: "13px",
  fontWeight: "600",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  transition: "background-color 0.15s ease",
};

const btnStyle = {
  width: "100%",
  padding: "12px 10px",
  borderRadius: "24px",
  border: "none",
  backgroundColor: "#7C4DFF",
  color: "#FFF",
  fontSize: "14px",
  fontWeight: "bold",
  cursor: "pointer",
  boxShadow: "0 2px 6px rgba(124, 77, 255, 0.2)",
  transition: "background-color 0.2s ease, transform 0.1s ease",
  outline: "none",
};

const footerStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "14px 20px",
  borderTop: "1px solid #EDE7DE",
  marginTop: "10px",
};

const signOutLinkStyle = {
  color: "#c25845",
  fontSize: "12px",
  fontWeight: "500",
  cursor: "pointer",
  userSelect: "none",
};

export default Popup;
