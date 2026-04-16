import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import styles from './Login.module.css';

export default function Login() {
  const { login } = useAuth();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleKey = (digit: string) => {
    if (pin.length < 4) setPin(p => p + digit);
  };

  const handleSubmit = async () => {
    if (!pin) return;
    setLoading(true);
    setError('');
    try {
      await login(pin);
    } catch (e) {
      setError((e as Error).message);
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => { setPin(''); setError(''); };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') { handleKey(e.key); }
      else if (e.key === 'Backspace') { setPin(p => p.slice(0, -1)); }
      else if (e.key === 'Enter') { handleSubmit(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, loading]);

  return (
    <div className={styles.container}>
      <img src="/logo.png" alt="RapidTicket" className={styles.logo} />
      <div className={styles.card}>
        <div className={styles.dots}>
          {Array.from({ length: Math.max(4, pin.length) }).map((_, i) => (
            <span key={i} className={`${styles.dot} ${i < pin.length ? styles.filled : ''}`} />
          ))}
        </div>
        {error && <p className={styles.error}>{error}</p>}
        <div className={styles.pad}>
          {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((k, i) => (
            <button
              key={i}
              className={styles.key}
              disabled={!k || loading}
              onClick={() => k === '⌫' ? setPin(p => p.slice(0, -1)) : handleKey(k)}
            >
              {k}
            </button>
          ))}
        </div>
        <button className={styles.submit} onClick={handleSubmit} disabled={loading || !pin}>
          {loading ? 'Logging in…' : 'Login'}
        </button>
        <button className={styles.clear} onClick={handleClear}>Clear</button>
      </div>
    </div>
  );
}
