import { useState, useEffect, useCallback, useRef } from 'react';
import { api, type OrderDetail, type OrderItem } from '../api';
import { useWs } from '../context/WsContext';
import { printBarChit } from '../print';
import styles from './BarScreen.module.css';

interface Chit {
  orderId: string;
  tableId: string;
  items: OrderItem[];
  receivedAt: string;
}

export default function BarScreen() {
  const [chits, setChits] = useState<Chit[]>([]);
  const { on } = useWs();
  const chitIdCounter = useRef(0);

  // Load current active orders with BAR items on mount
  const loadActive = useCallback(async () => {
    const summaries = await api.orders.list({ status: 'SENT' });
    const details = await Promise.all(summaries.map(s => api.orders.get(s.id)));
    const activeChits: Chit[] = details
      .filter(o => o.items.some(i => i.printDestination === 'BAR'))
      .map(o => ({
        orderId: o.id,
        tableId: o.tableId,
        items: o.items.filter(i => i.printDestination === 'BAR'),
        receivedAt: new Date().toISOString(),
      }));
    setChits(activeChits);
  }, []);

  useEffect(() => { loadActive(); }, [loadActive]);

  // New-round bar items arrive via WS
  useEffect(() => {
    const handleEvent = (envelope: unknown) => {
      const env = envelope as { data: { orderId: string; tableId: string; items?: OrderItem[]; newItems?: OrderItem[] } };
      const newBarItems = (env.data.items ?? env.data.newItems ?? []).filter((i: OrderItem) => i.printDestination === 'BAR');
      if (!newBarItems.length) return;
      const chit: Chit = {
        orderId: env.data.orderId,
        tableId: env.data.tableId,
        items: newBarItems,
        receivedAt: new Date().toISOString(),
      };
      setChits(c => [chit, ...c]);
      // Auto-print
      printBarChit(chit).catch(() => {});
    };

    const off1 = on('order.created', handleEvent);
    const off2 = on('order.updated', handleEvent);
    return () => { off1(); off2(); };
  }, [on]);

  // Remove paid orders
  useEffect(() => {
    const off = on('payment.completed', (envelope) => {
      const env = envelope as { data: { orderId: string } };
      setChits(c => c.filter(ch => ch.orderId !== env.data.orderId));
    });
    return off;
  }, [on]);

  const updateItemStatus = async (orderId: string, itemId: string, status: string) => {
    await api.orders.updateItemStatus(orderId, itemId, status);
    // Refresh that chit
    const updated = await api.orders.get(orderId);
    setChits(c => c.map(ch => ch.orderId === orderId ? { ...ch, items: updated.items.filter(i => i.printDestination === 'BAR') } : ch));
  };

  const dismiss = (orderId: string) => setChits(c => c.filter(ch => ch.orderId !== orderId));

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>Bar</h2>
        <span className={styles.count}>{chits.length} chit{chits.length !== 1 ? 's' : ''}</span>
      </div>

      <div className={styles.chits}>
        {chits.length === 0 && <p className={styles.empty}>No active bar chits.</p>}
        {chits.map((chit, idx) => (
          <div key={`${chit.orderId}-${idx}`} className={styles.chit}>
            <div className={styles.chitHeader}>
              <span className={styles.tableLabel}>Table {chit.tableId.slice(0, 6).toUpperCase()}</span>
              <span className={styles.time}>{new Date(chit.receivedAt).toLocaleTimeString()}</span>
              <button className={styles.dismissBtn} onClick={() => dismiss(chit.orderId)}>×</button>
            </div>
            <div className={styles.divider} />
            {chit.items.map(item => (
              <div key={item.id} className={styles.item}>
                <div className={styles.itemRow}>
                  <span className={styles.qty}>{item.quantity}×</span>
                  <span className={styles.name}>{item.name}</span>
                  <span className={`${styles.badge} ${styles[item.status.toLowerCase()]}`}>{item.status}</span>
                </div>
                {item.appliedModifiers.map((m, i) => (
                  <div key={i} className={styles.modifier}>{m.action === 'ADD' ? '+' : '−'} {m.label}</div>
                ))}
                <div className={styles.actions}>
                  {item.status === 'SENT' && (
                    <button className={styles.prepBtn} onClick={() => updateItemStatus(chit.orderId, item.id, 'PREPARING')}>PREPARING</button>
                  )}
                  {(item.status === 'SENT' || item.status === 'PREPARING') && (
                    <button className={styles.readyBtn} onClick={() => updateItemStatus(chit.orderId, item.id, 'READY')}>READY</button>
                  )}
                </div>
              </div>
            ))}
            <button className={styles.reprintBtn} onClick={() => printBarChit(chit)}>Reprint chit</button>
          </div>
        ))}
      </div>
    </div>
  );
}
