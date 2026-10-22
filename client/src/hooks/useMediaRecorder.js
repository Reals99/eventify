import { useState, useRef, useCallback, useEffect } from 'react';
import { drawCanvasFrame } from '../utils/frameRenderer';

export const RECORDING_STATES = {
  IDLE: 'idle',
  REQUESTING: 'requesting',      // asking for permissions
  READY: 'ready',                // stream acquired, not yet recording
  RECORDING: 'recording',
  PAUSED: 'paused',
  STOPPED: 'stopped',
  ERROR: 'error',
};

/**
 * useMediaRecorder
 * Manages getUserMedia + Canvas Frame Compositor + MediaRecorder lifecycle.
 *
 * @param {'video'|'audio'} mode
 * @param {number} maxSeconds  - auto-stop after this many seconds
 * @param {object} frameConfig - event branding and design frame settings
 */
export default function useMediaRecorder(mode, maxSeconds = 120, frameConfig = null) {
  const [recordingState, setRecordingState] = useState(RECORDING_STATES.IDLE);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [blob, setBlob] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [audioLevel, setAudioLevel] = useState(0); // 0-100 for visualiser

  // ── Camera adjustment state ───────────────────────────────────────────────
  const [zoom, setZoom] = useState(1.0); // 1.0 - 4.0
  const [iso, setIso] = useState(400); // 100, 200, 400, 800, 1600, 3200
  const [kelvin, setKelvin] = useState(4500); // 2700, 3200, 4500, 5600, 6500
  const [aperture, setAperture] = useState('f/2.8'); // 'f/1.4', 'f/2.0', 'f/2.8', 'f/4.0', 'f/5.6', 'f/8.0'
  const [capabilities, setCapabilities] = useState({});

  const streamRef = useRef(null);
  const canvasStreamRef = useRef(null);
  const compositeAnimRef = useRef(null);
  const isCompositingRef = useRef(false);

  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);
  const videoPreviewRef = useRef(null); // attach stream to <video> element

  const frameConfigRef = useRef(frameConfig);
  frameConfigRef.current = frameConfig;

  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  // Pre-load logo image if provided
  const logoImgRef = useRef(null);
  useEffect(() => {
    if (frameConfig?.showLogo && frameConfig?.logoUrl) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = frameConfig.logoUrl;
      img.onload = () => { logoImgRef.current = img; };
      img.onerror = () => { logoImgRef.current = null; };
    } else {
      logoImgRef.current = null;
    }
  }, [frameConfig?.showLogo, frameConfig?.logoUrl]);

  // ── Camera filter CSS helper ──────────────────────────────────────────────
  const getCameraFilter = useCallback(() => {
    const isoMap = {
      100: 'brightness(0.88) contrast(1.10)',
      200: 'brightness(0.94) contrast(1.05)',
      400: 'brightness(1.00) contrast(1.00)',
      800: 'brightness(1.14) contrast(0.97)',
      1600: 'brightness(1.26) contrast(0.94)',
      3200: 'brightness(1.40) contrast(0.90)',
    };
    const isoCss = isoMap[iso] || 'brightness(1.0) contrast(1.0)';

    const kelvinMap = {
      2700: 'sepia(0.22) saturate(1.18) hue-rotate(-12deg)',
      3200: 'sepia(0.12) saturate(1.10) hue-rotate(-6deg)',
      4500: '',
      5600: 'hue-rotate(6deg) saturate(1.05)',
      6500: 'hue-rotate(14deg) saturate(1.10)',
    };
    const kelvinCss = kelvinMap[kelvin] || '';

    const apertureMap = {
      'f/1.4': 'brightness(1.12)',
      'f/2.0': 'brightness(1.06)',
      'f/2.8': '',
      'f/4.0': 'brightness(0.96) contrast(1.04)',
      'f/5.6': 'brightness(0.92) contrast(1.08)',
      'f/8.0': 'brightness(0.86) contrast(1.12)',
    };
    const apertureCss = apertureMap[aperture] || '';

    return `${isoCss} ${kelvinCss} ${apertureCss}`.trim();
  }, [iso, kelvin, aperture]);

  const filterRef = useRef(getCameraFilter);
  filterRef.current = getCameraFilter;

  // ── Clean up on unmount ───────────────────────────────────────────────────
  useEffect(() => () => stopStream(), []);

  const stopStream = useCallback(() => {
    clearInterval(timerRef.current);
    cancelAnimationFrame(animFrameRef.current);
    cancelAnimationFrame(compositeAnimRef.current);
    isCompositingRef.current = false;

    if (canvasStreamRef.current) {
      canvasStreamRef.current.getTracks().forEach(t => t.stop());
      canvasStreamRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try { recorderRef.current.stop(); } catch (_) {}
    }
  }, []);

  // ── Start audio level analyser ────────────────────────────────────────────
  const startAnalyser = useCallback((stream) => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const tick = () => {
        if (!analyserRef.current) return;
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        setAudioLevel(Math.min(100, avg * 2));
        animFrameRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch (_) {}
  }, []);

  // ── Request permissions + acquire stream ──────────────────────────────────
  const acquireStream = useCallback(async () => {
    setRecordingState(RECORDING_STATES.REQUESTING);
    setErrorMsg('');
    try {
      const constraints =
        mode === 'video'
          ? { video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: true }
          : { video: false, audio: true };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      // Attach to preview video element if present
      if (videoPreviewRef.current && mode === 'video') {
        videoPreviewRef.current.srcObject = stream;
      }

      startAnalyser(stream);

      // Detect hardware capabilities
      try {
        const vTrack = stream.getVideoTracks()[0];
        if (vTrack?.getCapabilities) {
          setCapabilities(vTrack.getCapabilities());
        }
      } catch (_) {}

      setRecordingState(RECORDING_STATES.READY);
      return stream;
    } catch (err) {
      const msg =
        err.name === 'NotAllowedError'
          ? 'Camera/microphone permission denied. Please allow access in your browser settings.'
          : err.name === 'NotFoundError'
          ? 'No camera or microphone found on this device.'
          : `Could not access media: ${err.message}`;
      setErrorMsg(msg);
      setRecordingState(RECORDING_STATES.ERROR);
      return null;
    }
  }, [mode, startAnalyser]);

  // ── Start recording ───────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    let stream = streamRef.current;
    if (!stream) {
      stream = await acquireStream();
      if (!stream) return;
    }

    chunksRef.current = [];
    setBlob(null);
    setElapsedSeconds(0);

    let recordStream = stream;

    // ── Real-Time Canvas Compositing (Bakes frame into video stream) ─────────
    const videoEl = videoPreviewRef.current;
    const activeFrame = frameConfigRef.current;
    const shouldCompositeFrame = mode === 'video' && activeFrame && activeFrame.enabled !== false;

    if (shouldCompositeFrame && videoEl && typeof HTMLCanvasElement !== 'undefined' && HTMLCanvasElement.prototype.captureStream) {
      try {
        const canvas = document.createElement('canvas');
        const w = videoEl.videoWidth || 1280;
        const h = videoEl.videoHeight || 720;
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');

        isCompositingRef.current = true;

        const compositeLoop = () => {
          if (!isCompositingRef.current) return;

          // 1. Draw camera video (mirrored horizontally for natural selfie view)
          ctx.save();
          ctx.translate(w, 0);
          ctx.scale(-1, 1);

          const filterVal = filterRef.current ? filterRef.current() : '';
          if (filterVal) ctx.filter = filterVal;

          const currentZoom = zoomRef.current || 1.0;
          if (currentZoom > 1.0) {
            const sw = w / currentZoom;
            const sh = h / currentZoom;
            const sx = (w - sw) / 2;
            const sy = (h - sh) / 2;
            ctx.drawImage(videoEl, sx, sy, sw, sh, 0, 0, w, h);
          } else {
            ctx.drawImage(videoEl, 0, 0, w, h);
          }
          ctx.restore();

          // Reset filter before drawing crisp frame overlay
          ctx.filter = 'none';

          // 2. Burn frame overlay directly onto canvas (unmirrored for readable text)
          drawCanvasFrame(ctx, w, h, frameConfigRef.current, logoImgRef.current);

          compositeAnimRef.current = requestAnimationFrame(compositeLoop);
        };

        compositeLoop();

        const canvasStream = canvas.captureStream(30);
        canvasStreamRef.current = canvasStream;

        const audioTracks = stream.getAudioTracks();
        recordStream = audioTracks.length > 0
          ? new MediaStream([canvasStream.getVideoTracks()[0], audioTracks[0]])
          : canvasStream;
      } catch (compErr) {
        console.warn('[useMediaRecorder] Canvas compositor fallback to raw stream:', compErr);
        recordStream = stream;
      }
    }

    // Pick best supported mimeType
    const mimeTypes = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
      'video/mp4',
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4'
    ];
    const mimeType = mimeTypes.find(t => MediaRecorder.isTypeSupported(t)) || '';

    const recorder = new MediaRecorder(recordStream, mimeType ? { mimeType } : {});
    recorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const fallbackType = mode === 'video' 
        ? (MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : 'video/mp4')
        : (MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4');

      const finalBlob = new Blob(chunksRef.current, {
        type: mimeType || fallbackType,
      });
      setBlob(finalBlob);
      setRecordingState(RECORDING_STATES.STOPPED);
      clearInterval(timerRef.current);
    };

    recorder.start(200); // collect data every 200ms
    setRecordingState(RECORDING_STATES.RECORDING);

    // Elapsed timer
    timerRef.current = setInterval(() => {
      setElapsedSeconds(s => {
        if (s + 1 >= maxSeconds) {
          stopRecording();
          return s + 1;
        }
        return s + 1;
      });
    }, 1000);
  }, [acquireStream, maxSeconds, mode]);

  // ── Stop recording ────────────────────────────────────────────────────────
  const stopRecording = useCallback(() => {
    clearInterval(timerRef.current);
    isCompositingRef.current = false;
    cancelAnimationFrame(compositeAnimRef.current);

    if (recorderRef.current && recorderRef.current.state === 'recording') {
      recorderRef.current.stop();
    }
    // Stop canvas tracks
    if (canvasStreamRef.current) {
      canvasStreamRef.current.getTracks().forEach(t => t.stop());
      canvasStreamRef.current = null;
    }
    // Stop camera tracks so camera light turns off
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    cancelAnimationFrame(animFrameRef.current);
  }, []);

  // ── Reset to idle ─────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    stopStream();
    setBlob(null);
    setElapsedSeconds(0);
    setErrorMsg('');
    setAudioLevel(0);
    chunksRef.current = [];
    setRecordingState(RECORDING_STATES.IDLE);
  }, [stopStream]);

  // ── Apply camera controls ─────────────────────────────────────────────────
  const applyHardwareConstraints = useCallback((newSettings = {}) => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track || !track.applyConstraints) return;

    try {
      const caps = track.getCapabilities ? track.getCapabilities() : {};
      const advanced = {};

      const targetZoom = newSettings.zoom !== undefined ? newSettings.zoom : zoom;
      const targetIso = newSettings.iso !== undefined ? newSettings.iso : iso;
      const targetKelvin = newSettings.kelvin !== undefined ? newSettings.kelvin : kelvin;

      if (caps.zoom && targetZoom) {
        advanced.zoom = Math.min(caps.zoom.max || 4, Math.max(caps.zoom.min || 1, targetZoom));
      }
      if (caps.iso && targetIso) {
        advanced.iso = Math.min(caps.iso.max || 3200, Math.max(caps.iso.min || 100, targetIso));
      }
      if (caps.colorTemperature && targetKelvin) {
        advanced.whiteBalanceMode = 'manual';
        advanced.colorTemperature = Math.min(caps.colorTemperature.max || 7000, Math.max(caps.colorTemperature.min || 2500, targetKelvin));
      }

      if (Object.keys(advanced).length > 0) {
        track.applyConstraints({ advanced: [advanced] }).catch(() => {});
      }
    } catch (_) {}
  }, [zoom, iso, kelvin]);

  const updateZoom = useCallback((val) => {
    const num = Math.max(1.0, Math.min(4.0, Number(val)));
    setZoom(num);
    applyHardwareConstraints({ zoom: num });
  }, [applyHardwareConstraints]);

  const updateIso = useCallback((val) => {
    const num = Number(val);
    setIso(num);
    applyHardwareConstraints({ iso: num });
  }, [applyHardwareConstraints]);

  const updateKelvin = useCallback((val) => {
    const num = Number(val);
    setKelvin(num);
    applyHardwareConstraints({ kelvin: num });
  }, [applyHardwareConstraints]);

  const updateAperture = useCallback((val) => {
    setAperture(val);
  }, []);

  return {
    recordingState,
    elapsedSeconds,
    blob,
    errorMsg,
    audioLevel,
    videoPreviewRef,
    acquireStream,
    startRecording,
    stopRecording,
    reset,
    // Camera controls
    zoom,
    iso,
    kelvin,
    aperture,
    capabilities,
    updateZoom,
    updateIso,
    updateKelvin,
    updateAperture,
    getCameraFilter,
  };
}

// Format seconds → m:ss
export const fmtTime = (s) =>
  `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
