import { useState } from 'react';
import styles from './Login.module.css';
import frStyles from './FirstRun.module.css';

interface Props {
  onComplete: (token: string, user: { id: string; name: string; role: string }) => void;
}

export default function FirstRun({ onComplete }: Props) {
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [stage, setStage] = useState<'pin' | 'confirm'>('pin');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const activePin = stage === 'pin' ? pin : confirmPin;

  const handleKey = (digit: string) => {
    if (stage === 'pin') {
      if (pin.length < 4) setPin(p => p + digit);
    } else {
      if (confirmPin.length < 4) setConfirmPin(p => p + digit);
    }
  };

  const handleBackspace = () => {
    if (stage === 'pin') setPin(p => p.slice(0, -1));
    else setConfirmPin(p => p.slice(0, -1));
  };

  const advanceToConfirm = () => {
    setError('');
    if (!name.trim()) { setError('Name is required.'); return; }
    if (pin.length < 4) { setError('PIN must be at least 4 digits.'); return; }
    setConfirmPin('');
    setStage('confirm');
  };

  const handleSubmit = async () => {
    setError('');
    if (pin !== confirmPin) {
      setError('PINs do not match. Try again.');
      setConfirmPin('');
      return;
    }
    setLoading(true);
    try {
      const { api } = await import('../api');
      const res = await api.auth.bootstrap({ name: name.trim(), pin });
      onComplete(res.token, res.user);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <img src="/logo.png" alt="RapidTicket" className={styles.logo} />
      <div className={`${styles.card} ${frStyles.card}`}>
        <h2 className={frStyles.title}>Create Admin Account</h2>
        <p className={frStyles.subtitle}>Set up your first administrator to get started.</p>

        {stage === 'pin' && (
          <div className={frStyles.nameField}>
            <label className={frStyles.nameLabel}>Full Name</label>
            <input
              className={frStyles.nameInput}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Jane Smith"
              autoFocus
            />
          </div>
        )}

        <div className={frStyles.pinStageIndicator}>
          <div className={`${frStyles.pinStageStep} ${stage === 'pin' ? frStyles.pinStageActive : frStyles.pinStageDone}`}>
            <span className={frStyles.pinStageNum}>{stage === 'confirm' ? '✓' : '1'}</span>
            <span className={frStyles.pinStageLabel}>Create PIN</span>
          </div>
          <div className={frStyles.pinStageLine} />
          <div className={`${frStyles.pinStageStep} ${stage === 'confirm' ? frStyles.pinStageActive : frStyles.pinStageIdle}`}>
            <span className={frStyles.pinStageNum}>2</span>
            <span className={frStyles.pinStageLabel}>Confirm PIN</span>
          </div>
        </div>

        <div className={styles.dots}>
          {Array.from({ length: Math.max(4, activePin.length) }).map((_, i) => (
            <span key={i} className={`${styles.dot} ${i < activePin.length ? styles.filled : ''}`} />
          ))}
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.pad}>
          {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((k, i) => (
            <button
              key={i}
              className={styles.key}
              disabled={!k || loading}
              onClick={() => k === '⌫' ? handleBackspace() : handleKey(k)}
            >
              {k}
            </button>
          ))}
        </div>

        {stage === 'pin' ? (
          <button
            className={styles.submit}
            onClick={advanceToConfirm}
            disabled={!name.trim() || pin.length < 4}
          >
            Next — Confirm PIN
          </button>
        ) : (
          <div className={frStyles.confirmActions}>
            <button
              className={frStyles.backBtn}
              onClick={() => { setStage('pin'); setError(''); }}
              disabled={loading}
            >
              ← Back
            </button>
            <button
              className={styles.submit}
              onClick={handleSubmit}
              disabled={loading || confirmPin.length < 4}
            >
              {loading ? 'Creating account…' : 'Create Admin Account'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
