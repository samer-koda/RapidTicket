import { useState, useEffect, useCallback } from 'react';
import { api, type OrderDetail } from '../api';
import { useWs } from '../context/WsContext';
import styles from './KitchenScreen.module.css';

export default function KitchenScreen() {
  const [orders, setOrders] = useState<OrderDetail[]>([]);
  const { on } = useWs();

  const loadOrders = useCallback(async () => {
    const summaries = await api.orders.list({ status: 'SENT' });
    const details = await Promise.all(summaries.map(s => api.orders.get(s.id)));
    // Filter to only orders with kitchen items
    setOrders(details.filter(o => o.items.some(i => i.printDestination === 'KITCHEN')));
  }, []);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  useEffect(() => {
    const off1 = on('order.created', loadOrders);
    const off2 = on('order.updated', loadOrders);
    const off3 = on('order.item_status_changed', loadOrders);
    return () => { off1(); off2(); off3(); };
  }, [on, loadOrders]);

  const updateStatus = async (orderId: string, itemId: string, status: string) => {
    await api.orders.updateItemStatus(orderId, itemId, status);
    loadOrders();
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>Kitchen</h2>
        <span className={styles.count}>{orders.length} active order{orders.length !== 1 ? 's' : ''}</span>
      </div>

      <div className={styles.tickets}>
        {orders.length === 0 && <p className={styles.empty}>No active kitchen orders.</p>}
        {orders.map(order => (
          <div key={order.id} className={styles.ticket}>
            <div className={styles.ticketHeader}>
              <span className={styles.orderId}>ORDER #{order.id.slice(0, 6).toUpperCase()}</span>
              <span className={`${styles.orderStatus} ${styles[order.status.toLowerCase()]}`}>{order.status}</span>
            </div>
            <div className={styles.divider} />
            {order.items
              .filter(i => i.printDestination === 'KITCHEN')
              .map(item => (
                <div key={item.id} className={styles.item}>
                  <div className={styles.itemHeader}>
                    <span className={styles.qty}>{item.quantity}×</span>
                    <span className={styles.itemName}>{item.name}</span>
                    <span className={`${styles.badge} ${styles[item.status.toLowerCase()]}`}>{item.status}</span>
                  </div>
                  {item.appliedModifiers.map((m, i) => (
                    <div key={i} className={styles.modifier}>
                      {m.action === 'ADD' ? '+ ' : '− '}{m.label}
                    </div>
                  ))}
                  {item.notes && <div className={styles.notes}>{item.notes}</div>}
                  <div className={styles.actions}>
                    {item.status === 'SENT' && (
                      <button className={styles.prepBtn} onClick={() => updateStatus(order.id, item.id, 'PREPARING')}>
                        PREPARING
                      </button>
                    )}
                    {(item.status === 'SENT' || item.status === 'PREPARING') && (
                      <button className={styles.readyBtn} onClick={() => updateStatus(order.id, item.id, 'READY')}>
                        READY
                      </button>
                    )}
                  </div>
                </div>
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}
