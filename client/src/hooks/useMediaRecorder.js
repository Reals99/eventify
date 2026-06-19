import { useState, useRef, useCallback, useEffect } from 'react';

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
 * Manages getUserMedia + MediaRecorder lifecycle.
 *
 * @param {'video'|'audio'} mode
 * @param {number} maxSeconds  - auto-stop after this many seconds
 */
export default function useMediaRecorder(mode, maxSeconds = 120) {
  const [recordingState, setRecordingState] = useState(RECORDING_STATES.IDLE);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [blob, setBlob] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [audioLevel, setAudioLevel] = useState(0); // 0-100 for visualiser

  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);
  const videoPreviewRef = useRef(null); // attach stream to <video> element

  // ── Clean up on unmount ───────────────────────────────────────────────────
  useEffect(() => () => stopStream(), []);

  const stopStream = useCallback(() => {
    clearInterval(timerRef.current);
    cancelAnimationFrame(animFrameRef.current);
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

    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
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
    if (recorderRef.current && recorderRef.current.state === 'recording') {
      recorderRef.current.stop();
    }
    // Stop all tracks so camera light goes off
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
  };
}

// Format seconds → m:ss
export const fmtTime = (s) =>
  `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
