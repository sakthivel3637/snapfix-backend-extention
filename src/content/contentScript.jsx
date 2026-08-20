import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import axios from 'axios';

// Content script entry
let rootElement = null;
let reactRoot = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'START_TESTING') {
    initOverlay(message.projectId, message.token);
  } else if (message.type === 'STOP_TESTING') {
    removeOverlay();
  }
});

// Auto resume testing mode if state is saved in storage
chrome.storage.local.get(['isTesting', 'selectedProject', 'token'], (result) => {
  if (result.isTesting && result.token) {
    initOverlay(result.selectedProject, result.token);
  }
});

const initOverlay = (projectId, token) => {
  if (rootElement) return;

  rootElement = document.createElement('div');
  rootElement.id = 'snapfix-extension-root';
  rootElement.style.position = 'fixed';
  rootElement.style.top = '0';
  rootElement.style.left = '0';
  rootElement.style.width = '100vw';
  rootElement.style.height = '100vh';
  rootElement.style.pointerEvents = 'none';
  rootElement.style.zIndex = '999999';
  document.body.appendChild(rootElement);

  const shadow = rootElement.attachShadow({ mode: 'open' });
  
  // Inject shadow styles
  const style = document.createElement('style');
  style.textContent = `
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    .hover-highlight {
      outline: 2px dashed #7c4dff !important;
      background-color: rgba(124, 77, 255, 0.05) !important;
      cursor: crosshair !important;
    }
    .pin {
      position: absolute;
      width: 20px;
      height: 20px;
      background-color: #ff3366;
      border: 2px solid white;
      border-radius: 50%;
      box-shadow: 0 0 10px rgba(0,0,0,0.5);
      pointer-events: auto;
      transform: translate(-50%, -50%);
    }
    .modal-container {
      position: fixed;
      right: 20px;
      top: 20px;
      width: 380px;
      max-height: calc(100vh - 40px);
      background-color: #121216;
      color: #f3f4f6;
      border: 1px solid #3f3f50;
      border-radius: 12px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.5);
      padding: 20px;
      font-family: system-ui, -apple-system, sans-serif;
      pointer-events: auto;
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
      overflow: hidden;
      z-index: 100000;
    }
    .modal-container form {
      display: flex;
      flex-direction: column;
      flex-grow: 1;
      overflow: hidden;
      margin: 0;
    }
    .modal-body-scroll {
      flex-grow: 1;
      overflow-y: auto;
      padding-right: 6px;
      margin-bottom: 12px;
    }
    .modal-body-scroll::-webkit-scrollbar {
      width: 6px;
    }
    .modal-body-scroll::-webkit-scrollbar-track {
      background: #121216;
      border-radius: 12px;
    }
    .modal-body-scroll::-webkit-scrollbar-thumb {
      background: #3f3f50;
      border-radius: 3px;
    }
    .modal-body-scroll::-webkit-scrollbar-thumb:hover {
      background: #7c4dff;
    }
    .modal-footer-fixed {
      flex-shrink: 0;
      background-color: #121216;
      padding-top: 8px;
      border-top: 1px solid #3f3f50;
    }
    .modal-container video {
      position: static !important;
      margin: 0 0 8px 0 !important;
      display: block !important;
      width: 100% !important;
      max-height: 200px !important;
      object-fit: contain !important;
      background-color: #000 !important;
      border-radius: 6px !important;
    }
    .input-field {
      width: 100%;
      padding: 8px;
      margin-bottom: 12px;
      border: 1px solid #333;
      border-radius: 6px;
      background-color: #1f1f2e;
      color: #fff;
      box-sizing: border-box;
    }
    .btn-submit {
      width: 100%;
      padding: 10px;
      background-color: #7c4dff;
      color: white;
      font-weight: bold;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      margin-top: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: background-color 0.2s, opacity 0.2s;
    }
    .btn-submit:hover:not(:disabled) {
      background-color: #6a3de8;
    }
    .btn-submit:disabled {
      opacity: 0.75;
      cursor: not-allowed;
      background-color: #5c3bbd;
    }
    .btn-cancel {
      width: 100%;
      padding: 8px;
      background-color: #374151;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      margin-top: 5px;
      transition: opacity 0.2s;
    }
    .btn-cancel:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .audio-section {
      border: 1px solid #374151;
      padding: 10px;
      border-radius: 6px;
      margin-bottom: 12px;
      background-color: #0c0c0e;
    }
    .toolbar-container {
      position: fixed;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 16px;
      background: rgba(18, 18, 22, 0.9);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 30px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
      pointer-events: auto;
      z-index: 999999;
      color: #fff;
      font-family: system-ui, -apple-system, sans-serif;
      user-select: none;
      transition: box-shadow 0.2s ease, border-color 0.2s ease;
    }
    .toolbar-container:hover {
      border-color: rgba(124, 77, 255, 0.4);
      box-shadow: 0 10px 35px rgba(124, 77, 255, 0.2);
    }
    .drag-handle {
      cursor: move;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #8c827a;
      font-size: 16px;
      margin-right: 4px;
      padding: 2px;
    }
    .drag-handle:hover {
      color: #7c4dff;
    }
    .toolbar-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      background: transparent;
      border: none;
      color: #e3e4e6;
      padding: 6px 12px;
      border-radius: 20px;
      cursor: pointer;
      font-weight: 500;
      font-size: 13px;
      transition: all 0.2s ease;
    }
    .toolbar-btn.icon-only {
      padding: 0;
      width: 32px;
      height: 32px;
      justify-content: center;
      border-radius: 50%;
    }
    .toolbar-btn:hover {
      background: rgba(255, 255, 255, 0.08);
      color: #fff;
    }
    .toolbar-btn.active {
      background: #7c4dff;
      color: #fff;
      box-shadow: 0 0 10px rgba(124, 77, 255, 0.4);
    }
    .toolbar-btn.stop {
      background: rgba(239, 68, 68, 0.2);
      color: #ef4444;
      border: 1px solid rgba(239, 68, 68, 0.4);
    }
    .toolbar-btn.stop:hover {
      background: #ef4444;
      color: #fff;
      box-shadow: 0 0 10px rgba(239, 68, 68, 0.4);
    }
    @keyframes blink {
      0% { opacity: 1; }
      50% { opacity: 0.3; }
      100% { opacity: 1; }
    }
    .toast-notification {
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(18, 18, 22, 0.95);
      border: 1px solid #7c4dff;
      box-shadow: 0 10px 30px rgba(124, 77, 255, 0.2);
      color: #fff;
      padding: 10px 20px;
      border-radius: 30px;
      font-weight: 500;
      font-size: 14px;
      z-index: 1000000;
      pointer-events: none;
      font-family: system-ui, -apple-system, sans-serif;
    }
  `;
  shadow.appendChild(style);

  const container = document.createElement('div');
  shadow.appendChild(container);

  reactRoot = ReactDOM.createRoot(container);
  reactRoot.render(<OverlayUI projectId={projectId} token={token} shadowRoot={shadow} />);
};

const removeOverlay = () => {
  if (reactRoot) {
    reactRoot.unmount();
    reactRoot = null;
  }
  if (rootElement) {
    rootElement.remove();
    rootElement = null;
  }
};

// React component mounted inside Shadow DOM
const OverlayUI = ({ projectId, token, shadowRoot }) => {
  const [activePin, setActivePin] = useState(null); // { x, y, elInfo }
  const [showModal, setShowModal] = useState(false);
  const [screenshotData, setScreenshotData] = useState(null);

  const [recordingVideo, setRecordingVideo] = useState(false);
  const [videoBlob, setVideoBlob] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [videoScreenshotsList, setVideoScreenshotsList] = useState([]);
  const [recordingTime, setRecordingTime] = useState(0);
  const videoTimerRef = useRef(null);
  const mediaRecorderVideoRef = useRef(null);
  const videoChunksRef = useRef([]);
  const videoStartTimeRef = useRef(0);

  // Toast notification state
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  const showToast = (msg) => {
    setToastMessage(msg);
    setToastVisible(true);
    setTimeout(() => {
      setToastVisible(false);
    }, 3000);
  };

  const startVideoRecording = async () => {
    try {
      // 1. Capture screen video (and system audio if shared)
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });

      // 2. Capture mic audio
      let micStream = null;
      try {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (micErr) {
        console.warn('Microphone permission denied or not available:', micErr);
      }

      // 3. Mix audio tracks using Web Audio API if both are available, or combine tracks
      let combinedStream = null;
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const destination = audioCtx.createMediaStreamDestination();
      let hasAudio = false;

      // Add screen audio to Web Audio if available
      if (screenStream.getAudioTracks().length > 0) {
        const screenSource = audioCtx.createMediaStreamSource(new MediaStream([screenStream.getAudioTracks()[0]]));
        screenSource.connect(destination);
        screenSource.connect(audioCtx.destination); // Play screen/tab audio to user's speakers during recording
        hasAudio = true;
      }

      // Add mic audio to Web Audio if available
      if (micStream && micStream.getAudioTracks().length > 0) {
        const micSource = audioCtx.createMediaStreamSource(new MediaStream([micStream.getAudioTracks()[0]]));
        micSource.connect(destination);
        hasAudio = true;
      }

      // Combine video from screen stream + mixed audio (or fallback to screen audio/mic audio directly)
      const tracks = [...screenStream.getVideoTracks()];
      if (hasAudio) {
        tracks.push(...destination.stream.getAudioTracks());
      } else if (micStream && micStream.getAudioTracks().length > 0) {
        tracks.push(...micStream.getAudioTracks());
      }

      combinedStream = new MediaStream(tracks);

      videoChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(combinedStream, { mimeType: 'video/webm;codecs=vp9' });
      mediaRecorderVideoRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          videoChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(videoChunksRef.current, { type: 'video/webm' });
        setVideoBlob(blob);
        setVideoUrl(URL.createObjectURL(blob));
        
        // Stop all tracks in all streams
        screenStream.getTracks().forEach((track) => track.stop());
        if (micStream) {
          micStream.getTracks().forEach((track) => track.stop());
        }
        combinedStream.getTracks().forEach((track) => track.stop());
        
        // Close audio context
        audioCtx.close().catch(() => {});

        // Set active pin to general video indicator
        setActivePin({
          tag: 'VIDEO',
          id: 'video-capture',
          classes: '',
          selector: 'video',
          text: 'Video Screen Recording',
          pinX: 50,
          pinY: 50,
          absoluteX: window.innerWidth / 2,
          absoluteY: window.innerHeight / 2,
        });
        setShowModal(true);
      };

      videoStartTimeRef.current = Date.now();
      setRecordingTime(0);
      videoTimerRef.current = setInterval(() => {
        setRecordingTime(Math.floor((Date.now() - videoStartTimeRef.current) / 1000));
      }, 1000);

      mediaRecorder.start();
      setRecordingVideo(true);
      setVideoScreenshotsList([]);
      showToast('Screen recording started!');
    } catch (err) {
      console.error(err);
      alert('Screen capture permission required for video recording.');
    }
  };

  const stopVideoRecording = () => {
    if (mediaRecorderVideoRef.current && recordingVideo) {
      mediaRecorderVideoRef.current.stop();
      if (videoTimerRef.current) {
        clearInterval(videoTimerRef.current);
        videoTimerRef.current = null;
      }
      setRecordingVideo(false);
    }
  };

  const captureVideoScreenshot = () => {
    const elapsed = Math.floor((Date.now() - videoStartTimeRef.current) / 1000);
    // Temporarily hide toolbar so it's not captured in screenshot
    setToolbarVisible(false);
    setTimeout(() => {
      chrome.runtime.sendMessage({ type: 'CAPTURE_SCREENSHOT' }, (response) => {
        setToolbarVisible(true);
        if (response && response.dataUrl) {
          setVideoScreenshotsList((prev) => [...prev, { timestamp: elapsed, dataUrl: response.dataUrl }]);
          
          // Format MM:SS
          const mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
          const secs = (elapsed % 60).toString().padStart(2, '0');
          showToast(`Screenshot captured at ${mins}:${secs}!`);
        } else {
          alert('Failed to capture screenshot.');
        }
      });
    }, 150);
  };

  const formatTime = (timeInSecs) => {
    const mins = Math.floor(timeInSecs / 60).toString().padStart(2, '0');
    const secs = (timeInSecs % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  const handleScreenshotTitleChange = (index, value) => {
    setVideoScreenshotsList((prev) => {
      const newList = [...prev];
      newList[index] = { ...newList[index], title: value };
      return newList;
    });
  };

  const handleScreenshotDescriptionChange = (index, value) => {
    setVideoScreenshotsList((prev) => {
      const newList = [...prev];
      newList[index] = { ...newList[index], description: value };
      return newList;
    });
  };

  // Draggable toolbar state
  const [toolbarVisible, setToolbarVisible] = useState(true);
  const [toolbarPos, setToolbarPos] = useState({
    x: window.innerWidth / 2 - 150,
    y: window.innerHeight - 80
  });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const toolbarRef = useRef(null);

  // Annotation Drawing state
  const [drawingMode, setDrawingMode] = useState(null); // null, 'rectangle', 'circle', 'line'
  const [drawingRect, setDrawingRect] = useState(null); // { startX, startY, currentX, currentY, shape }

  const handleToolbarMouseDown = (e) => {
    if (e.target.closest('.drag-handle')) {
      setIsDragging(true);
      dragStartRef.current = {
        x: e.clientX - toolbarPos.x,
        y: e.clientY - toolbarPos.y
      };
      e.preventDefault();
    }
  };

  useEffect(() => {
    const handleMouseMoveToolbar = (e) => {
      if (!isDragging) return;
      const newX = Math.max(0, Math.min(window.innerWidth - 300, e.clientX - dragStartRef.current.x));
      const newY = Math.max(0, Math.min(window.innerHeight - 60, e.clientY - dragStartRef.current.y));
      setToolbarPos({ x: newX, y: newY });
    };

    const handleMouseUpToolbar = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMoveToolbar);
      document.addEventListener('mouseup', handleMouseUpToolbar);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMoveToolbar);
      document.removeEventListener('mouseup', handleMouseUpToolbar);
    };
  }, [isDragging]);

  const handleDrawMouseDown = (e) => {
    const isFreehand = drawingMode === 'line' || drawingMode === 'freestyle';
    setDrawingRect({
      startX: e.clientX,
      startY: e.clientY,
      currentX: e.clientX,
      currentY: e.clientY,
      shape: drawingMode,
      points: isFreehand ? [{ x: e.clientX, y: e.clientY }] : [],
    });
  };

  const handleDrawMouseMove = (e) => {
    if (!drawingRect) return;
    setDrawingRect((prev) => {
      const isFreehand = prev.shape === 'line' || prev.shape === 'freestyle';
      return {
        ...prev,
        currentX: e.clientX,
        currentY: e.clientY,
        points: isFreehand ? [...(prev.points || []), { x: e.clientX, y: e.clientY }] : prev.points,
      };
    });
  };

  const handleDrawMouseUp = () => {
    if (!drawingRect) return;

    let left = Math.min(drawingRect.startX, drawingRect.currentX);
    let top = Math.min(drawingRect.startY, drawingRect.currentY);
    let right = Math.max(drawingRect.startX, drawingRect.currentX);
    let bottom = Math.max(drawingRect.startY, drawingRect.currentY);

    if (drawingRect.shape === 'line' && drawingRect.points && drawingRect.points.length > 0) {
      const xs = drawingRect.points.map((p) => p.x);
      const ys = drawingRect.points.map((p) => p.y);
      left = Math.min(...xs);
      top = Math.min(...ys);
      right = Math.max(...xs);
      bottom = Math.max(...ys);
    }

    const width = right - left;
    const height = bottom - top;

    const isLine = drawingRect.shape === 'line' || drawingRect.shape === 'freestyle';
    const isValidLine = isLine && drawingRect.points && drawingRect.points.length > 1;
    const isValidShape = !isLine && (width > 5 && height > 5);

    if (isValidShape || isValidLine) {
      setToolbarVisible(false);

      setTimeout(() => {
        chrome.runtime.sendMessage({ type: 'CAPTURE_SCREENSHOT' }, (response) => {
          setToolbarVisible(true);

          if (response && response.dataUrl) {
            const pinX = ((left + width / 2) / window.innerWidth) * 100;
            const pinY = ((top + height / 2) / window.innerHeight) * 100;
            const absoluteX = left + width / 2 + window.scrollX;
            const absoluteY = top + height / 2 + window.scrollY;

            let id = 'annotation-rect';
            let text = 'Visual Square Annotation';
            if (drawingRect.shape === 'circle') {
              id = 'annotation-circle';
              text = 'Visual Circle Annotation';
            } else if (drawingRect.shape === 'line') {
              id = 'annotation-line';
              text = 'Visual Line Annotation';
            } else if (drawingRect.shape === 'freestyle') {
              id = 'annotation-freestyle';
              text = 'Visual Freestyle Annotation';
            }

            const pinInfo = {
              tag: 'ANNOTATION',
              id,
              classes: '',
              selector: 'annotation',
              text,
              pinX,
              pinY,
              absoluteX,
              absoluteY,
            };

            if (recordingVideo) {
              const elapsed = Math.floor((Date.now() - videoStartTimeRef.current) / 1000);
              setVideoScreenshotsList((prev) => [...prev, { timestamp: elapsed, dataUrl: response.dataUrl, pin: pinInfo }]);
              showToast(`Screenshot captured at ${formatTime(elapsed)}!`);
              setDrawingRect(null);
              setDrawingMode(null);
            } else {
              setScreenshotData(response.dataUrl);
              setActivePin(pinInfo);
              setShowModal(true);
              setDrawingMode(null);
            }
          } else {
            alert('Failed to capture screenshot. Make sure you are on a valid webpage.');
            setDrawingRect(null);
          }
        });
      }, 100);
    } else {
      setDrawingRect(null);
    }
  };

  const handleStopCommenting = () => {
    chrome.storage.local.set({ isTesting: false }, () => {
      removeOverlay();
    });
  };

  // Form Fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [expectedResult, setExpectedResult] = useState('');
  const [actualResult, setActualResult] = useState('');
  const [steps, setSteps] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [labels, setLabels] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatusText, setSubmitStatusText] = useState('Submit Bug Report');

  // Audio recording
  const [recording, setRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [audioBlob, setAudioBlob] = useState(null);
  const [voiceVisibleTo, setVoiceVisibleTo] = useState([]);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const handleVoiceVisibilityChange = (e) => {
    const role = e.target.value;
    if (e.target.checked) {
      setVoiceVisibleTo((prev) => [...prev, role]);
    } else {
      setVoiceVisibleTo((prev) => prev.filter((r) => r !== role));
    }
  };

  useEffect(() => {
    // Enable hover listener on main document DOM
    const handleMouseMove = (e) => {
      if (showModal || drawingMode) return;
      // Clear previous hover
      document.querySelectorAll('.snapfix-hover').forEach((el) => {
        el.classList.remove('hover-highlight', 'snapfix-hover');
      });

      // Highlight target element
      const target = e.target;
      if (
        target &&
        target.id !== 'snapfix-extension-root' &&
        !target.closest('#snapfix-extension-root')
      ) {
        target.classList.add('hover-highlight', 'snapfix-hover');
      }
    };

    const handleContextMenu = async (e) => {
      if (showModal || drawingMode) return;

      const target = e.target;
      if (
        target &&
        target.id !== 'snapfix-extension-root' &&
        !target.closest('#snapfix-extension-root')
      ) {
        e.preventDefault();
        e.stopPropagation();

        // Remove highlights
        document.querySelectorAll('.snapfix-hover').forEach((el) => {
          el.classList.remove('hover-highlight', 'snapfix-hover');
        });

        // Capture coordinates relative to document scroll
        const rect = target.getBoundingClientRect();
        const pinX = (e.clientX / window.innerWidth) * 100;
        const pinY = (e.clientY / window.innerHeight) * 100;

        // Calculate absolute position on page for pin rendering
        const absoluteX = e.clientX;
        const absoluteY = e.clientY;

        // Create CSS Selector
        const getSelector = (el) => {
          if (el.tagName.toLowerCase() === 'html') return 'html';
          let path = el.tagName.toLowerCase();
          if (el.id) {
            path += `#${el.id}`;
            return path;
          }
          if (el.className) {
            path += `.${el.className.split(' ').join('.')}`;
          }
          return getSelector(el.parentElement) + ' > ' + path;
        };

        const elInfo = {
          tag: target.tagName,
          id: target.id || '',
          classes: target.className || '',
          selector: getSelector(target),
          text: target.innerText?.substring(0, 50) || '',
          pinX,
          pinY,
          absoluteX,
          absoluteY,
        };

        // Hide toolbar before capturing screenshot so it doesn't show in the screenshot
        setToolbarVisible(false);
        setTimeout(() => {
          chrome.runtime.sendMessage({ type: 'CAPTURE_SCREENSHOT' }, (response) => {
            setToolbarVisible(true); // Restore toolbar visibility
            if (response && response.dataUrl) {
              if (recordingVideo) {
                const elapsed = Math.floor((Date.now() - videoStartTimeRef.current) / 1000);
                setVideoScreenshotsList((prev) => [...prev, { timestamp: elapsed, dataUrl: response.dataUrl, pin: elInfo }]);
                showToast(`Screenshot captured at ${formatTime(elapsed)}!`);
              } else {
                setScreenshotData(response.dataUrl);
                setActivePin(elInfo); // Render the pin now
                setShowModal(true);
              }
            } else {
              alert('Failed to capture screenshot. Make sure you are on a valid webpage.');
            }
          });
        }, 100);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('contextmenu', handleContextMenu, true);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('contextmenu', handleContextMenu, true);
    };
  }, [showModal, drawingMode, recordingVideo]);

  // Audio Recorder logic
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
      };

      mediaRecorder.start();
      setRecording(true);
    } catch (err) {
      alert('Microphone permission required for voice recording');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      // stop stream tracks
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
      setRecording(false);
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!title || isSubmitting) return;

    setIsSubmitting(true);
    setSubmitStatusText('Uploading screenshot...');

    try {
      // 1. Upload screenshot first
      let screenshotId = null;
      if (screenshotData) {
        setSubmitStatusText('Uploading screenshot...');
        const screenshotBlob = await (await fetch(screenshotData)).blob();
        const screenshotFile = new File([screenshotBlob], 'screenshot.png', { type: 'image/png' });
        const sFormData = new FormData();
        sFormData.append('screenshot', screenshotFile);

        const sResponse = await axios.post('http://localhost:5000/api/uploads/screenshot', sFormData, {
          headers: {
            'Content-Type': 'multipart/form-data',
            'Authorization': `Bearer ${token}`,
          },
        });
        screenshotId = sResponse.data.id;
      }

      // 2. Upload voice recording if exists
      let voiceRecordingId = null;
      if (audioBlob) {
        setSubmitStatusText('Uploading voice note...');
        const audioFile = new File([audioBlob], 'recording.webm', { type: 'audio/webm' });
        const aFormData = new FormData();
        aFormData.append('audio', audioFile);
        aFormData.append('visibleTo', JSON.stringify(voiceVisibleTo));

        const aResponse = await axios.post('http://localhost:5000/api/uploads/audio', aFormData, {
          headers: {
            'Content-Type': 'multipart/form-data',
            'Authorization': `Bearer ${token}`,
          },
        });
        voiceRecordingId = aResponse.data.id;
      }

      // Upload video if exists
      let videoRecordingId = null;
      if (videoBlob) {
        setSubmitStatusText('Uploading video recording...');
        const videoFile = new File([videoBlob], 'recording.webm', { type: 'video/webm' });
        const vFormData = new FormData();
        vFormData.append('video', videoFile);
        vFormData.append('duration', recordingTime);

        const vResponse = await axios.post('http://localhost:5000/api/uploads/video', vFormData, {
          headers: {
            'Content-Type': 'multipart/form-data',
            'Authorization': `Bearer ${token}`,
          },
        });
        videoRecordingId = vResponse.data.id;
      }

      // Upload video screenshots if exist
      const uploadedScreenshots = [];
      if (videoScreenshotsList.length > 0) {
        for (let i = 0; i < videoScreenshotsList.length; i++) {
          const screenshot = videoScreenshotsList[i];
          setSubmitStatusText(`Uploading screenshot ${i + 1}/${videoScreenshotsList.length}...`);
          const sBlob = await (await fetch(screenshot.dataUrl)).blob();
          const sFile = new File([sBlob], `screenshot-${screenshot.timestamp}.png`, { type: 'image/png' });
          const sFormData = new FormData();
          sFormData.append('screenshot', sFile);

          const sResponse = await axios.post('http://localhost:5000/api/uploads/screenshot', sFormData, {
            headers: {
              'Content-Type': 'multipart/form-data',
              'Authorization': `Bearer ${token}`,
            },
          });
          uploadedScreenshots.push({
            screenshotId: sResponse.data.id,
            timestamp: screenshot.timestamp,
            title: screenshot.title || '',
            description: screenshot.description || '',
          });
        }
      }

      // 3. Create feedback report
      setSubmitStatusText('Saving report...');
      const labelsArray = labels ? labels.split(',').map((l) => l.trim()) : [];
      
      // Collect Environment details
      const userAgent = navigator.userAgent;
      const getOS = () => {
        if (userAgent.indexOf('Win') !== -1) return 'Windows';
        if (userAgent.indexOf('Mac') !== -1) return 'macOS';
        if (userAgent.indexOf('Linux') !== -1) return 'Linux';
        if (userAgent.indexOf('Android') !== -1) return 'Android';
        if (userAgent.indexOf('like Mac') !== -1) return 'iOS';
        return 'Unknown';
      };

      const getBrowser = () => {
        if (userAgent.indexOf('Chrome') !== -1 && userAgent.indexOf('Edg') === -1 && userAgent.indexOf('OPR') === -1) return 'Chrome';
        if (userAgent.indexOf('Safari') !== -1 && userAgent.indexOf('Chrome') === -1) return 'Safari';
        if (userAgent.indexOf('Firefox') !== -1) return 'Firefox';
        if (userAgent.indexOf('Edg') !== -1) return 'Edge';
        if (userAgent.indexOf('OPR') !== -1 || userAgent.indexOf('Opera') !== -1) return 'Opera';
        return 'Unknown';
      };

      const payload = {
        projectId,
        title,
        description,
        expectedResult,
        actualResult,
        stepsToReproduce: steps,
        priority,
        url: window.location.href,
        pageTitle: document.title,
        browser: getBrowser(),
        os: getOS(),
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio || 1,
        pinX: activePin.pinX,
        pinY: activePin.pinY,
        elementTag: activePin.tag,
        elementId: activePin.id,
        elementClasses: activePin.classes,
        cssSelector: activePin.selector,
        elementText: activePin.text,
        screenshotId,
        voiceRecordingId,
        videoRecordingId,
        videoScreenshots: uploadedScreenshots,
        labels: labelsArray,
      };

      await axios.post('http://localhost:5000/api/feedback', payload, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      alert('Feedback submitted successfully!');
      handleCancel();
    } catch (err) {
      console.error(err);
      alert('Failed to submit feedback. Check server connection.');
    } finally {
      setIsSubmitting(false);
      setSubmitStatusText('Submit Bug Report');
    }
  };

  const handleCancel = () => {
    if (isSubmitting) return;
    setActivePin(null);
    setShowModal(false);
    setScreenshotData(null);
    setAudioBlob(null);
    setAudioUrl(null);
    setVoiceVisibleTo([]);
    setVideoBlob(null);
    setVideoUrl(null);
    setVideoScreenshotsList([]);
    setRecordingTime(0);
    setTitle('');
    setDescription('');
    setExpectedResult('');
    setActualResult('');
    setSteps('');
    setLabels('');
    setDrawingRect(null);
    setIsSubmitting(false);
    setSubmitStatusText('Submit Bug Report');
  };

  return (
    <>
      {activePin && activePin.tag !== 'ANNOTATION' && (
        <div
          className="pin"
          style={{ left: `${activePin.absoluteX}px`, top: `${activePin.absoluteY}px` }}
        />
      )}

      {/* Draggable Toolbar */}
      {toolbarVisible && (
        <div
          ref={toolbarRef}
          className="toolbar-container"
          style={{
            left: `${toolbarPos.x}px`,
            top: `${toolbarPos.y}px`,
          }}
          onMouseDown={handleToolbarMouseDown}
        >
          <div className="drag-handle" title="Drag Toolbar">
            <svg width="12" height="18" viewBox="0 0 12 18" fill="currentColor">
              <circle cx="2" cy="3" r="1.5" />
              <circle cx="2" cy="9" r="1.5" />
              <circle cx="2" cy="15" r="1.5" />
              <circle cx="10" cy="3" r="1.5" />
              <circle cx="10" cy="9" r="1.5" />
              <circle cx="10" cy="15" r="1.5" />
            </svg>
          </div>
          
          {recordingVideo ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ff3366', fontWeight: 'bold', fontSize: '13px', paddingRight: '4px' }}>
                <span style={{
                  display: 'inline-block',
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background: '#ff3366',
                  animation: 'blink 1s infinite'
                }} />
                <span>REC {formatTime(recordingTime)}</span>
              </div>

              <button
                type="button"
                className="toolbar-btn icon-only"
                onClick={captureVideoScreenshot}
                title="Capture screenshot at current timestamp"
                style={{ background: 'rgba(255,255,255,0.1)', color: '#fff' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              </button>

              <button
                type="button"
                className="toolbar-btn stop"
                onClick={stopVideoRecording}
                title="Stop recording"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="4" y="4" width="16" height="16" rx="2" />
                </svg>
                <span>Stop Rec</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className={`toolbar-btn icon-only ${drawingMode === 'rectangle' ? 'active' : ''}`}
                onClick={() => setDrawingMode(drawingMode === 'rectangle' ? null : 'rectangle')}
                title="Draw rectangle annotation"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" strokeDasharray="4" />
                </svg>
              </button>

              <button
                type="button"
                className={`toolbar-btn icon-only ${drawingMode === 'circle' ? 'active' : ''}`}
                onClick={() => setDrawingMode(drawingMode === 'circle' ? null : 'circle')}
                title="Draw circle annotation"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9" strokeDasharray="4" />
                </svg>
              </button>

              <button
                type="button"
                className={`toolbar-btn icon-only ${drawingMode === 'line' ? 'active' : ''}`}
                onClick={() => setDrawingMode(drawingMode === 'line' ? null : 'line')}
                title="Draw line annotation"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="4" y1="20" x2="20" y2="4" strokeDasharray="4" />
                </svg>
              </button>

              <button
                type="button"
                className={`toolbar-btn icon-only ${drawingMode === 'freestyle' ? 'active' : ''}`}
                onClick={() => setDrawingMode(drawingMode === 'freestyle' ? null : 'freestyle')}
                title="Freestyle drawing"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                </svg>
              </button>

              <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.1)' }} />

              <button
                type="button"
                className="toolbar-btn icon-only"
                onClick={startVideoRecording}
                title="Record video of screen"
                style={{ background: 'rgba(124, 77, 255, 0.1)', color: '#7c4dff' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 7a2 2 0 0 0-2.45-1.45L16 7V5a2 2 0 0 0-2-2H2a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2l4.55 1.45A2 2 0 0 0 23 17V7z" />
                </svg>
              </button>

              <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.1)' }} />

              <button
                type="button"
                className="toolbar-btn stop"
                onClick={handleStopCommenting}
                title="Stop commenting and close toolbar"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="4" y="4" width="16" height="16" rx="2" />
                </svg>
                <span>Stop</span>
              </button>
            </>
          )}
        </div>
      )}

      {/* Drawing Overlay */}
      {drawingMode && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            cursor: 'crosshair',
            zIndex: 999996,
            pointerEvents: 'auto',
            background: 'rgba(0, 0, 0, 0.05)',
          }}
          onMouseDown={handleDrawMouseDown}
          onMouseMove={handleDrawMouseMove}
          onMouseUp={handleDrawMouseUp}
        />
      )}

      {/* Visual representation of drawn shape */}
      {drawingRect && (!drawingRect.shape || drawingRect.shape === 'rectangle') && (
        <div
          style={{
            position: 'fixed',
            left: `${Math.min(drawingRect.startX, drawingRect.currentX)}px`,
            top: `${Math.min(drawingRect.startY, drawingRect.currentY)}px`,
            width: `${Math.abs(drawingRect.startX - drawingRect.currentX)}px`,
            height: `${Math.abs(drawingRect.startY - drawingRect.currentY)}px`,
            border: '3px dashed #7c4dff',
            backgroundColor: 'rgba(124, 77, 255, 0.12)',
            boxShadow: '0 0 15px rgba(124, 77, 255, 0.3)',
            pointerEvents: 'none',
            zIndex: 999997,
          }}
        />
      )}

      {drawingRect && drawingRect.shape === 'circle' && (
        <div
          style={{
            position: 'fixed',
            left: `${Math.min(drawingRect.startX, drawingRect.currentX)}px`,
            top: `${Math.min(drawingRect.startY, drawingRect.currentY)}px`,
            width: `${Math.abs(drawingRect.startX - drawingRect.currentX)}px`,
            height: `${Math.abs(drawingRect.startY - drawingRect.currentY)}px`,
            border: '3px dashed #7c4dff',
            borderRadius: '50%',
            backgroundColor: 'rgba(124, 77, 255, 0.12)',
            boxShadow: '0 0 15px rgba(124, 77, 255, 0.3)',
            pointerEvents: 'none',
            zIndex: 999997,
          }}
        />
      )}

      {drawingRect && (drawingRect.shape === 'line' || drawingRect.shape === 'freestyle') && drawingRect.points && drawingRect.points.length > 0 && (
        <svg
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            pointerEvents: 'none',
            zIndex: 999997,
          }}
        >
          <path
            d={drawingRect.points.map((p, index) => `${index === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')}
            fill="none"
            stroke="#7c4dff"
            strokeWidth="4"
            strokeDasharray={drawingRect.shape === 'line' ? '6' : 'none'}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}

      {showModal && (
        <div
          className="modal-container"
          style={
            activePin && activePin.pinX > 50
              ? { right: 'auto', left: '20px' }
              : { left: 'auto', right: '20px' }
          }
        >
          <h3 style={{ margin: '0 0 15px 0', color: '#7c4dff' }}>New Snapfix Report</h3>

          <form onSubmit={handleFormSubmit}>
            <div className="modal-body-scroll">
              <label>Title</label>
              <input
                type="text"
                className="input-field"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Broken signup button"
                required
              />

              <label>Description</label>
              <textarea
                className="input-field"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />


              <label>Priority</label>
              <select
                className="input-field"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>

              <label>Labels (comma separated)</label>
              <input
                type="text"
                className="input-field"
                value={labels}
                onChange={(e) => setLabels(e.target.value)}
                placeholder="bug, ui, forms"
              />

              {/* Video section */}
              {videoUrl && (
                <div className="audio-section" style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                    Video Recording
                  </label>
                  <video src={videoUrl} controls />
                  
                  {videoScreenshotsList.length > 0 && (
                    <div style={{ marginTop: '12px' }}>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: '#7c4dff', fontWeight: 'bold' }}>
                        Screenshot Bug Reports ({videoScreenshotsList.length})
                      </label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '240px', overflowY: 'auto', paddingRight: '4px' }}>
                        {videoScreenshotsList.map((s, idx) => (
                          <div key={idx} style={{ display: 'flex', gap: '10px', background: '#09090b', border: '1px solid #374151', borderRadius: '8px', padding: '10px' }}>
                            <div style={{ position: 'relative', width: '80px', height: '60px', borderRadius: '4px', overflow: 'hidden', flexShrink: 0, border: '1px solid #3f3f50' }}>
                              <img src={s.dataUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              <span style={{ position: 'absolute', bottom: '2px', right: '2px', background: 'rgba(0,0,0,0.85)', color: '#fff', fontSize: '8px', padding: '1px 3px', borderRadius: '2px', fontWeight: 'bold', fontFamily: 'monospace' }}>
                                {formatTime(s.timestamp)}
                              </span>
                            </div>
                            <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              <input
                                type="text"
                                className="input-field"
                                style={{ margin: 0, padding: '5px 8px', fontSize: '12px', height: 'auto' }}
                                placeholder="Screenshot Title (Bug Title)"
                                value={s.title || ''}
                                onChange={(e) => handleScreenshotTitleChange(idx, e.target.value)}
                                required
                              />
                              <textarea
                                className="input-field"
                                style={{ margin: 0, padding: '5px 8px', fontSize: '11px', height: 'auto' }}
                                rows={2}
                                placeholder="Description / Steps (optional)"
                                value={s.description || ''}
                                onChange={(e) => handleScreenshotDescriptionChange(idx, e.target.value)}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Voice section */}
              <div className="audio-section">
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                  Voice Recording Description
                </label>
                {!audioUrl ? (
                  recording ? (
                    <button type="button" className="btn-cancel" onClick={stopRecording}>
                      Stop Recording
                    </button>
                  ) : (
                    <button type="button" className="btn-submit" style={{ marginTop: 0 }} onClick={startRecording}>
                      Record Audio
                    </button>
                  )
                ) : (
                  <div>
                    <audio src={audioUrl} controls style={{ width: '100%', marginBottom: '8px' }} />
                    
                    <div style={{ marginTop: '12px', marginBottom: '12px', padding: '10px', background: '#121216', borderRadius: '6px', border: '1px solid #333' }}>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 'bold', color: '#7c4dff' }}>
                        Limit voice message visibility to:
                      </label>
                      <div style={{ display: 'flex', gap: '14px', marginTop: '6px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer', color: '#e3e4e6' }}>
                          <input
                            type="checkbox"
                            value="ADMIN"
                            checked={voiceVisibleTo.includes('ADMIN')}
                            onChange={handleVoiceVisibilityChange}
                            style={{ cursor: 'pointer', accentColor: '#7c4dff' }}
                          />
                          Admin
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer', color: '#e3e4e6' }}>
                          <input
                            type="checkbox"
                            value="TESTER"
                            checked={voiceVisibleTo.includes('TESTER')}
                            onChange={handleVoiceVisibilityChange}
                            style={{ cursor: 'pointer', accentColor: '#7c4dff' }}
                          />
                          Tester
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer', color: '#e3e4e6' }}>
                          <input
                            type="checkbox"
                            value="DEVELOPER"
                            checked={voiceVisibleTo.includes('DEVELOPER')}
                            onChange={handleVoiceVisibilityChange}
                            style={{ cursor: 'pointer', accentColor: '#7c4dff' }}
                          />
                          Developer
                        </label>
                      </div>
                      <span style={{ display: 'block', fontSize: '10px', color: '#8c827a', marginTop: '8px', lineHeight: '1.3' }}>
                        If no roles are checked, the voice message remains visible to everyone.
                      </span>
                    </div>

                    <button
                      type="button"
                      className="btn-cancel"
                      onClick={() => {
                        setAudioUrl(null);
                        setAudioBlob(null);
                        setVoiceVisibleTo([]);
                      }}
                    >
                      Delete & Re-record
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer-fixed">
              <button type="submit" className="btn-submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <svg
                      style={{
                        animation: 'spin 0.8s linear infinite',
                        width: '16px',
                        height: '16px',
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
                    <span>{submitStatusText}</span>
                  </>
                ) : (
                  'Submit Bug Report'
                )}
              </button>
              <button
                type="button"
                className="btn-cancel"
                onClick={handleCancel}
                disabled={isSubmitting}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {toastVisible && (
        <div className="toast-notification">
          {toastMessage}
        </div>
      )}

      {/* Floating Preview Bar during recording */}
      {recordingVideo && videoScreenshotsList.length > 0 && (
        <div
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            display: 'flex',
            gap: '8px',
            padding: '8px 12px',
            background: 'rgba(18, 18, 22, 0.95)',
            backdropFilter: 'blur(10px)',
            border: '1px solid #7c4dff',
            borderRadius: '12px',
            boxShadow: '0 10px 25px rgba(124, 77, 255, 0.25)',
            zIndex: 999999,
            pointerEvents: 'auto',
            fontFamily: 'system-ui, sans-serif'
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', marginRight: '4px' }}>
            <span style={{ fontSize: '11px', color: '#7c4dff', fontWeight: 'bold' }}>SCREENS ({videoScreenshotsList.length})</span>
            <span style={{ fontSize: '9px', color: '#aaa' }}>Click to report</span>
          </div>
          <div style={{ display: 'flex', gap: '6px', maxHeight: '50px', overflowX: 'auto' }}>
            {videoScreenshotsList.map((s, idx) => (
              <div
                key={idx}
                onClick={() => {
                  stopVideoRecording();
                  setScreenshotData(s.dataUrl);
                  setActivePin(s.pin || {
                    tag: 'SCREENSHOT',
                    id: 'timeline-screenshot',
                    classes: '',
                    selector: 'body',
                    text: `Screenshot at ${formatTime(s.timestamp)}`,
                    pinX: 50,
                    pinY: 50,
                    absoluteX: window.innerWidth / 2,
                    absoluteY: window.innerHeight / 2,
                  });
                  setShowModal(true);
                }}
                style={{
                  position: 'relative',
                  border: '1px solid #333',
                  borderRadius: '6px',
                  overflow: 'hidden',
                  width: '50px',
                  height: '40px',
                  cursor: 'pointer',
                  transition: 'border-color 0.2s',
                }}
                title="Click to pause recording and create report for this screenshot"
              >
                <img src={s.dataUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <span style={{
                  position: 'absolute',
                  bottom: '1px',
                  right: '1px',
                  background: 'rgba(0,0,0,0.85)',
                  color: '#fff',
                  fontSize: '8px',
                  padding: '1px 2px',
                  borderRadius: '2px',
                  fontFamily: 'monospace'
                }}>
                  {formatTime(s.timestamp)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
};
