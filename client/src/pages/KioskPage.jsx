import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../utils/api';
import useMediaRecorder, { RECORDING_STATES, fmtTime } from '../../hooks/useMediaRecorder';
import AudioVisualiser from '../../components/AudioVisualiser';
import PulseRings from '../../components/PulseRings';
import '../../styles/kiosk.css';

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

  // Recording hook — reinitialised when recMode changes
  const recorder = useMediaRecorder(recMode || 'video', event?.kiosk?.maxRecordingSeconds || 120);

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

  // ── Auto-reset when DONE screen shown (8 s) ──────────────────────────────
  useEffect(() => {
    if (screen !== SCREENS.DONE) return;
    const t = setTimeout(goIdle, 8000);
    return () => clearTimeout(t);
  }, [screen, goIdle]);

  // ── Upload blob to server ────────────────────────────────────────────────
  const submitRecording = useCallback(async () => {
    if (!recorder.blob) return;
    setScreen(SCREENS.UPLOADING);
    setUploadProgress(0);
    setUploadError('');

    try {
      const ext = recMode === 'video' ? 'webm' : 'webm';
      const filename = `${(guestName || 'guest').replace(/\s+/g, '_')}_${phase}_${Date.now()}.${ext}`;

      const formData = new FormData();
      formData.append('video', recorder.blob, filename);
      formData.append('eventId', event._id);
      formData.append('guestName', guestName || 'Anonymous');
      formData.append('phase', phase);
      formData.append('recordingType', recMode);

      await api.post('/videos/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          setUploadProgress(Math.round((e.loaded / e.total) * 100));
        },
      });

      setScreen(SCREENS.DONE);
    } catch (err) {
      setUploadError(err.response?.data?.error || 'Upload failed. Please try again.');
      setScreen(SCREENS.REVIEW);
    }
  }, [recorder.blob, recMode, guestName, phase, event]);

  // ── Theme shortcuts ──────────────────────────────────────────────────────
  const primary = event?.theme?.primaryColor || '#7F77DD';
  const accent  = event?.theme?.accentColor  || '#3C3489';

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
      <div className="kiosk-root">
        <div className="kiosk-screen" style={{ gap: 16, maxWidth: 600, margin: '0 auto', width: '100%' }}>
          {/* Phase + name badge */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
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
          <div className="kiosk-preview-wrap">
            {recMode === 'video' ? (
              <>
                <video
                  ref={recorder.videoPreviewRef}
                  className="kiosk-preview-video"
                  autoPlay
                  muted
                  playsInline
                />
                {isRecording && (
                  <div className="kiosk-rec-overlay">
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
                  transform: 'scaleX(-1)', // keep mirror for review
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
        <div className="kiosk-screen" style={{ gap: 16 }}>
          <div className="kiosk-done-icon">
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#1D9E75" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <h1 className="kiosk-h1">Thank you{guestName ? `, ${guestName}` : ''}!</h1>
          <p className="kiosk-p" style={{ maxWidth: 360 }}>
            Your {phase} has been saved.
            {event.frame?.enabled ? ' It will be processed and shared by the event team.' : ''}
          </p>
          <button className="kiosk-btn kiosk-btn-primary" onClick={goIdle}
            style={{ background: primary, marginTop: 12 }}>
            Record another →
          </button>
          <p style={{ fontSize: 12, opacity: 0.4, color: accent, marginTop: 8 }}>
            Returning to home in a few seconds…
          </p>
        </div>
      </div>
    );
  }

  return null;
}

// ── Helper sub-components ────────────────────────────────────────────────────

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
