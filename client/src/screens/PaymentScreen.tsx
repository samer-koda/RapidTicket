import { useState, useEffect } from 'react';
import { api, type OrderDetail, type PaymentResult } from '../api';
import { printReceipt } from '../print';
import { useAuth } from '../context/AuthContext';
import styles from './PaymentScreen.module.css';

interface Props {
  orderId: string;
  onComplete: () => void;
  onBack: () => void;
}

const TIP_PRESETS = [0, 0.15, 0.18, 0.20];

export default function PaymentScreen({ orderId, onComplete, onBack }: Props) {
  const { logout } = useAuth();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [tipMode, setTipMode] = useState<number | 'custom'>(0);
  const [customTip, setCustomTip] = useState('');
  const [method, setMethod] = useState<'CASH' | 'CARD_EXTERNAL'>('CASH');
  const [result, setResult] = useState<PaymentResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [autoLogout, setAutoLogout] = useState(true);

  useEffect(() => { api.orders.get(orderId).then(setOrder); }, [orderId]);
  useEffect(() => {
    api.settings.list().then(rows => {
      const val = rows.find(r => r.key === 'auto_logout')?.value;
      setAutoLogout(val !== 'false');
    }).catch(() => {});
  }, []);

  if (!order) return <div className={styles.loading}>Loading order…</div>;

  const tipAmount = (() => {
    if (tipMode === 'custom') return parseFloat(customTip) || 0;
    return order.subtotal * (tipMode as number);
  })();

  const tipAmountFixed = Math.round(tipAmount * 100) / 100;
  const total = order.subtotal + order.taxAmount + tipAmountFixed;

  const handlePay = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.payments.create({ orderId, method, tipAmount: tipAmountFixed });
      setResult(res);
      // Prompt print
      await printReceipt({ order, payment: res });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    return (
      <div className={styles.container}>
        <div className={styles.success}>
          <div className={styles.tick}>✓</div>
          <h2>Payment Complete</h2>
          <p className={styles.totalLine}>Total paid: <strong>${result.total.toFixed(2)}</strong></p>
          <button className={styles.doneBtn} onClick={() => { onComplete(); if (autoLogout) logout(); }}>Done</button>
          <button className={styles.reprintBtn} onClick={() => printReceipt({ order: order!, payment: result })}>Reprint Receipt</button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button className={styles.back} onClick={onBack}>← Back</button>
        <h2>Payment</h2>
      </div>

      <div className={styles.body}>
        <div className={styles.summary}>
          <div className={styles.line}><span>Subtotal</span><span>${order.subtotal.toFixed(2)}</span></div>
          <div className={styles.line}><span>Tax ({(order.taxAmount / (order.taxableSubtotal || 1) * 100).toFixed(2)}%)</span><span>${order.taxAmount.toFixed(2)}</span></div>
          <div className={styles.line}>
            <span>Tip</span>
            <span>${tipAmountFixed.toFixed(2)}</span>
          </div>
          <div className={`${styles.line} ${styles.totalRow}`}><span>Total</span><span>${total.toFixed(2)}</span></div>
        </div>

        <div className={styles.section}>
          <p className={styles.label}>Tip</p>
          <div className={styles.tipRow}>
            {TIP_PRESETS.map(pct => (
              <button
                key={pct}
                className={`${styles.tipBtn} ${tipMode === pct ? styles.tipActive : ''}`}
                onClick={() => setTipMode(pct)}
              >
                {pct === 0 ? 'No Tip' : `${(pct * 100).toFixed(0)}%`}
              </button>
            ))}
            <button className={`${styles.tipBtn} ${tipMode === 'custom' ? styles.tipActive : ''}`} onClick={() => setTipMode('custom')}>
              Custom
            </button>
          </div>
          {tipMode === 'custom' && (
            <input
              className={styles.customInput}
              type="number"
              placeholder="0.00"
              min="0"
              step="0.50"
              value={customTip}
              onChange={e => setCustomTip(e.target.value)}
            />
          )}
        </div>

        <div className={styles.section}>
          <p className={styles.label}>Method</p>
          <div className={styles.methodRow}>
            <button className={`${styles.methodBtn} ${method === 'CASH' ? styles.methodActive : ''}`} onClick={() => setMethod('CASH')}>
              Cash
            </button>
            <button className={`${styles.methodBtn} ${method === 'CARD_EXTERNAL' ? styles.methodActive : ''}`} onClick={() => setMethod('CARD_EXTERNAL')}>
              External Card
            </button>
          </div>
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <button className={styles.payBtn} onClick={handlePay} disabled={loading}>
          {loading ? 'Processing…' : `Charge $${total.toFixed(2)}`}
        </button>
      </div>
    </div>
  );
}
