// Shared multi-step wizard shell used by CreateEvent

export default function StepWizard({ steps, currentStep, children }) {
  return (
    <div>
      {/* Step indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 32 }}>
        {steps.map((step, i) => {
          const done = i < currentStep;
          const active = i === currentStep;
          return (
            <div key={step} style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : 'none' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: done ? 'var(--ev-primary)' : active ? 'var(--ev-primary)' : 'var(--border)',
                  color: done || active ? '#fff' : 'var(--text-3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 600,
                  transition: 'background 0.2s',
                  flexShrink: 0,
                }}>
                  {done ? '✓' : i + 1}
                </div>
                <span style={{
                  fontSize: 11, fontWeight: active ? 600 : 400,
                  color: active ? 'var(--ev-primary)' : done ? 'var(--text-2)' : 'var(--text-3)',
                  whiteSpace: 'nowrap',
                }}>
                  {step}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div style={{
                  flex: 1, height: 2, margin: '0 6px', marginBottom: 18,
                  background: done ? 'var(--ev-primary)' : 'var(--border)',
                  transition: 'background 0.2s',
                }} />
              )}
            </div>
          );
        })}
      </div>
      {children}
    </div>
  );
}
