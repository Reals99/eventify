import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import api from '../utils/api';
import useMediaRecorder, { RECORDING_STATES, fmtTime } from '../hooks/useMediaRecorder';
import AudioVisualiser from '../components/AudioVisualiser';
import PulseRings from '../components/PulseRings';
import KioskFrameOverlay from '../components/KioskFrameOverlay';
import uploadQueue from '../utils/uploadQueue';
import '../styles/kiosk.css';

// ── Kiosk screens ─────────────────────────────────────────────────────────
const SCREENS = {
  LOADING: 'loading',
  ERROR: 'error',
  IDLE: 'idle',
  PHASE: 'phase',         // before / after
  MODE: 'mode',           // video / audio
  NAME: 'name',           // optional guest name
  RECORD: 'record',       // live recording
  REVIEW: 'review',       // playback before submitting
  UPLOADING: 'uploading',
  DONE: 'done',
};

export default function KioskPage() {
  const { slug } = useParams();
  const [event, setEvent] = useState(null);
  const [screen, setScreen] = useState(SCREENS.LOADING);
  const [loadError, setLoadError] = useState('');

  // Guest choices
  const [phase, setPhase] = useState('');      // 'expectation' | 'takeaway'
  const [recMode, setRecMode] = useState('');  // 'video' | 'audio'
  const [guestName, setGuestName] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState('');

  // Inactivity auto-reset
  const inactivityRef = useRef(null);

  // Background upload queue state
  const [queueState, setQueueState] = useState(uploadQueue.getState());
  const [showQueueModal, setShowQueueModal] = useState(false);

  // Camera & Ring Light features
  const [ringLight, setRingLight] = useState(false);
  const [ringLightTemp, setRingLightTemp] = useState('neutral'); // 'warm' | 'neutral' | 'cool'
  const [ringLightBrightness, setRingLightBrightness] = useState(85);
  const [showCamControls, setShowCamControls] = useState(false);

  // Subscribe to background upload queue
  useEffect(() => {
    return uploadQueue.subscribe((st) => setQueueState(st));
  }, []);

  // Frame configuration for compositor & live overlay
  const frameConfig = {
    enabled: event?.frame?.enabled !== false,
    style: event?.frame?.style || 'minimal',
    eventName: event?.name || '',
    guestName: guestName || 'Guest',
    eventDate: event?.date,
    primaryColor: event?.theme?.primaryColor || '#7F77DD',
    secondaryColor: event?.theme?.secondaryColor || '#EEEDFE',
    accentColor: event?.theme?.accentColor || '#3C3489',
    fontStyle: event?.theme?.fontStyle || 'modern',
    showEventTitle: event?.frame?.showEventTitle !== false,
    showGuestName: event?.frame?.showGuestName !== false,
    showDate: Boolean(event?.frame?.showDate),
    showLogo: Boolean(event?.frame?.showLogo),
    logoUrl: event?.frame?.logoUrl || '',
    textPosition: event?.frame?.textPosition || 'bottom',
  };

  // Recording hook — reinitialised when recMode changes
  const recorder = useMediaRecorder(recMode || 'video', event?.kiosk?.maxRecordingSeconds || 120, frameConfig);

  // ── Load event by slug ───────────────────────────────────────────────────
  useEffect(() => {
    if (!slug) { setLoadError('No event slug provided.'); setScreen(SCREENS.ERROR); return; }
    api.get(`/events/slug/${slug}`)
      .then(({ data }) => { setEvent(data.event); setScreen(SCREENS.IDLE); })
      .catch(err => {
        setLoadError(err.response?.data?.error || 'Event not found or not active.');
        setScreen(SCREENS.ERROR);
      });
  }, [slug]);

  // ── Apply event theme as CSS vars ────────────────────────────────────────
  useEffect(() => {
    if (!event?.theme) return;
    const root = document.documentElement;
    root.style.setProperty('--kiosk-primary',   event.theme.primaryColor   || '#7F77DD');
    root.style.setProperty('--kiosk-secondary',  event.theme.secondaryColor || '#EEEDFE');
    root.style.setProperty('--kiosk-accent',     event.theme.accentColor    || '#3C3489');
    root.style.setProperty('--kiosk-bg',         event.theme.secondaryColor || '#EEEDFE');
    root.style.setProperty('--kiosk-surface',    '#ffffff');
    return () => {
      ['--kiosk-primary','--kiosk-secondary','--kiosk-accent','--kiosk-bg','--kiosk-surface']
        .forEach(v => root.style.removeProperty(v));
    };
  }, [event]);

  // ── Inactivity reset (90 seconds) ────────────────────────────────────────
  const resetInactivity = useCallback(() => {
    clearTimeout(inactivityRef.current);
    inactivityRef.current = setTimeout(() => goIdle(), 90_000);
  }, []);

  const goIdle = useCallback(() => {
    recorder.reset();
    setPhase('');
    setRecMode('');
    setGuestName('');
    setUploadProgress(0);
    setUploadError('');
    setScreen(SCREENS.IDLE);
  }, [recorder]);

  useEffect(() => {
    if (screen !== SCREENS.IDLE && screen !== SCREENS.LOADING && screen !== SCREENS.ERROR) {
      resetInactivity();
    }
    return () => clearTimeout(inactivityRef.current);
  }, [screen, resetInactivity]);

  // ── Auto-reset when DONE screen shown (3.5 s for fast guest turnover) ────
  useEffect(() => {
    if (screen !== SCREENS.DONE) return;
    const t = setTimeout(goIdle, 3500);
    return () => clearTimeout(t);
  }, [screen, goIdle]);

  // ── Queue recording for background upload (instant handoff) ───────────────
  const submitRecording = useCallback(() => {
    if (!recorder.blob) return;

    const ext = 'webm';
    const filename = `${(guestName || 'guest').replace(/\s+/g, '_')}_${phase}_${Date.now()}.${ext}`;

    // Add to background queue — network upload happens asynchronously
    uploadQueue.enqueue({
      blob: recorder.blob,
      filename,
      eventId: event._id,
      guestName: guestName || 'Anonymous',
      phase,
      recordingType: recMode,
      isFramed: event?.frame?.enabled !== false,
    });

    // Instantly transition to DONE so the next person can record!
    setScreen(SCREENS.DONE);
  }, [recorder.blob, recMode, guestName, phase, event]);

  // ── Theme shortcuts ──────────────────────────────────────────────────────
  const primary = event?.theme?.primaryColor || '#7F77DD';
  const accent  = event?.theme?.accentColor  || '#3C3489';

  const ringLightVars = ringLight ? {
    '--ring-color': ringLightTemp === 'warm' ? '#FFE8C8' : ringLightTemp === 'cool' ? '#E6F4FF' : '#FFFFFF',
    '--ring-glow': ringLightTemp === 'warm'
      ? `rgba(255, 215, 160, ${ringLightBrightness / 100})`
      : ringLightTemp === 'cool'
      ? `rgba(215, 235, 255, ${ringLightBrightness / 100})`
      : `rgba(255, 255, 255, ${ringLightBrightness / 100})`,
    '--ring-ambient': ringLightTemp === 'warm'
      ? 'rgba(255, 215, 160, 0.45)'
      : ringLightTemp === 'cool'
      ? 'rgba(215, 235, 255, 0.45)'
      : 'rgba(255, 255, 255, 0.5)',
  } : {};

  // ── Screen renders ───────────────────────────────────────────────────────

  if (screen === SCREENS.LOADING) {
    return (
      <div className="kiosk-root" style={{ '--kiosk-bg': '#EEEDFE' }}>
        <div className="kiosk-screen">
          <span className="spinner" style={{ width: 40, height: 40, borderWidth: 4 }} />
        </div>
      </div>
    );
  }

  if (screen === SCREENS.ERROR) {
    return (
      <div className="kiosk-root" style={{ '--kiosk-bg': '#FAECE7' }}>
        <div className="kiosk-screen" style={{ gap: 16 }}>
          <div style={{ fontSize: 56 }}>😕</div>
          <h2 className="kiosk-h1">Event not found</h2>
          <p className="kiosk-p">{loadError}</p>
        </div>
      </div>
    );
  }

  // ── IDLE ─────────────────────────────────────────────────────────────────
  if (screen === SCREENS.IDLE) {
    return (
      <div className="kiosk-root">
        <QueueIndicator queueState={queueState} onOpen={() => setShowQueueModal(true)} />

        {/* Header */}
        <div className="kiosk-idle-header">
          <div className="kiosk-event-badge">{event.name}</div>
          <p className="kiosk-event-sub">
            {event.date ? new Date(event.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}
            {event.location ? ` · ${event.location}` : ''}
          </p>
        </div>

        {/* Center button */}
        <div className="kiosk-screen">
          <div className="kiosk-big-btn-wrap">
            <PulseRings color={primary} size={200} />
            <button
              className="kiosk-big-btn"
              onClick={() => setScreen(SCREENS.PHASE)}
              aria-label="Start recording"
            >
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" y1="19" x2="12" y2="23"/>
                <line x1="8" y1="23" x2="16" y2="23"/>
              </svg>
              <span>Tap to record</span>
            </button>
          </div>

          <p className="kiosk-p" style={{ marginTop: 24, maxWidth: 340 }}>
            {event.kiosk?.welcomeMessage || 'Share your expectations or takeaway!'}
          </p>
        </div>

        {/* Footer */}
        <div className="kiosk-idle-footer">
          <p style={{ fontSize: 12, opacity: 0.4, color: accent }}>Powered by Eventify</p>
        </div>

        {showQueueModal && (
          <QueueModal
            queueState={queueState}
            onClose={() => setShowQueueModal(false)}
          />
        )}
      </div>
    );
  }

  // ── PHASE: before / after ─────────────────────────────────────────────────
  if (screen === SCREENS.PHASE) {
    return (
      <div className="kiosk-root">
        <div className="kiosk-screen" style={{ gap: 24, maxWidth: 560, margin: '0 auto', width: '100%' }}>
          <h1 className="kiosk-h1">Are you arriving or leaving?</h1>
          <p className="kiosk-p">Choose the type of message you'd like to leave</p>

          <div className="kiosk-mode-grid" style={{ marginTop: 8 }}>
            <PhaseCard
              icon="✨"
              title="Expectation"
              desc="Before the event — what are you hoping for?"
              selected={phase === 'expectation'}
              onClick={() => setPhase('expectation')}
              primary={primary}
            />
            <PhaseCard
              icon="🏁"
              title="Takeaway"
              desc="After the event — what did you take away?"
              selected={phase === 'takeaway'}
              onClick={() => setPhase('takeaway')}
              primary={primary}
            />
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <button className="kiosk-btn kiosk-btn-ghost" onClick={goIdle}>← Back</button>
            <button
              className="kiosk-btn kiosk-btn-primary"
              disabled={!phase}
              onClick={() => setScreen(
                (event.kiosk?.allowVideo && event.kiosk?.allowAudio) ? SCREENS.MODE :
                event.kiosk?.allowVideo ? (setRecMode('video'), SCREENS.NAME) :
                (setRecMode('audio'), SCREENS.NAME)
              )}
            >
              Continue →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── MODE: video / audio ───────────────────────────────────────────────────
  if (screen === SCREENS.MODE) {
    return (
      <div className="kiosk-root">
        <div className="kiosk-screen" style={{ gap: 24, maxWidth: 560, margin: '0 auto', width: '100%' }}>
          <h1 className="kiosk-h1">How would you like to record?</h1>

          <div className="kiosk-mode-grid">
            {event.kiosk?.allowVideo !== false && (
              <div
                className={`kiosk-mode-card${recMode === 'video' ? ' selected' : ''}`}
                onClick={() => setRecMode('video')}
                style={{ borderColor: recMode === 'video' ? primary : 'transparent' }}
              >
                <span className="kiosk-mode-icon">🎥</span>
                <div className="kiosk-mode-title">Video</div>
                <div className="kiosk-mode-desc">Face camera, see yourself on screen</div>
              </div>
            )}
            {event.kiosk?.allowAudio !== false && (
              <div
                className={`kiosk-mode-card${recMode === 'audio' ? ' selected' : ''}`}
                onClick={() => setRecMode('audio')}
                style={{ borderColor: recMode === 'audio' ? primary : 'transparent' }}
              >
                <span className="kiosk-mode-icon">🎙️</span>
                <div className="kiosk-mode-title">Audio only</div>
                <div className="kiosk-mode-desc">Voice recording, no camera needed</div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button className="kiosk-btn kiosk-btn-ghost" onClick={() => setScreen(SCREENS.PHASE)}>← Back</button>
            <button
              className="kiosk-btn kiosk-btn-primary"
              disabled={!recMode}
              onClick={() => setScreen(event.kiosk?.askGuestName !== false ? SCREENS.NAME : SCREENS.RECORD)}
            >
              Continue →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── NAME: optional guest name ─────────────────────────────────────────────
  if (screen === SCREENS.NAME) {
    return (
      <div className="kiosk-root">
        <div className="kiosk-screen" style={{ gap: 24, maxWidth: 480, margin: '0 auto', width: '100%' }}>
          <h1 className="kiosk-h1">What's your name?</h1>
          <p className="kiosk-p">Optional — leave blank to stay anonymous</p>

          <input
            className="kiosk-name-input"
            type="text"
            value={guestName}
            onChange={e => setGuestName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && setScreen(SCREENS.RECORD)}
            placeholder="Your name…"
            maxLength={60}
            autoFocus
          />

          <div style={{ display: 'flex', gap: 12 }}>
            <button className="kiosk-btn kiosk-btn-ghost"
              onClick={() => setScreen(
                event.kiosk?.allowVideo && event.kiosk?.allowAudio ? SCREENS.MODE : SCREENS.PHASE
              )}>
              ← Back
            </button>
            <button className="kiosk-btn kiosk-btn-primary"
              onClick={() => setScreen(SCREENS.RECORD)}>
              {guestName.trim() ? 'Continue →' : 'Skip →'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── RECORD ────────────────────────────────────────────────────────────────
  if (screen === SCREENS.RECORD) {
    const isRecording = recorder.recordingState === RECORDING_STATES.RECORDING;
    const isReady     = recorder.recordingState === RECORDING_STATES.READY;
    const isIdle      = recorder.recordingState === RECORDING_STATES.IDLE;
    const maxSecs     = event.kiosk?.maxRecordingSeconds || 120;
    const progress    = (recorder.elapsedSeconds / maxSecs) * 100;

    return (
      <div className={`kiosk-root ${ringLight ? 'kiosk-ringlight-active' : ''}`} style={ringLightVars}>
        <div className="kiosk-screen" style={{ gap: 14, maxWidth: 620, margin: '0 auto', width: '100%' }}>
          {/* Phase + name badge */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 2 }}>
            <span style={{
              padding: '4px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600,
              background: primary, color: '#fff',
            }}>
              {phase === 'expectation' ? '✨ Before' : '🏁 After'}
            </span>
            {guestName && (
              <span style={{
                padding: '4px 14px', borderRadius: 20, fontSize: 13,
                background: 'rgba(0,0,0,0.1)', color: accent,
              }}>
                {guestName}
              </span>
            )}
          </div>

          <h1 className="kiosk-h1" style={{ fontSize: 'clamp(18px,3vw,28px)' }}>
            {!isRecording && !isReady && !isIdle ? '' :
             isRecording ? 'Recording… speak clearly!' :
             'Ready — tap Start when ready'}
          </h1>

          {/* Preview area */}
          <div className={`kiosk-preview-wrap ${ringLight ? 'kiosk-ringlight-border-preview active' : ''}`} style={{ overflow: 'hidden', position: 'relative' }}>
            {recMode === 'video' ? (
              <>
                <video
                  ref={recorder.videoPreviewRef}
                  className="kiosk-preview-video"
                  autoPlay
                  muted
                  playsInline
                  style={{
                    transform: `scaleX(-1) scale(${recorder.zoom})`,
                    filter: recorder.getCameraFilter(),
                    transition: 'transform 0.15s ease, filter 0.15s ease',
                  }}
                />
                {/* Live Frame Overlay over camera preview */}
                {event?.frame?.enabled !== false && (
                  <KioskFrameOverlay
                    frame={event?.frame}
                    theme={event?.theme}
                    eventName={event?.name}
                    guestName={guestName}
                    eventDate={event?.date}
                  />
                )}
                {isRecording && (
                  <div className="kiosk-rec-overlay" style={{ zIndex: 20 }}>
                    <div className="kiosk-rec-dot" />
                    <span className="kiosk-rec-timer">{fmtTime(recorder.elapsedSeconds)}</span>
                  </div>
                )}
              </>
            ) : (
              <div style={{ padding: '24px 20px', background: event.theme?.secondaryColor || '#EEEDFE' }}>
                <AudioVisualiser
                  audioLevel={recorder.audioLevel}
                  primaryColor={primary}
                  isRecording={isRecording}
                />
                {isRecording && (
                  <div style={{ textAlign: 'center', marginTop: 12 }}>
                    <div className="kiosk-rec-overlay" style={{ position: 'relative', display: 'inline-flex', background: 'rgba(0,0,0,0.5)', top: 'auto', right: 'auto' }}>
                      <div className="kiosk-rec-dot" />
                      <span className="kiosk-rec-timer">{fmtTime(recorder.elapsedSeconds)}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Time progress bar */}
            {isRecording && (
              <div className="kiosk-progress-bar-wrap">
                <div className="kiosk-progress-bar" style={{ width: `${progress}%` }} />
              </div>
            )}
          </div>

          {/* Camera Controls & Ring Light Toolbar (shown when video mode is active) */}
          {recMode === 'video' && !isRecording && (
            <div className="kiosk-cam-toolbar">
              <button
                type="button"
                className={`kiosk-tool-pill ${ringLight ? 'active' : ''}`}
                onClick={() => setRingLight(!ringLight)}
              >
                💡 Ring Light {ringLight ? 'ON' : 'OFF'}
              </button>
              <button
                type="button"
                className={`kiosk-tool-pill ${showCamControls ? 'active' : ''}`}
                onClick={() => setShowCamControls(!showCamControls)}
              >
                ⚙️ Camera ({recorder.aperture} · ISO {recorder.iso} · {recorder.kelvin}K · {recorder.zoom}x)
              </button>
            </div>
          )}

          {/* Interactive Adjustments Drawer */}
          {recMode === 'video' && showCamControls && !isRecording && (
            <div className="kiosk-adjustments-card">
              {/* Zoom */}
              <div className="kiosk-adj-row">
                <div className="kiosk-adj-label">
                  <span>Zoom</span>
                  <span>{recorder.zoom.toFixed(1)}x</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input
                    type="range"
                    min="1.0"
                    max="3.5"
                    step="0.1"
                    value={recorder.zoom}
                    onChange={(e) => recorder.updateZoom(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <div className="kiosk-pills-group" style={{ padding: 0 }}>
                    {[1.0, 1.5, 2.0, 2.5].map((z) => (
                      <button
                        key={z}
                        type="button"
                        className={`kiosk-sub-pill ${recorder.zoom === z ? 'selected' : ''}`}
                        onClick={() => recorder.updateZoom(z)}
                      >
                        {z}x
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* ISO */}
              <div className="kiosk-adj-row">
                <div className="kiosk-adj-label">
                  <span>Sensor Sensitivity (ISO)</span>
                  <span>ISO {recorder.iso}</span>
                </div>
                <div className="kiosk-pills-group">
                  {[100, 200, 400, 800, 1600, 3200].map((i) => (
                    <button
                      key={i}
                      type="button"
                      className={`kiosk-sub-pill ${recorder.iso === i ? 'selected' : ''}`}
                      onClick={() => recorder.updateIso(i)}
                    >
                      {i}
                    </button>
                  ))}
                </div>
              </div>

              {/* White Balance */}
              <div className="kiosk-adj-row">
                <div className="kiosk-adj-label">
                  <span>White Balance (Color Temp)</span>
                  <span>{recorder.kelvin}K</span>
                </div>
                <div className="kiosk-pills-group">
                  {[
                    { k: 2700, label: '2700K 🕯️ Warm' },
                    { k: 3200, label: '3200K 💡 Indoor' },
                    { k: 4500, label: '4500K ☀️ Studio' },
                    { k: 5600, label: '5600K ⛅ Day' },
                    { k: 6500, label: '6500K ❄️ Cool' },
                  ].map(({ k, label }) => (
                    <button
                      key={k}
                      type="button"
                      className={`kiosk-sub-pill ${recorder.kelvin === k ? 'selected' : ''}`}
                      onClick={() => recorder.updateKelvin(k)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Aperture */}
              <div className="kiosk-adj-row">
                <div className="kiosk-adj-label">
                  <span>Aperture (Exposure & Softness)</span>
                  <span>{recorder.aperture}</span>
                </div>
                <div className="kiosk-pills-group">
                  {[
                    { a: 'f/1.4', label: 'f/1.4 Soft & Bright' },
                    { a: 'f/2.0', label: 'f/2.0' },
                    { a: 'f/2.8', label: 'f/2.8 Standard' },
                    { a: 'f/4.0', label: 'f/4.0' },
                    { a: 'f/8.0', label: 'f/8.0 Deep' },
                  ].map(({ a, label }) => (
                    <button
                      key={a}
                      type="button"
                      className={`kiosk-sub-pill ${recorder.aperture === a ? 'selected' : ''}`}
                      onClick={() => recorder.updateAperture(a)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Ring Light Customizer when active */}
              {ringLight && (
                <div className="kiosk-adj-row" style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(0,0,0,0.08)' }}>
                  <div className="kiosk-adj-label">
                    <span>Ring Light Settings</span>
                    <span>{ringLightTemp} · {ringLightBrightness}%</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {['warm', 'neutral', 'cool'].map((t) => (
                      <button
                        key={t}
                        type="button"
                        className={`kiosk-sub-pill ${ringLightTemp === t ? 'selected' : ''}`}
                        onClick={() => setRingLightTemp(t)}
                      >
                        {t === 'warm' ? '🌅 Warm' : t === 'cool' ? '❄️ Cool' : '⚪ Neutral'}
                      </button>
                    ))}
                    {[50, 80, 100].map((b) => (
                      <button
                        key={b}
                        type="button"
                        className={`kiosk-sub-pill ${ringLightBrightness === b ? 'selected' : ''}`}
                        onClick={() => setRingLightBrightness(b)}
                      >
                        {b}%
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Time remaining */}
          {isRecording && (
            <p className="kiosk-p" style={{ fontSize: 13, opacity: 0.6 }}>
              {maxSecs - recorder.elapsedSeconds}s remaining · tap Stop when done
            </p>
          )}

          {/* Error */}
          {recorder.errorMsg && (
            <div className="alert alert-error" style={{ maxWidth: 480, width: '100%' }}>
              {recorder.errorMsg}
            </div>
          )}

          {/* Controls */}
          <div className="kiosk-ctrl-row">
            {/* Cancel */}
            <button className="kiosk-ctrl-btn cancel" onClick={() => { recorder.reset(); setScreen(SCREENS.NAME); }}>
              ✕
            </button>

            {/* Start / Stop */}
            {!isRecording ? (
              <button
                className="kiosk-ctrl-btn start"
                onClick={() => recorder.startRecording()}
                style={{ background: primary }}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="12" r="6"/>
                </svg>
              </button>
            ) : (
              <button className="kiosk-ctrl-btn stop" onClick={() => {
                recorder.stopRecording();
                setTimeout(() => setScreen(SCREENS.REVIEW), 600);
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="4" y="4" width="16" height="16" rx="2"/>
                </svg>
              </button>
            )}
          </div>

          {/* Acquire stream hint before recording starts */}
          {(isIdle) && (
            <button className="kiosk-btn kiosk-btn-primary" onClick={() => recorder.acquireStream()}>
              Allow camera / mic access
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── REVIEW ────────────────────────────────────────────────────────────────
  if (screen === SCREENS.REVIEW) {
    const blobUrl = recorder.blob ? URL.createObjectURL(recorder.blob) : null;

    return (
      <div className="kiosk-root">
        <div className="kiosk-screen" style={{ gap: 20, maxWidth: 560, margin: '0 auto', width: '100%' }}>
          <h1 className="kiosk-h1">Review your recording</h1>
          <p className="kiosk-p">Happy with it? Submit, or re-record.</p>

          {blobUrl && (
            recMode === 'video' ? (
              <video
                src={blobUrl}
                controls
                style={{
                  width: '100%', borderRadius: 16,
                  boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                }}
              />
            ) : (
              <div style={{
                width: '100%', padding: 24, borderRadius: 16,
                background: event.theme?.secondaryColor,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
              }}>
                <div style={{ fontSize: 48 }}>🎙️</div>
                <audio src={blobUrl} controls style={{ width: '100%' }} />
              </div>
            )
          )}

          {uploadError && <div className="alert alert-error" style={{ width: '100%' }}>{uploadError}</div>}

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button className="kiosk-btn kiosk-btn-ghost"
              onClick={() => { recorder.reset(); setScreen(SCREENS.RECORD); }}>
              🔄 Re-record
            </button>
            <button className="kiosk-btn kiosk-btn-primary"
              onClick={submitRecording}
              style={{ background: primary }}>
              ✓ Submit recording
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── UPLOADING ─────────────────────────────────────────────────────────────
  if (screen === SCREENS.UPLOADING) {
    return (
      <div className="kiosk-root">
        <div className="kiosk-screen" style={{ gap: 20 }}>
          <div style={{ fontSize: 52 }}>📤</div>
          <h1 className="kiosk-h1">Saving your recording…</h1>
          <div className="kiosk-upload-bar-wrap">
            <div className="kiosk-upload-bar" style={{ width: `${uploadProgress}%` }} />
          </div>
          <p className="kiosk-p" style={{ fontSize: 13 }}>{uploadProgress}%</p>
        </div>
      </div>
    );
  }

  // ── DONE ──────────────────────────────────────────────────────────────────
  if (screen === SCREENS.DONE) {
    return (
      <div className="kiosk-root">
        <QueueIndicator queueState={queueState} onOpen={() => setShowQueueModal(true)} />

        <div className="kiosk-screen" style={{ gap: 16 }}>
          <div className="kiosk-done-icon">
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#1D9E75" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <h1 className="kiosk-h1">Thank you{guestName ? `, ${guestName}` : ''}!</h1>
          <p className="kiosk-p" style={{ maxWidth: 380 }}>
            Your {phase} is queued and saving in the background. Next person can record immediately!
            {event?.frame?.enabled ? ' Your video has been recorded with the event frame applied.' : ''}
          </p>
          <button className="kiosk-btn kiosk-btn-primary" onClick={goIdle}
            style={{ background: primary, marginTop: 12 }}>
            Record another →
          </button>
          <p style={{ fontSize: 12, opacity: 0.5, color: accent, marginTop: 8 }}>
            Returning to home in 3 seconds…
          </p>
        </div>

        {showQueueModal && (
          <QueueModal
            queueState={queueState}
            onClose={() => setShowQueueModal(false)}
          />
        )}
      </div>
    );
  }

  return null;
}

// ── Helper sub-components ────────────────────────────────────────────────────

function QueueIndicator({ queueState, onOpen }) {
  if (!queueState.pendingCount && !queueState.failedCount && !queueState.completedCount) return null;
  return (
    <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 60 }}>
      {queueState.pendingCount > 0 && (
        <div className="kiosk-queue-badge" onClick={onOpen}>
          <div className="kiosk-sync-spinner" />
          <span>Syncing ({queueState.pendingCount}) {queueState.currentProgress > 0 ? `${queueState.currentProgress}%` : ''}</span>
        </div>
      )}
      {queueState.pendingCount === 0 && queueState.failedCount > 0 && (
        <div className="kiosk-queue-badge" onClick={onOpen} style={{ borderColor: '#FF4444', color: '#D9383A' }}>
          <span>⚠️ {queueState.failedCount} failed (Tap to view)</span>
        </div>
      )}
      {queueState.pendingCount === 0 && queueState.failedCount === 0 && queueState.completedCount > 0 && (
        <div className="kiosk-queue-badge" onClick={onOpen} style={{ color: '#1D9E75' }}>
          <span>✓ All saved ({queueState.completedCount})</span>
        </div>
      )}
    </div>
  );
}

function QueueModal({ queueState, onClose }) {
  return (
    <div className="kiosk-queue-modal-overlay" onClick={onClose}>
      <div className="kiosk-queue-modal" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 18 }}>Background Upload Queue</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 14 }}>
          Recordings save in the background so guests never have to wait in line.
        </p>

        <div style={{ maxHeight: 220, overflowY: 'auto', marginBottom: 16 }}>
          {queueState.items.map((item) => (
            <div key={item.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '8px 12px', borderRadius: 8, marginBottom: 6,
              background: item.status === 'failed' ? '#FEECEE' : '#F8F9FA',
              fontSize: 13,
            }}>
              <div>
                <div style={{ fontWeight: 600 }}>{item.guestName} ({item.phase})</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                  {item.status === 'uploading' ? `Uploading (${item.progress}%)` : item.status}
                </div>
                {item.error && <div style={{ fontSize: 11, color: '#D9383A' }}>{item.error}</div>}
              </div>
              <div>
                {item.status === 'completed' && <span style={{ color: '#1D9E75', fontWeight: 600 }}>✓ Saved</span>}
                {item.status === 'uploading' && <span className="kiosk-sync-spinner" style={{ display: 'inline-block' }} />}
                {item.status === 'pending' && <span style={{ color: '#888' }}>Queued</span>}
                {item.status === 'failed' && <span style={{ color: '#D9383A', fontWeight: 600 }}>Failed</span>}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          {queueState.failedCount > 0 && (
            <button className="btn btn-primary btn-sm" onClick={() => uploadQueue.retryFailed()}>
              Retry Failed
            </button>
          )}
          {queueState.completedCount > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={() => uploadQueue.clearCompleted()}>
              Clear Saved
            </button>
          )}
          <button className="btn btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function PhaseCard({ icon, title, desc, selected, onClick, primary }) {
  return (
    <div
      className={`kiosk-mode-card${selected ? ' selected' : ''}`}
      onClick={onClick}
      style={{ borderColor: selected ? primary : 'transparent' }}
    >
      <span className="kiosk-mode-icon">{icon}</span>
      <div className="kiosk-mode-title">{title}</div>
      <div className="kiosk-mode-desc">{desc}</div>
    </div>
  );
}
