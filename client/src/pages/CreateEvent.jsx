import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import api from '../utils/api';
import { THEME_PRESETS, FRAME_STYLES, FONT_STYLES, SOCIAL_PLATFORMS } from '../utils/eventConfig';
import StepWizard from '../components/StepWizard';
import ThemePreview from '../components/ThemePreview';
import FrameStyleCard from '../components/FrameStyleCard';

const STEPS = ['Details', 'Theme', 'Frame & Kiosk', 'Social & Publish'];

const DEFAULT_FORM = {
  // Step 1
  name: '', description: '', date: '', location: '',
  // Step 2
  theme: {
    preset: 'purple', primaryColor: '#7F77DD',
    secondaryColor: '#EEEDFE', accentColor: '#3C3489', fontStyle: 'modern',
  },
  // Step 3
  frame: {
    enabled: true, style: 'minimal',
    showEventTitle: true, showGuestName: true,
    showDate: false, showLogo: false, logoUrl: '',
    textPosition: 'bottom',
  },
  kiosk: {
    welcomeMessage: 'Welcome! Tap to record your message.',
    maxRecordingSeconds: 120,
    allowVideo: true, allowAudio: true, askGuestName: true,
  },
  // Step 4
  hashtags: [],
  postDescription: '',
  socials: { tiktok: false, instagram: false, facebook: false, twitter: false, youtube: false },
  status: 'draft',
};

export default function CreateEvent() {
  const navigate = useNavigate();
  const { id } = useParams(); // present when editing
  const isEdit = Boolean(id);

  const [step, setStep] = useState(0);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [tagInput, setTagInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loadingEvent, setLoadingEvent] = useState(isEdit);

  // Load event for editing
  useEffect(() => {
    if (!isEdit) return;
    api.get(`/events/${id}`)
      .then(({ data }) => {
        const ev = data.event;
        setForm({
          name: ev.name || '',
          description: ev.description || '',
          date: ev.date ? ev.date.split('T')[0] : '',
          location: ev.location || '',
          theme: { ...DEFAULT_FORM.theme, ...ev.theme },
          frame: { ...DEFAULT_FORM.frame, ...ev.frame },
          kiosk: { ...DEFAULT_FORM.kiosk, ...ev.kiosk },
          hashtags: ev.hashtags || [],
          postDescription: ev.postDescription || '',
          socials: { ...DEFAULT_FORM.socials, ...ev.socials },
          status: ev.status || 'draft',
        });
      })
      .catch(() => setError('Failed to load event.'))
      .finally(() => setLoadingEvent(false));
  }, [id, isEdit]);

  // Apply theme preset
  const applyPreset = (preset) => {
    if (preset.isCustom) {
      setForm(f => ({ ...f, theme: { ...f.theme, preset: 'custom' } }));
      return;
    }
    setForm(f => ({
      ...f,
      theme: {
        ...f.theme,
        preset: preset.id,
        primaryColor: preset.primary,
        secondaryColor: preset.secondary,
        accentColor: preset.accent,
      },
    }));
  };

  // Handle nested field updates
  const setNested = (section, field, value) =>
    setForm(f => ({ ...f, [section]: { ...f[section], [field]: value } }));

  // Hashtag helpers
  const addTag = () => {
    const tag = tagInput.trim().replace(/^#/, '').toLowerCase().replace(/\s+/g, '');
    if (!tag || form.hashtags.includes(tag) || form.hashtags.length >= 5) return;
    setForm(f => ({ ...f, hashtags: [...f.hashtags, tag] }));
    setTagInput('');
  };
  const removeTag = (tag) => setForm(f => ({ ...f, hashtags: f.hashtags.filter(t => t !== tag) }));

  // AI-generate caption + hashtags
  const generateWithAI = async () => {
    setAiLoading(true);
    setAiError('');
    try {
      const { data } = await api.post('/ai/caption', {
        name: form.name,
        description: form.description,
        date: form.date,
        location: form.location,
      });
      setForm(f => ({
        ...f,
        postDescription: data.description || f.postDescription,
        hashtags: data.hashtags?.slice(0, 5) || f.hashtags,
      }));
    } catch (err) {
      setAiError(err.response?.data?.error || 'AI generation failed. Check your API key.');
    } finally {
      setAiLoading(false);
    }
  };

  // Save
  const handleSave = async (asDraft = false) => {
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        status: asDraft ? 'draft' : form.status === 'draft' ? 'active' : form.status,
        date: form.date || undefined,
      };
      if (isEdit) {
        await api.patch(`/events/${id}`, payload);
      } else {
        await api.post('/events', payload);
      }
      navigate('/admin');
    } catch (err) {
      const msg = err.response?.data?.error || 'Save failed.';
      setError(msg);
      setSaving(false);
    }
  };

  const canProceed = [
    form.name.trim().length > 0 && form.date,      // step 0
    true,                                           // step 1 — theme always valid
    true,                                           // step 2 — frame always valid
    true,                                           // step 3 — social optional
  ];

  if (loadingEvent) return (
    <div className="flex-center" style={{ height: '100vh' }}>
      <span className="spinner" />
    </div>
  );

  return (
    <div style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        '--ev-primary':   form.theme.primaryColor,
        '--ev-secondary': form.theme.secondaryColor,
        '--ev-accent':    form.theme.accentColor,
      }}>

      {/* ── Nav ─────────────────────────────────────────────────────── */}
      <nav style={{
        background: 'var(--surface)', borderBottom: '0.5px solid var(--border)',
        padding: '0 24px', height: 60, display: 'flex', alignItems: 'center', gap: 12,
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <Link to="/admin"><button className="btn btn-ghost btn-sm">← Back</button></Link>
        <span style={{ fontWeight: 600, fontSize: 16 }}>
          {isEdit ? 'Edit event' : 'Create event'}
        </span>
        {form.name && (
          <span style={{ fontSize: 13, color: 'var(--text-3)', marginLeft: 4 }}>
            — {form.name}
          </span>
        )}
      </nav>

      <div className="container" style={{ paddingTop: 32, paddingBottom: 60, maxWidth: 900 }}>
        {error && <div className="alert alert-error" style={{ marginBottom: 24 }}>{error}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 240px', gap: 32, alignItems: 'start' }}>
          {/* ── Left: wizard ──────────────────────────────────────────── */}
          <div>
            <StepWizard steps={STEPS} currentStep={step}>
              {/* ── STEP 0: Details ─────────────────────────────────── */}
              {step === 0 && (
                <div className="card">
                  <h2 style={{ marginBottom: 20 }}>Event details</h2>
                  <div style={{ marginBottom: 16 }}>
                    <label>Event name *</label>
                    <input type="text" value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="e.g. Tech Summit 2026" />
                  </div>
                  <div className="grid-2" style={{ marginBottom: 16 }}>
                    <div>
                      <label>Date *</label>
                      <input type="date" value={form.date}
                        onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                    </div>
                    <div>
                      <label>Location</label>
                      <input type="text" value={form.location}
                        onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                        placeholder="e.g. Accra, Ghana" />
                    </div>
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <label>Description</label>
                    <textarea value={form.description}
                      onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                      placeholder="Tell us about this event — used for AI caption generation"
                      rows={4} />
                  </div>
                  <div style={{ marginBottom: 0 }}>
                    <label>Kiosk welcome message</label>
                    <input type="text" value={form.kiosk.welcomeMessage}
                      onChange={e => setNested('kiosk', 'welcomeMessage', e.target.value)}
                      placeholder="Welcome! Tap to record your message." />
                  </div>
                </div>
              )}

              {/* ── STEP 1: Theme ────────────────────────────────────── */}
              {step === 1 && (
                <div className="card">
                  <h2 style={{ marginBottom: 6 }}>Color theme</h2>
                  <p style={{ fontSize: 13, marginBottom: 20 }}>
                    This sets the kiosk colors, frame colors and admin UI for this event.
                  </p>

                  {/* Preset swatches */}
                  <label>Choose a preset</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 24 }}>
                    {THEME_PRESETS.map(preset => (
                      <div key={preset.id} onClick={() => applyPreset(preset)}
                        style={{
                          cursor: 'pointer', borderRadius: 10, overflow: 'hidden',
                          border: form.theme.preset === preset.id
                            ? `2px solid ${form.theme.primaryColor}`
                            : '1.5px solid var(--border)',
                          boxShadow: form.theme.preset === preset.id
                            ? `0 0 0 3px ${form.theme.primaryColor}33` : 'none',
                          transition: 'box-shadow 0.15s',
                        }}>
                        {/* Color bar */}
                        <div style={{ display: 'flex', height: 28 }}>
                          {preset.preview.map((c, i) => (
                            <div key={i} style={{ flex: 1, background: c }} />
                          ))}
                        </div>
                        <div style={{
                          padding: '5px 6px',
                          fontSize: 11, fontWeight: 500,
                          color: form.theme.preset === preset.id ? form.theme.primaryColor : 'var(--text-2)',
                          background: 'var(--surface)',
                        }}>
                          {preset.label}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Custom color pickers */}
                  <div className="grid-3" style={{ marginBottom: 20 }}>
                    {[
                      ['primaryColor', 'Primary color'],
                      ['secondaryColor', 'Background color'],
                      ['accentColor', 'Accent color'],
                    ].map(([field, label]) => (
                      <div key={field}>
                        <label>{label}</label>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <input
                            type="color"
                            value={form.theme[field]}
                            onChange={e => {
                              setNested('theme', field, e.target.value);
                              setNested('theme', 'preset', 'custom');
                            }}
                            style={{ width: 40, height: 36, padding: 2, border: '0.5px solid var(--border)', borderRadius: 6, cursor: 'pointer' }}
                          />
                          <input
                            type="text"
                            value={form.theme[field]}
                            onChange={e => {
                              if (/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value)) {
                                setNested('theme', field, e.target.value);
                                setNested('theme', 'preset', 'custom');
                              }
                            }}
                            style={{ flex: 1 }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Font style */}
                  <label>Font style</label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {FONT_STYLES.map(f => (
                      <button key={f.id} onClick={() => setNested('theme', 'fontStyle', f.id)}
                        className="btn btn-sm"
                        style={{
                          fontFamily: f.css,
                          background: form.theme.fontStyle === f.id ? form.theme.primaryColor : 'var(--surface)',
                          color: form.theme.fontStyle === f.id ? '#fff' : 'var(--text-2)',
                          border: `1px solid ${form.theme.fontStyle === f.id ? form.theme.primaryColor : 'var(--border)'}`,
                        }}>
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── STEP 2: Frame & Kiosk ────────────────────────────── */}
              {step === 2 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div className="card">
                    <div className="flex-between" style={{ marginBottom: 16 }}>
                      <h2>Video frame overlay</h2>
                      {/* Enable/disable toggle */}
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 0 }}>
                        <div style={{
                          width: 40, height: 22, borderRadius: 11,
                          background: form.frame.enabled ? form.theme.primaryColor : 'var(--border)',
                          position: 'relative', transition: 'background 0.2s', cursor: 'pointer',
                        }} onClick={() => setNested('frame', 'enabled', !form.frame.enabled)}>
                          <div style={{
                            width: 16, height: 16, borderRadius: '50%', background: '#fff',
                            position: 'absolute', top: 3,
                            left: form.frame.enabled ? 21 : 3,
                            transition: 'left 0.2s',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                          }} />
                        </div>
                        <span style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 0 }}>
                          {form.frame.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </label>
                    </div>

                    {form.frame.enabled ? (
                      <>
                        <label style={{ marginBottom: 12 }}>Choose a frame design</label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
                          {FRAME_STYLES.map(s => (
                            <FrameStyleCard
                              key={s.id}
                              style={s}
                              selected={form.frame.style === s.id}
                              onSelect={v => setNested('frame', 'style', v)}
                              primaryColor={form.theme.primaryColor}
                              eventName={form.name}
                            />
                          ))}
                        </div>

                        {/* Frame content toggles */}
                        <label>Show on frame</label>
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
                          {[
                            ['showEventTitle', 'Event title'],
                            ['showGuestName', 'Guest name'],
                            ['showDate', 'Event date'],
                            ['showLogo', 'Logo'],
                          ].map(([field, label]) => (
                            <label key={field} style={{
                              display: 'flex', alignItems: 'center', gap: 6,
                              cursor: 'pointer', marginBottom: 0, fontSize: 13,
                              padding: '6px 12px',
                              borderRadius: 20,
                              border: `1px solid ${form.frame[field] ? form.theme.primaryColor : 'var(--border)'}`,
                              background: form.frame[field] ? form.theme.secondaryColor : 'transparent',
                              color: form.frame[field] ? form.theme.accentColor : 'var(--text-2)',
                            }}>
                              <input type="checkbox" checked={form.frame[field]}
                                onChange={e => setNested('frame', field, e.target.checked)}
                                style={{ display: 'none' }} />
                              {form.frame[field] ? '✓ ' : ''}{label}
                            </label>
                          ))}
                        </div>

                        {/* Logo URL if showLogo */}
                        {form.frame.showLogo && (
                          <div style={{ marginBottom: 16 }}>
                            <label>Logo URL</label>
                            <input type="text" value={form.frame.logoUrl}
                              onChange={e => setNested('frame', 'logoUrl', e.target.value)}
                              placeholder="https://yoursite.com/logo.png" />
                          </div>
                        )}

                        {/* Text position */}
                        <label>Text position</label>
                        <div style={{ display: 'flex', gap: 8 }}>
                          {['bottom', 'top', 'bottom-left', 'top-left'].map(pos => (
                            <button key={pos} className="btn btn-sm"
                              onClick={() => setNested('frame', 'textPosition', pos)}
                              style={{
                                textTransform: 'capitalize',
                                background: form.frame.textPosition === pos ? form.theme.primaryColor : 'var(--surface)',
                                color: form.frame.textPosition === pos ? '#fff' : 'var(--text-2)',
                                border: `1px solid ${form.frame.textPosition === pos ? form.theme.primaryColor : 'var(--border)'}`,
                              }}>
                              {pos}
                            </button>
                          ))}
                        </div>
                      </>
                    ) : (
                      <p style={{ fontSize: 13, color: 'var(--text-3)', fontStyle: 'italic' }}>
                        Frame is disabled. Raw video will be exported to Google Drive without any overlay.
                      </p>
                    )}
                  </div>

                  {/* Kiosk settings */}
                  <div className="card">
                    <h2 style={{ marginBottom: 16 }}>Kiosk settings</h2>
                    <div className="grid-2" style={{ marginBottom: 16 }}>
                      <div>
                        <label>Max recording length (seconds)</label>
                        <input type="number" min={15} max={300}
                          value={form.kiosk.maxRecordingSeconds}
                          onChange={e => setNested('kiosk', 'maxRecordingSeconds', Number(e.target.value))} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, justifyContent: 'flex-end', paddingBottom: 4 }}>
                        {[
                          ['allowVideo', 'Allow video recording'],
                          ['allowAudio', 'Allow audio-only recording'],
                          ['askGuestName', 'Ask for guest name'],
                        ].map(([field, label]) => (
                          <label key={field} style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer', marginBottom: 0, fontSize: 13, color: 'var(--text-1)' }}>
                            <input type="checkbox" checked={form.kiosk[field]}
                              onChange={e => setNested('kiosk', field, e.target.checked)} />
                            {label}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── STEP 3: Social & Publish ─────────────────────────── */}
              {step === 3 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div className="card">
                    <h2 style={{ marginBottom: 6 }}>Caption & hashtags</h2>
                    <p style={{ fontSize: 13, marginBottom: 16 }}>
                      Used for all social posts. You can edit per-video in the review screen.
                    </p>

                    {/* AI generate button */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
                      <button className="btn btn-sm"
                        onClick={generateWithAI}
                        disabled={aiLoading || !form.name}
                        style={{
                          background: form.theme.primaryColor, color: '#fff',
                          border: 'none', gap: 6,
                        }}>
                        {aiLoading
                          ? <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Generating…</>
                          : '✨ Generate with AI'}
                      </button>
                    </div>

                    {aiError && <div className="alert alert-error" style={{ marginBottom: 12 }}>{aiError}</div>}

                    <div style={{ marginBottom: 16 }}>
                      <label>Post description / caption</label>
                      <textarea rows={4} value={form.postDescription}
                        onChange={e => setForm(f => ({ ...f, postDescription: e.target.value }))}
                        placeholder="Describe this event for social media…" />
                      <div style={{ fontSize: 11, color: 'var(--text-3)', textAlign: 'right', marginTop: 2 }}>
                        {form.postDescription.length} / 2200
                      </div>
                    </div>

                    {/* Hashtag input */}
                    <label>Hashtags (up to 5)</label>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                      <input
                        type="text"
                        value={tagInput}
                        onChange={e => setTagInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())}
                        placeholder="Type a tag and press Enter"
                        disabled={form.hashtags.length >= 5}
                        style={{ flex: 1 }}
                      />
                      <button className="btn btn-sm"
                        onClick={addTag}
                        disabled={form.hashtags.length >= 5 || !tagInput.trim()}
                        style={{ background: form.theme.primaryColor, color: '#fff', border: 'none', flexShrink: 0 }}>
                        + Add
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {form.hashtags.map(tag => (
                        <span key={tag} style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          padding: '4px 10px',
                          background: form.theme.secondaryColor,
                          color: form.theme.accentColor,
                          borderRadius: 20, fontSize: 13, fontWeight: 500,
                          border: `1px solid ${form.theme.primaryColor}44`,
                        }}>
                          #{tag}
                          <button onClick={() => removeTag(tag)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 14, lineHeight: 1, padding: 0 }}>
                            ×
                          </button>
                        </span>
                      ))}
                      {form.hashtags.length === 0 && (
                        <span style={{ fontSize: 13, color: 'var(--text-3)', fontStyle: 'italic' }}>No hashtags yet</span>
                      )}
                    </div>
                  </div>

                  {/* Social platforms */}
                  <div className="card">
                    <h2 style={{ marginBottom: 6 }}>Social platforms</h2>
                    <p style={{ fontSize: 13, marginBottom: 16 }}>
                      Select which platforms approved videos can be published to.
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {SOCIAL_PLATFORMS.map(platform => (
                        <label key={platform.id} style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
                          border: `1px solid ${form.socials[platform.id] ? platform.color : 'var(--border)'}`,
                          background: form.socials[platform.id] ? platform.color + '10' : 'var(--surface)',
                          transition: 'border-color 0.15s',
                          marginBottom: 0,
                        }}>
                          <input type="checkbox"
                            checked={form.socials[platform.id]}
                            onChange={e => setForm(f => ({ ...f, socials: { ...f.socials, [platform.id]: e.target.checked } }))}
                            style={{ display: 'none' }} />
                          <span style={{ fontSize: 20 }}>{platform.icon}</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)' }}>{platform.label}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Aspect ratio: {platform.ratio}</div>
                          </div>
                          <div style={{
                            width: 20, height: 20, borderRadius: '50%',
                            border: `2px solid ${form.socials[platform.id] ? platform.color : 'var(--border)'}`,
                            background: form.socials[platform.id] ? platform.color : 'transparent',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'all 0.15s',
                          }}>
                            {form.socials[platform.id] && (
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12"/>
                              </svg>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </StepWizard>

            {/* ── Navigation buttons ───────────────────────────────── */}
            <div className="flex-between" style={{ marginTop: 24 }}>
              <button className="btn btn-ghost"
                onClick={() => step > 0 ? setStep(s => s - 1) : navigate('/admin')}
                disabled={saving}>
                {step === 0 ? '← Cancel' : '← Back'}
              </button>

              <div style={{ display: 'flex', gap: 10 }}>
                {/* Save as draft at any step */}
                <button className="btn btn-ghost"
                  onClick={() => handleSave(true)}
                  disabled={saving || !form.name}>
                  {saving ? <span className="spinner" /> : 'Save draft'}
                </button>

                {step < STEPS.length - 1 ? (
                  <button className="btn btn-primary"
                    onClick={() => setStep(s => s + 1)}
                    disabled={!canProceed[step]}
                    style={{ background: form.theme.primaryColor }}>
                    Continue →
                  </button>
                ) : (
                  <button className="btn btn-primary"
                    onClick={() => handleSave(false)}
                    disabled={saving || !form.name}
                    style={{ background: form.theme.primaryColor }}>
                    {saving
                      ? <span className="spinner" />
                      : isEdit ? 'Save changes' : '🚀 Create event'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ── Right: live preview ──────────────────────────────────── */}
          <div style={{ position: 'sticky', top: 80 }}>
            <ThemePreview
              theme={form.theme}
              eventName={form.name}
              frameStyle={form.frame.enabled ? form.frame.style : null}
            />

            {/* Summary card */}
            <div className="card" style={{ marginTop: 16, padding: '14px 16px' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Summary
              </div>
              {[
                ['Event', form.name || '—'],
                ['Date', form.date ? new Date(form.date + 'T12:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'],
                ['Theme', THEME_PRESETS.find(p => p.id === form.theme.preset)?.label || 'Custom'],
                ['Frame', form.frame.enabled ? form.frame.style : 'Off'],
                ['Max rec.', `${form.kiosk.maxRecordingSeconds}s`],
                ['Socials', Object.entries(form.socials).filter(([, v]) => v).map(([k]) => k).join(', ') || 'None'],
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
                  <span style={{ color: 'var(--text-3)' }}>{label}</span>
                  <span style={{ color: 'var(--text-1)', fontWeight: 500, textAlign: 'right', maxWidth: 130 }}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
