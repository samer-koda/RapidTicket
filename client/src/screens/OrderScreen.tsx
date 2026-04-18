import { useState, useEffect } from 'react';
import { api, type TableRow, type MenuItem, type Category, type Modifier, type OrderDetail, type OrderItemInput } from '../api';
import { useAuth } from '../context/AuthContext';
import styles from './OrderScreen.module.css';

interface Props {
  table: TableRow;
  onBack: () => void;
  onPayment: (orderId: string) => void;
}

interface DraftItem {
  menuItem: MenuItem;
  quantity: number;
  selectedModifiers: Modifier[];
  notes: string;
}

export default function OrderScreen({ table, onBack, onPayment }: Props) {
  const { user, logout } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [existingOrder, setExistingOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [autoLogout, setAutoLogout] = useState(true);

  useEffect(() => {
    Promise.all([api.menu.listCategories(), api.menu.listItems()]).then(([cats, items]) => {
      setCategories(cats);
      setMenuItems(items.filter(i => i.isAvailable).map(i => ({
        ...i,
        price: Number(i.price),
        modifiers: (i.modifiers ?? []).map(m => ({ ...m, priceDelta: Number(m.priceDelta) })),
      })));
      if (cats.length > 0) setActiveCategory(cats[0].id);
    });
    // Load existing open order for this table (any non-CLOSED status)
    api.orders.list({ tableId: table.id }).then(orders => {
      const open = orders.find(o => o.status !== 'CLOSED');
      if (open) api.orders.get(open.id).then(setExistingOrder);
    }).catch(() => {});
    // Load auto-logout setting (default true if missing)
    api.settings.list().then(rows => {
      const val = rows.find(r => r.key === 'auto_logout')?.value;
      setAutoLogout(val !== 'false');
    }).catch(() => {});
  }, [table.id]);

  const filteredItems = activeCategory ? menuItems.filter(i => i.categoryId === activeCategory) : menuItems;

  const addToDraft = (item: MenuItem, mods: Modifier[], notes: string) => {
    setDraft(d => [...d, { menuItem: item, quantity: 1, selectedModifiers: mods, notes }]);
    setSelectedItem(null);
  };

  const removeFromDraft = (index: number) => setDraft(d => d.filter((_, i) => i !== index));

  const changeQty = (index: number, delta: number) => {
    setDraft(d => d.map((item, i) => i === index ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item));
  };

  const submit = async () => {
    if (draft.length === 0) return;
    setLoading(true);
    setError('');
    try {
      const items: OrderItemInput[] = draft.map(d => ({
        menuItemId: d.menuItem.id,
        quantity: d.quantity,
        modifierIds: d.selectedModifiers.map(m => m.id),
        notes: d.notes || undefined,
      }));

      if (existingOrder) {
        await api.orders.addItems(existingOrder.id, { items });
        const refreshed = await api.orders.get(existingOrder.id);
        setExistingOrder(refreshed);
      } else {
        const { id } = await api.orders.create({ tableId: table.id, items });
        const order = await api.orders.get(id);
        setExistingOrder(order);
      }
      setDraft([]);
      if (autoLogout) logout();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <button className={styles.back} onClick={onBack}>← Back</button>
        <h2>Table {table.name}</h2>
        {existingOrder && (user?.role === 'admin' || existingOrder.createdBy === user?.id) && (
          <button className={styles.payBtn} onClick={() => onPayment(existingOrder.id)}>Payment →</button>
        )}
      </div>

      <div className={styles.body}>
        {/* Menu panel */}
        <div className={styles.menu}>
          <div className={styles.categories}>
            {categories.map(c => (
              <button key={c.id} className={`${styles.catBtn} ${c.id === activeCategory ? styles.catActive : ''}`} onClick={() => setActiveCategory(c.id)}>
                {c.hasImage && <img src={api.menu.categoryImageUrl(c.id)} alt="" className={styles.catThumb} loading="lazy" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />}
                {c.name}
              </button>
            ))}
          </div>
          <div className={styles.items}>
            {filteredItems.map(item => (
              <button key={item.id} className={`${styles.menuItem} ${item.hasImage ? styles.menuItemWithImage : ''}`} onClick={() => setSelectedItem(item)}>
                {item.hasImage && (
                  <img
                    src={api.menu.itemImageUrl(item.id)}
                    alt={item.name}
                    className={styles.menuItemImage}
                    loading="lazy"
                    onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                  />
                )}
                <span>{item.name}</span>
                <span className={styles.price}>${item.price.toFixed(2)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Order panel */}
        <div className={styles.order}>
          <h3>Order</h3>

          {existingOrder && existingOrder.items.length > 0 && (
            <div className={styles.section}>
              <p className={styles.sectionLabel}>Submitted</p>
              {existingOrder.items.map(oi => (
                <div key={oi.id} className={styles.submittedItem}>
                  <span>{oi.quantity}× {oi.name}</span>
                  <span className={styles.itemStatus}>{oi.status}</span>
                </div>
              ))}
              <div className={styles.divider} />
            </div>
          )}

          {draft.map((d, i) => (
            <div key={i} className={styles.draftItem}>
              <div className={styles.draftName}>
                <button className={styles.qtyBtn} onClick={() => changeQty(i, -1)}>−</button>
                <span>{d.quantity}× {d.menuItem.name}</span>
                <button className={styles.qtyBtn} onClick={() => changeQty(i, 1)}>+</button>
              </div>
              {d.selectedModifiers.map(m => (
                <span key={m.id} className={styles.mod}>{m.action === 'ADD' ? '+' : '−'} {m.label}</span>
              ))}
              {d.notes && <span className={styles.notes}>{d.notes}</span>}
              <button className={styles.remove} onClick={() => removeFromDraft(i)}>Remove</button>
            </div>
          ))}

          {draft.length === 0 && !existingOrder && <p className={styles.empty}>No items yet.</p>}

          {error && <p className={styles.error}>{error}</p>}

          {draft.length > 0 && (
            <button className={styles.submitBtn} onClick={submit} disabled={loading}>
              {loading ? 'Sending…' : `Send ${draft.length} item${draft.length !== 1 ? 's' : ''}`}
            </button>
          )}
        </div>
      </div>

      {/* Modifier picker modal */}
      {selectedItem && (
        <ModifierPicker item={selectedItem} onAdd={addToDraft} onClose={() => setSelectedItem(null)} />
      )}
    </div>
  );
}

// ── Modifier Picker ───────────────────────────────────────────────────────────

function ModifierPicker({ item, onAdd, onClose }: {
  item: MenuItem;
  onAdd: (item: MenuItem, mods: Modifier[], notes: string) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<Modifier[]>([]);
  const [notes, setNotes] = useState('');

  const toggle = (mod: Modifier) => {
    setSelected(s => s.find(m => m.id === mod.id) ? s.filter(m => m.id !== mod.id) : [...s, mod]);
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        {item.hasImage && (
          <img
            src={api.menu.itemImageUrl(item.id)}
            alt={item.name}
            className={styles.modalImage}
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
        )}
        <h3>{item.name} <span className={styles.price}>${item.price.toFixed(2)}</span></h3>

        {item.modifiers.length > 0 && (
          <>
            <p className={styles.modLabel}>Modifiers</p>
            <div className={styles.modList}>
              {item.modifiers.map(mod => (
                <button
                  key={mod.id}
                  className={`${styles.modChip} ${selected.find(m => m.id === mod.id) ? styles.modSelected : ''}`}
                  onClick={() => toggle(mod)}
                >
                  {mod.action === 'ADD' ? '+' : '−'} {mod.label}
                  {mod.priceDelta > 0 && ` (+$${mod.priceDelta.toFixed(2)})`}
                </button>
              ))}
            </div>
          </>
        )}

        <textarea
          className={styles.notesInput}
          placeholder="Notes (optional)"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={2}
        />

        <div className={styles.modalActions}>
          <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button className={styles.addBtn} onClick={() => onAdd(item, selected, notes)}>Add to Order</button>
        </div>
      </div>
    </div>
  );
}
