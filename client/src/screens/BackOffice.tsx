import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api';
import type {
  FloorPlan, TableRow, Category, MenuItem, Modifier,
  PrinterRow, UserRow, DailyReport, TableReport, StationRow
} from '../api';
import { useAuth } from '../context/AuthContext';
import styles from './BackOffice.module.css';

type Tab = 'floorplans' | 'tables' | 'categories' | 'menu' | 'modifiers' | 'users' | 'stations' | 'printers' | 'settings' | 'reports';

// ---- Floor Plans ----
function FloorPlanTab() {
  const [plans, setPlans] = useState<FloorPlan[]>([]);
  const [editing, setEditing] = useState<Partial<FloorPlan> | null>(null);
  const load = useCallback(async () => setPlans(await api.floorPlans.list()), []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!editing) return;
    if (editing.id) await api.floorPlans.update(editing.id, { name: editing.name! });
    else await api.floorPlans.create({ name: editing.name! });
    setEditing(null);
    await load();
  };

  return (
    <div className={styles.tab}>
      <div className={styles.tabHeader}>
        <h3>Floor Plans</h3>
        <button className={styles.addBtn} onClick={() => setEditing({})}>+ Add</button>
      </div>
      {editing !== null && (
        <div className={styles.form}>
          <input value={editing.name ?? ''} onChange={e => setEditing({ ...editing, name: e.target.value })} placeholder="Floor plan name" autoFocus />
          <button onClick={save}>Save</button>
          <button onClick={() => setEditing(null)}>Cancel</button>
        </div>
      )}
      <table className={styles.table}>
        <thead><tr><th>Name</th><th>Actions</th></tr></thead>
        <tbody>
          {plans.map(p => (
            <tr key={p.id}>
              <td>{p.name}</td>
              <td>
                <button onClick={() => setEditing(p)}>Edit</button>
                <button onClick={async () => { await api.floorPlans.delete(p.id); await load(); }}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---- Tables ----
const TABLE_SIZE = 90;
const SNAP_GRID = 20;

function TablesTab() {
  const [plans, setPlans] = useState<FloorPlan[]>([]);
  const [tables, setTables] = useState<TableRow[]>([]);
  const [planId, setPlanId] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [formName, setFormName] = useState('');
  const [formShape, setFormShape] = useState<'RECTANGLE' | 'ROUND'>('RECTANGLE');
  const [dragging, setDragging] = useState<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const [localPositions, setLocalPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [snap, setSnap] = useState(true);
  const [zoom, setZoom] = useState(1);
  const canvasRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoom(z => parseFloat(Math.min(2.0, Math.max(0.4, z - e.deltaY * 0.005)).toFixed(2)));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const loadPlans = useCallback(async () => {
    const p = await api.floorPlans.list();
    setPlans(p);
    if (p.length) setPlanId(prev => prev || p[0].id);
  }, []);

  const loadTables = useCallback(async (pid: string) => {
    if (!pid) return;
    setTables(await api.tables.list(pid));
    setLocalPositions({});
  }, []);

  useEffect(() => { loadPlans(); }, [loadPlans]);
  useEffect(() => { if (planId) loadTables(planId); }, [planId, loadTables]);

  const getPos = (t: TableRow) => localPositions[t.id] ?? { x: t.positionX, y: t.positionY };

  const findFreeSpot = () => {
    const GAP = 20;
    const STEP = TABLE_SIZE + GAP;
    const COLS = 6;
    for (let i = 0; i < 60; i++) {
      const x = GAP + (i % COLS) * STEP;
      const y = GAP + Math.floor(i / COLS) * STEP;
      const overlaps = tables.some(t => {
        const p = getPos(t);
        return Math.abs(p.x - x) < TABLE_SIZE && Math.abs(p.y - y) < TABLE_SIZE;
      });
      if (!overlaps) return { x, y };
    }
    return { x: GAP, y: GAP };
  };

  const openAdd = () => { setAdding(true); setSelected(null); setFormName(''); setFormShape('RECTANGLE'); };
  const closePanel = () => { setAdding(false); setSelected(null); };

  const handleSelectTable = (t: TableRow) => {
    if (dragging) return;
    setSelected(t.id);
    setAdding(false);
    setFormName(t.name ?? t.label ?? '');
    setFormShape((t.shape ?? 'RECTANGLE') as 'RECTANGLE' | 'ROUND');
  };

  const handleSaveNew = async () => {
    if (!formName.trim()) return;
    const { x, y } = findFreeSpot();
    await api.tables.create({ floorPlanId: planId, name: formName.trim(), shape: formShape, positionX: x, positionY: y });
    setAdding(false);
    await loadTables(planId);
  };

  const handleSaveEdit = async () => {
    if (!selected) return;
    await api.tables.update(selected, { name: formName.trim(), shape: formShape });
    setSelected(null);
    await loadTables(planId);
  };

  const handleDelete = async () => {
    if (!selected) return;
    await api.tables.delete(selected);
    setSelected(null);
    await loadTables(planId);
  };

  const handleMouseDown = (e: React.MouseEvent, t: TableRow) => {
    e.preventDefault();
    const pos = getPos(t);
    setDragging({ id: t.id, startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    const dx = e.clientX - dragging.startX;
    const dy = e.clientY - dragging.startY;
    let x = Math.max(0, dragging.origX + dx / zoom);
    let y = Math.max(0, dragging.origY + dy / zoom);
    if (snap) {
      x = Math.round(x / SNAP_GRID) * SNAP_GRID;
      y = Math.round(y / SNAP_GRID) * SNAP_GRID;
    }
    setLocalPositions(prev => ({ ...prev, [dragging.id]: { x, y } }));
  };

  const handleMouseUp = async () => {
    if (!dragging) return;
    const pos = localPositions[dragging.id];
    const id = dragging.id;
    setDragging(null);
    if (pos) {
      await api.tables.update(id, { positionX: Math.round(pos.x), positionY: Math.round(pos.y) });
      await loadTables(planId);
    }
  };

  const selectedTable = tables.find(t => t.id === selected);

  return (
    <div className={`${styles.tab} ${styles.tabCanvas}`}>
      <div className={styles.tabHeader}>
        <h3>Tables</h3>
        <select className={styles.headerSelect} value={planId} onChange={e => { setPlanId(e.target.value); closePanel(); }}>
          {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <button className={styles.addBtn} onClick={openAdd}>+ Add</button>
      </div>

      {(adding || selectedTable) && (
        <div className={styles.form}>
          <div className={styles.fieldGroup}>
            <span>Label</span>
            <input value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g. T1" autoFocus />
          </div>
          <div className={styles.fieldGroup}>
            <span>Shape</span>
            <select value={formShape} onChange={e => setFormShape(e.target.value as 'RECTANGLE' | 'ROUND')}>
              <option value="RECTANGLE">Rectangle</option>
              <option value="ROUND">Round</option>
            </select>
          </div>
          {adding
            ? <button onClick={handleSaveNew}>Place on Canvas</button>
            : <>
                <button onClick={handleSaveEdit}>Save</button>
                <button className={styles.deleteBtn} onClick={handleDelete}>Delete</button>
              </>
          }
          <button onClick={closePanel}>Cancel</button>
        </div>
      )}

      <div
        ref={viewportRef}
        className={`${styles.floorCanvasWrap} ${snap ? styles.floorCanvasSnap : ''}`}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div
          ref={canvasRef}
          className={styles.floorCanvas}
          style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
        >
          {tables.map(t => {
            const pos = getPos(t);
            return (
              <div
                key={t.id}
                className={[
                  styles.canvasTable,
                  t.shape === 'ROUND' ? styles.canvasRound : '',
                  selected === t.id ? styles.canvasSelected : '',
                  dragging?.id === t.id ? styles.canvasDragging : '',
                ].join(' ')}
                style={{ left: pos.x, top: pos.y }}
                onMouseDown={e => handleMouseDown(e, t)}
                onClick={() => handleSelectTable(t)}
              >
                {t.name ?? t.label}
              </div>
            );
          })}
          {tables.length === 0 && (
            <p className={styles.canvasEmpty}>No tables yet — click &ldquo;+ Add&rdquo; to create one.</p>
          )}
        </div>

        {/* Bottom-right overlay controls */}
        <div className={styles.canvasOverlay}>
          <button
            className={`${styles.overlaySnapBtn} ${snap ? styles.overlaySnapActive : ''}`}
            onClick={() => setSnap(s => !s)}
          >
            ⊞ Snap {snap ? 'On' : 'Off'}
          </button>
          <div className={styles.overlayZoom}>
            <button onClick={() => setZoom(z => parseFloat(Math.max(0.4, z - 0.1).toFixed(1)))} title="Zoom out">−</button>
            <span>{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(z => parseFloat(Math.min(2.0, z + 0.1).toFixed(1)))} title="Zoom in">+</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Categories ----
function CategoriesTab() {
  const [cats, setCats] = useState<Category[]>([]);
  const [editing, setEditing] = useState<Partial<Category> | null>(null);
  const load = useCallback(async () => setCats(await api.menu.categories()), []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!editing) return;
    const payload = { name: editing.name!, sortOrder: editing.sortOrder ?? 0 };
    if (editing.id) await api.menu.updateCategory(editing.id, payload);
    else await api.menu.createCategory(payload);
    setEditing(null);
    await load();
  };

  return (
    <div className={styles.tab}>
      <div className={styles.tabHeader}>
        <h3>Categories</h3>
        <button className={styles.addBtn} onClick={() => setEditing({})}>+ Add</button>
      </div>
      {editing !== null && (
        <div className={styles.form}>
          <div className={styles.fieldGroup}>
            <span>Name</span>
            <input value={editing.name ?? ''} onChange={e => setEditing({ ...editing, name: e.target.value })} placeholder="Category name" autoFocus />
          </div>
          <div className={styles.fieldGroup}>
            <span>Sort Order</span>
            <input type="number" value={editing.sortOrder ?? 0} onChange={e => setEditing({ ...editing, sortOrder: +e.target.value })} />
          </div>
          <button onClick={save}>Save</button>
          <button onClick={() => setEditing(null)}>Cancel</button>
        </div>
      )}
      <table className={styles.table}>
        <thead><tr><th>Name</th><th>Sort</th><th>Actions</th></tr></thead>
        <tbody>
          {cats.map(c => (
            <tr key={c.id}>
              <td>{c.name}</td>
              <td>{c.sortOrder}</td>
              <td>
                <button onClick={() => setEditing(c)}>Edit</button>
                <button onClick={async () => { await api.menu.deleteCategory(c.id); await load(); }}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---- Menu Items ----
function MenuTab() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [editing, setEditing] = useState<Partial<MenuItem> | null>(null);
  const load = useCallback(async () => {
    const [i, c] = await Promise.all([api.menu.items(), api.menu.categories()]);
    setItems(i.map(item => ({ ...item, price: Number(item.price) })));
    setCats(c);
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!editing) return;
    const payload = {
      categoryId: editing.categoryId!,
      name: editing.name!,
      price: editing.price ?? 0,
      type: (editing.type ?? 'FOOD') as 'FOOD' | 'DRINK',
      isTaxable: editing.isTaxable ?? true,
      printDestination: (editing.printDestination ?? 'KITCHEN') as 'KITCHEN' | 'BAR' | 'NONE',
      isAvailable: editing.isAvailable ?? true,
    };
    if (editing.id) await api.menu.updateItem(editing.id, payload);
    else await api.menu.createItem(payload);
    setEditing(null);
    await load();
  };

  return (
    <div className={styles.tab}>
      <div className={styles.tabHeader}>
        <h3>Menu Items</h3>
        <button className={styles.addBtn} onClick={() => setEditing({})}>+ Add</button>
      </div>
      {editing !== null && (
        <div className={styles.form}>
          <div className={styles.fieldGroup}>
            <span>Category</span>
            <select value={editing.categoryId ?? ''} onChange={e => setEditing({ ...editing, categoryId: e.target.value })}>
              <option value="">— Select —</option>
              {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className={styles.fieldGroup}>
            <span>Name</span>
            <input value={editing.name ?? ''} onChange={e => setEditing({ ...editing, name: e.target.value })} placeholder="Item name" autoFocus />
          </div>
          <div className={styles.fieldGroup}>
            <span>Price</span>
            <input type="number" step="0.01" value={editing.price ?? ''} onChange={e => setEditing({ ...editing, price: parseFloat(e.target.value) })} placeholder="0.00" />
          </div>
          <div className={styles.fieldGroup}>
            <span>Type</span>
            <select value={editing.type ?? 'FOOD'} onChange={e => setEditing({ ...editing, type: e.target.value as 'FOOD' | 'DRINK' })}>
              <option value="FOOD">Food</option>
              <option value="DRINK">Drink</option>
            </select>
          </div>
          <div className={styles.fieldGroup}>
            <span>Print Destination</span>
            <select value={editing.printDestination ?? 'KITCHEN'} onChange={e => setEditing({ ...editing, printDestination: e.target.value as 'KITCHEN' | 'BAR' | 'NONE' })}>
              <option value="KITCHEN">Kitchen</option>
              <option value="BAR">Bar</option>
              <option value="NONE">None</option>
            </select>
          </div>
          <label>
            <input type="checkbox" checked={editing.isTaxable ?? true} onChange={e => setEditing({ ...editing, isTaxable: e.target.checked })} />
            {' '}Taxable
          </label>
          <label>
            <input type="checkbox" checked={editing.isAvailable ?? true} onChange={e => setEditing({ ...editing, isAvailable: e.target.checked })} />
            {' '}Available
          </label>
          <button onClick={save}>Save</button>
          <button onClick={() => setEditing(null)}>Cancel</button>
        </div>
      )}
      <table className={styles.table}>
        <thead><tr><th>Name</th><th>Category</th><th>Type</th><th>Print</th><th>Price</th><th>Available</th><th>Actions</th></tr></thead>
        <tbody>
          {items.map(item => (
            <tr key={item.id}>
              <td>{item.name}</td>
              <td>{cats.find(c => c.id === item.categoryId)?.name ?? '—'}</td>
              <td>{item.type}</td>
              <td>{item.printDestination}</td>
              <td>${item.price.toFixed(2)}</td>
              <td>{item.isAvailable ? 'Yes' : 'No'}</td>
              <td>
                <button onClick={() => setEditing(item)}>Edit</button>
                <button onClick={async () => { await api.menu.deleteItem(item.id); await load(); }}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---- Modifiers ----
function ModifiersTab() {
  const [mods, setMods] = useState<Modifier[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [editing, setEditing] = useState<Partial<Modifier> | null>(null);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [itemMods, setItemMods] = useState<Modifier[]>([]);

  const loadMods = useCallback(async () => {
    setMods(await api.menu.modifiers());
  }, []);

  const loadItems = useCallback(async () => {
    setItems(await api.menu.items());
  }, []);

  useEffect(() => { loadMods(); loadItems(); }, [loadMods, loadItems]);

  useEffect(() => {
    if (!selectedItemId) { setItemMods([]); return; }
    api.menu.listItemModifiers(selectedItemId).then(setItemMods);
  }, [selectedItemId, mods]);

  const saveLibraryMod = async () => {
    if (!editing) return;
    const payload = {
      label: editing.label!,
      action: (editing.action ?? 'ADD') as 'ADD' | 'REMOVE',
      priceDelta: editing.priceDelta ?? 0,
    };
    if (editing.id) await api.menu.updateModifier(editing.id, payload);
    else await api.menu.createModifier(payload);
    setEditing(null);
    await loadMods();
  };

  const deleteMod = async (id: string) => {
    if (!confirm('Delete this modifier from the library? It will be removed from all items.')) return;
    await api.menu.deleteModifier(id);
    await loadMods();
  };

  const assign = async (modId: string) => {
    if (!selectedItemId) return;
    await api.menu.assignModifier(selectedItemId, modId);
    const updated = await api.menu.listItemModifiers(selectedItemId);
    setItemMods(updated);
  };

  const unassign = async (modId: string) => {
    if (!selectedItemId) return;
    await api.menu.unassignModifier(selectedItemId, modId);
    const updated = await api.menu.listItemModifiers(selectedItemId);
    setItemMods(updated);
  };

  const assignedIds = new Set(itemMods.map(m => m.id));

  return (
    <div className={styles.tab}>
      <div className={styles.tabHeader}>
        <h3>Modifiers</h3>
      </div>

      <div className={styles.modifiersLayout}>
        {/* Left: global library */}
        <div className={styles.modifiersPanel}>
          <div className={styles.modifiersPanelHeader}>
            <span>Modifier Library</span>
            <button className={styles.addBtn} onClick={() => setEditing({})}>+ New</button>
          </div>

          {editing !== null && (
            <div className={styles.form}>
              <div className={styles.fieldGroup}>
                <span>Label</span>
                <input value={editing.label ?? ''} onChange={e => setEditing({ ...editing, label: e.target.value })} placeholder="e.g. Extra Bacon" autoFocus />
              </div>
              <div className={styles.fieldGroup}>
                <span>Action</span>
                <select value={editing.action ?? 'ADD'} onChange={e => setEditing({ ...editing, action: e.target.value as 'ADD' | 'REMOVE' })}>
                  <option value="ADD">Add</option>
                  <option value="REMOVE">Remove</option>
                </select>
              </div>
              <div className={styles.fieldGroup}>
                <span>Price Delta ($)</span>
                <input type="number" step="0.01" min="0" value={editing.priceDelta ?? 0} onChange={e => setEditing({ ...editing, priceDelta: parseFloat(e.target.value) })} />
              </div>
              <button onClick={saveLibraryMod}>Save</button>
              <button onClick={() => setEditing(null)}>Cancel</button>
            </div>
          )}

          <table className={styles.table}>
            <thead><tr><th>Label</th><th>Action</th><th>Price</th><th></th></tr></thead>
            <tbody>
              {mods.map(m => (
                <tr key={m.id}>
                  <td>{m.label}</td>
                  <td>{m.action}</td>
                  <td>{Number(m.priceDelta) > 0 ? `+$${Number(m.priceDelta).toFixed(2)}` : 'free'}</td>
                  <td>
                    <button onClick={() => setEditing({ ...m, priceDelta: Number(m.priceDelta) })}>Edit</button>
                    <button className={styles.deleteBtn} onClick={() => deleteMod(m.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Right: assign to items */}
        <div className={styles.modifiersPanel}>
          <div className={styles.modifiersPanelHeader}>
            <span>Assign to Menu Item</span>
          </div>
          <div className={styles.fieldGroup} style={{ marginBottom: 12 }}>
            <span>Item</span>
            <select className={styles.headerSelect} value={selectedItemId} onChange={e => setSelectedItemId(e.target.value)}>
              <option value="">— Select item —</option>
              {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </div>

          {selectedItemId && (
            <table className={styles.table}>
              <thead><tr><th>Modifier</th><th>Action</th><th>Price</th><th>Assigned</th></tr></thead>
              <tbody>
                {mods.map(m => (
                  <tr key={m.id}>
                    <td>{m.label}</td>
                    <td>{m.action}</td>
                    <td>{Number(m.priceDelta) > 0 ? `+$${Number(m.priceDelta).toFixed(2)}` : 'free'}</td>
                    <td>
                      {assignedIds.has(m.id)
                        ? <button className={styles.deleteBtn} onClick={() => unassign(m.id)}>Remove</button>
                        : <button onClick={() => assign(m.id)}>Add</button>
                      }
                    </td>
                  </tr>
                ))}
                {mods.length === 0 && <tr><td colSpan={4}>No modifiers in library yet.</td></tr>}
              </tbody>
            </table>
          )}
          {!selectedItemId && <p className={styles.emptyHint}>Select an item to manage its modifiers.</p>}
        </div>
      </div>
    </div>
  );
}

// ---- Users ----
interface UserEditing { id?: string; name?: string; role?: string; pin?: string; confirmPin?: string; }

function UsersTab() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [editing, setEditing] = useState<UserEditing | null>(null);
  const [pinError, setPinError] = useState('');
  const load = useCallback(async () => setUsers(await api.users.list()), []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!editing) return;
    if (!editing.id && !editing.pin) { setPinError('PIN is required'); return; }
    if (editing.pin && editing.pin !== editing.confirmPin) { setPinError('PINs do not match'); return; }
    if (editing.pin && editing.pin.length !== 4) { setPinError('PIN must be exactly 4 digits'); return; }
    setPinError('');
    const payload: Record<string, string> = {};
    if (editing.name) payload.name = editing.name;
    if (editing.role) payload.role = editing.role;
    if (editing.pin) payload.pin = editing.pin;
    if (editing.id) await api.users.update(editing.id, payload);
    else await api.users.create(payload as { name: string; role: string; pin: string });
    setEditing(null);
    await load();
  };

  return (
    <div className={styles.tab}>
      <div className={styles.tabHeader}>
        <h3>Users</h3>
        <button className={styles.addBtn} onClick={() => { setEditing({ role: 'server' }); setPinError(''); }}>+ Add</button>
      </div>
      {editing !== null && (
        <div className={styles.form}>
          <div className={styles.fieldGroup}>
            <span>Name</span>
            <input value={editing.name ?? ''} onChange={e => setEditing({ ...editing, name: e.target.value })} placeholder="Full name" autoFocus />
          </div>
          <div className={styles.fieldGroup}>
            <span>Role</span>
            <select value={editing.role ?? 'server'} onChange={e => setEditing({ ...editing, role: e.target.value })}>
              <option value="admin">Admin</option>
              <option value="server">Server</option>
              <option value="bartender">Bartender</option>
            </select>
          </div>
          <div className={styles.fieldGroup}>
            <span>{editing.id ? 'New PIN (leave blank to keep)' : 'PIN'}</span>
            <input
              type="password"
              value={editing.pin ?? ''}
              onChange={e => setEditing({ ...editing, pin: e.target.value.replace(/\D/g, '').slice(0, 4) })}
              placeholder="4-digit PIN"
              inputMode="numeric"
              maxLength={4}
            />
          </div>
          <div className={styles.fieldGroup}>
            <span>Confirm PIN</span>
            <input
              type="password"
              value={editing.confirmPin ?? ''}
              onChange={e => setEditing({ ...editing, confirmPin: e.target.value.replace(/\D/g, '').slice(0, 4) })}
              placeholder="Repeat PIN"
              inputMode="numeric"
              maxLength={4}
            />
          </div>
          {pinError && <p style={{ color: 'red', margin: '0 0 8px' }}>{pinError}</p>}
          <button onClick={save}>Save</button>
          <button onClick={() => setEditing(null)}>Cancel</button>
        </div>
      )}
      <table className={styles.table}>
        <thead><tr><th>Name</th><th>Role</th><th>Created</th><th>Actions</th></tr></thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id}>
              <td>{u.name}</td>
              <td>{u.role}</td>
              <td>{new Date(u.createdAt).toLocaleDateString()}</td>
              <td>
                <button onClick={() => { setEditing({ id: u.id, name: u.name, role: u.role }); setPinError(''); }}>Edit</button>
                {currentUser?.id !== u.id && (
                  <button onClick={async () => { await api.users.delete(u.id); await load(); }}>Delete</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---- Stations ----
function StationsTab() {
  const [stations, setStations] = useState<StationRow[]>([]);
  const [floorPlans, setFloorPlans] = useState<FloorPlan[]>([]);
  const [msg, setMsg] = useState('');
  const load = useCallback(async () => {
    const [s, fp] = await Promise.all([api.stations.list(), api.floorPlans.list()]);
    setStations(s);
    setFloorPlans(fp);
  }, []);
  useEffect(() => { load(); }, [load]);

  const handleResetLockout = async (s: StationRow) => {
    await api.stations.resetLockout(s.id);
    setMsg(`Lockout cleared for ${s.name}`);
    setTimeout(() => setMsg(''), 3000);
  };

  const handleRevoke = async (s: StationRow) => {
    if (!confirm(`Revoke station "${s.name}"? It will need to re-register.`)) return;
    await api.stations.delete(s.id);
    await load();
  };

  const handleDefaultFloor = async (s: StationRow, floorPlanId: string) => {
    const value = floorPlanId === '' ? null : floorPlanId;
    await api.stations.setDefaultFloor(s.id, value);
    setStations(prev => prev.map(st => st.id === s.id ? { ...st, defaultFloorPlanId: value } : st));
  };

  return (
    <div className={styles.tab}>
      <div className={styles.tabHeader}>
        <h3>Stations</h3>
        <button className={styles.addBtn} onClick={load}>Refresh</button>
      </div>
      {msg && <p style={{ color: 'green', margin: '0 0 8px' }}>{msg}</p>}
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Name</th>
            <th>MAC Address</th>
            <th>Printer</th>
            <th>Default Floor</th>
            <th>Registered</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {stations.map(s => (
            <tr key={s.id}>
              <td>{s.name}</td>
              <td><code>{s.macAddress}</code></td>
              <td>{s.printerType}{s.printerName ? ` (${s.printerName})` : ''}</td>
              <td>
                <select
                  className={styles.headerSelect}
                  value={s.defaultFloorPlanId ?? ''}
                  onChange={e => handleDefaultFloor(s, e.target.value)}
                >
                  <option value="">— First available —</option>
                  {floorPlans.map(fp => (
                    <option key={fp.id} value={fp.id}>{fp.name}</option>
                  ))}
                </select>
              </td>
              <td>{new Date(s.createdAt).toLocaleDateString()}</td>
              <td>
                <button onClick={() => handleResetLockout(s)}>Reset Lockout</button>
                <button onClick={() => handleRevoke(s)}>Revoke</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---- Printers ----
function PrintersTab() {
  const [printers, setPrinters] = useState<PrinterRow[]>([]);
  const [editing, setEditing] = useState<Partial<PrinterRow> | null>(null);
  const load = useCallback(async () => setPrinters(await api.printers.list()), []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!editing) return;
    const payload = {
      name: editing.name!,
      ipAddress: editing.ipAddress ?? '',
      port: editing.port ?? 9100,
      type: (editing.type ?? 'KITCHEN') as 'KITCHEN' | 'BAR' | 'RECEIPT',
    };
    if (editing.id) await api.printers.update(editing.id, payload);
    else await api.printers.create(payload);
    setEditing(null);
    await load();
  };

  return (
    <div className={styles.tab}>
      <div className={styles.tabHeader}>
        <h3>Printers</h3>
        <button className={styles.addBtn} onClick={() => setEditing({})}>+ Add</button>
      </div>
      {editing !== null && (
        <div className={styles.form}>
          <div className={styles.fieldGroup}>
            <span>Name</span>
            <input value={editing.name ?? ''} onChange={e => setEditing({ ...editing, name: e.target.value })} placeholder="Printer name" autoFocus />
          </div>
          <div className={styles.fieldGroup}>
            <span>IP Address</span>
            <input value={editing.ipAddress ?? ''} onChange={e => setEditing({ ...editing, ipAddress: e.target.value })} placeholder="192.168.1.x" />
          </div>
          <div className={styles.fieldGroup}>
            <span>Port</span>
            <input type="number" value={editing.port ?? 9100} onChange={e => setEditing({ ...editing, port: +e.target.value })} />
          </div>
          <div className={styles.fieldGroup}>
            <span>Type</span>
            <select value={editing.type ?? 'KITCHEN'} onChange={e => setEditing({ ...editing, type: e.target.value as PrinterRow['type'] })}>
              <option value="KITCHEN">Kitchen</option>
              <option value="BAR">Bar</option>
              <option value="RECEIPT">Receipt</option>
            </select>
          </div>
          <button onClick={save}>Save</button>
          <button onClick={() => setEditing(null)}>Cancel</button>
        </div>
      )}
      <table className={styles.table}>
        <thead><tr><th>Name</th><th>IP</th><th>Port</th><th>Type</th><th>Actions</th></tr></thead>
        <tbody>
          {printers.map(p => (
            <tr key={p.id}>
              <td>{p.name}</td>
              <td>{p.ipAddress}</td>
              <td>{p.port}</td>
              <td>{p.type}</td>
              <td>
                <button onClick={() => setEditing(p)}>Edit</button>
                <button onClick={async () => { await api.printers.delete(p.id); await load(); }}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---- Settings ----
interface SettingItem { key: string; value: string }

function SettingsTab() {
  const { logout, user } = useAuth();
  const [settings, setSettings] = useState<SettingItem[]>([]);
  const [dirty, setDirty] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [resetStep, setResetStep] = useState<'idle' | 'confirm' | 'pin' | 'running'>('idle');
  const [resetError, setResetError] = useState('');
  const [resetPin, setResetPin] = useState('');

  const load = useCallback(async () => {
    try { setSettings(await api.settings.list()); } catch { /* endpoint may not exist */ }
  }, []);
  useEffect(() => { load(); }, [load]);

  const handleChange = (key: string, value: string) => setDirty(d => ({ ...d, [key]: value }));

  const saveAll = async () => {
    await Promise.all(Object.entries(dirty).map(([key, value]) => api.settings.set(key, value)));
    setDirty({});
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    await load();
  };

  const handleFactoryReset = async () => {
    setResetStep('running');
    setResetError('');
    try {
      await api.settings.factoryReset(resetPin);
      logout();
    } catch (e: unknown) {
      setResetError(e instanceof Error ? e.message : 'Reset failed');
      setResetPin('');
      setResetStep('pin');
    }
  };

  return (
    <div className={styles.tab}>
      <div className={styles.tabHeader}>
        <h3>Settings</h3>
        {saved && <span className={styles.savedBadge}>Saved!</span>}
        <button className={styles.addBtn} onClick={saveAll} disabled={Object.keys(dirty).length === 0}>Save changes</button>
      </div>
      <table className={styles.table}>
        <thead><tr><th>Setting</th><th>Value</th></tr></thead>
        <tbody>
          {settings.map(s => {
            const currentVal = dirty[s.key] ?? s.value;
            const LABELS: Record<string, string> = {
              auto_logout: 'Auto-logout',
              auto_logout_timeout: 'Auto-logout Idle Timeout (seconds)',
              tax_rate: 'Tax Rate',
              pin_lockout_threshold: 'PIN Lockout Attempts',
              pin_lockout_duration: 'PIN Lockout Duration (seconds)',
            };
            const label = LABELS[s.key] ?? s.key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            const isBool = s.key === 'auto_logout';
            return (
              <tr key={s.key}>
                <td>{label}</td>
                <td>
                  {isBool ? (
                    <select
                      value={currentVal === 'true' ? 'true' : 'false'}
                      onChange={e => handleChange(s.key, e.target.value)}
                      className={styles.headerSelect}
                    >
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  ) : (
                    <input
                      value={currentVal}
                      onChange={e => handleChange(s.key, e.target.value)}
                      className={dirty[s.key] !== undefined ? styles.dirtyInput : undefined}
                    />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {user?.role === 'admin' && (
      <div className={styles.dangerZone}>
        <p className={styles.dangerZoneLabel}>Danger Zone</p>
        {resetStep === 'idle' && (
          <div className={styles.dangerZoneRow}>
            <div className={styles.dangerZoneText}>
              <strong>Factory Reset</strong>
              <span>Wipes all users, orders, menu, floor plans, stations and printers. Settings are restored to defaults. This cannot be undone.</span>
            </div>
            <button className={styles.dangerBtn} onClick={() => setResetStep('confirm')}>
              Factory Reset
            </button>
          </div>
        )}
        {resetStep === 'confirm' && (
          <div className={styles.dangerZoneConfirm}>
            <p className={styles.dangerZoneWarning}>All data will be permanently deleted and you will be logged out. This action cannot be reversed.</p>
            <div className={styles.dangerZoneActions}>
              <button className={styles.dangerBtnSolid} onClick={() => { setResetPin(''); setResetError(''); setResetStep('pin'); }}>Continue</button>
              <button className={styles.dangerCancelBtn} onClick={() => { setResetStep('idle'); setResetError(''); }}>Cancel</button>
            </div>
          </div>
        )}
        {resetStep === 'pin' && (
          <div className={styles.dangerZoneConfirm}>
            <p className={styles.dangerZoneWarning}>Enter your admin PIN to confirm the factory reset.</p>
            <div className={styles.resetPinDots}>
              {Array.from({ length: Math.max(4, resetPin.length) }).map((_, i) => (
                <span key={i} className={`${styles.resetPinDot} ${i < resetPin.length ? styles.resetPinDotFilled : ''}`} />
              ))}
            </div>
            {resetError && <p className={styles.dangerZoneError}>{resetError}</p>}
            <div className={styles.resetPinPad}>
              {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((k, i) => (
                <button
                  key={i}
                  className={styles.resetPinKey}
                  disabled={!k}
                  onClick={() => {
                    if (k === '⌫') { setResetPin(p => p.slice(0, -1)); }
                    else if (resetPin.length < 4) { setResetPin(p => p + k); }
                  }}
                >
                  {k}
                </button>
              ))}
            </div>
            <div className={styles.dangerZoneActions}>
              <button
                className={styles.dangerBtnSolid}
                disabled={resetPin.length < 4}
                onClick={handleFactoryReset}
              >
                Wipe Everything
              </button>
              <button className={styles.dangerCancelBtn} onClick={() => { setResetStep('idle'); setResetPin(''); setResetError(''); }}>Cancel</button>
            </div>
          </div>
        )}
        {resetStep === 'running' && (
          <p className={styles.dangerZoneRunning}>Resetting&hellip;</p>
        )}
      </div>
      )}
    </div>
  );
}

// ---- Reports ----
function ReportsTab() {
  const [daily, setDaily] = useState<DailyReport | null>(null);
  const [tableRpts, setTableRpts] = useState<TableReport[]>([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const load = useCallback(async (d: string) => {
    try { setDaily(await api.reports.daily(d)); } catch { setDaily(null); }
    try { setTableRpts(await api.reports.tables()); } catch { setTableRpts([]); }
  }, []);
  useEffect(() => { load(date); }, [date, load]);

  const orders = daily ? (daily.orderCount ?? daily.totalOrders ?? 0) : 0;
  const tips = daily ? (daily.totalTips ?? 0) : 0;

  return (
    <div className={styles.tab}>
      <div className={styles.tabHeader}>
        <h3>Daily Report</h3>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className={styles.dateInput} />
      </div>
      {daily ? (
        <div className={styles.report}>
          <div className={styles.reportGrid}>
            <div className={styles.stat}><label>Orders</label><span>{orders}</span></div>
            <div className={styles.stat}><label>Revenue</label><span>${(daily.totalRevenue ?? 0).toFixed(2)}</span></div>
            <div className={styles.stat}><label>Pending</label><span>${(daily.pendingRevenue ?? 0).toFixed(2)}</span></div>
            <div className={styles.stat}><label>Tips</label><span>${tips.toFixed(2)}</span></div>
            <div className={styles.stat}><label>Tax</label><span>${(daily.totalTax ?? 0).toFixed(2)}</span></div>
            <div className={styles.stat}><label>Cash</label><span>${(daily.cashRevenue ?? 0).toFixed(2)}</span></div>
            <div className={styles.stat}><label>Card</label><span>${(daily.cardRevenue ?? 0).toFixed(2)}</span></div>
          </div>
          {tableRpts.length > 0 && (
            <>
              <h4>By Table</h4>
              <table className={styles.table}>
                <thead><tr><th>Table</th><th>Revenue</th><th>Status</th></tr></thead>
                <tbody>
                  {tableRpts.map(t => (
                    <tr key={t.tableId}>
                      <td>{t.tableLabel ?? t.name}</td>
                      <td>${(t.totalRevenue ?? t.openOrderTotal ?? 0).toFixed(2)}</td>
                      <td>{t.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      ) : (
        <p className={styles.empty}>No data for this date.</p>
      )}
    </div>
  );
}

// ---- Root ----
const TABS: { group: string; items: { id: Tab; label: string }[] }[] = [
  {
    group: 'Venue',
    items: [
      { id: 'floorplans', label: 'Floor Plans' },
      { id: 'tables', label: 'Tables' },
    ],
  },
  {
    group: 'Menu',
    items: [
      { id: 'categories', label: 'Categories' },
      { id: 'menu', label: 'Menu Items' },
      { id: 'modifiers', label: 'Modifiers' },
    ],
  },
  {
    group: 'Staff',
    items: [
      { id: 'users', label: 'Users' },
      { id: 'stations', label: 'Stations' },
    ],
  },
  {
    group: 'System',
    items: [
      { id: 'printers', label: 'Printers' },
      { id: 'settings', label: 'Settings' },
      { id: 'reports', label: 'Reports' },
    ],
  },
];

interface Props { onClose: () => void }

export default function BackOffice({ onClose }: Props) {
  const [tab, setTab] = useState<Tab>('reports');

  return (
    <div className={styles.container}>
      <div className={styles.sidebar}>
        <div className={styles.sidebarTitle}>Back Office</div>
        {TABS.map(group => (
          <div key={group.group}>
            <div className={styles.sidebarGroup}>{group.group}</div>
            {group.items.map(t => (
              <button
                key={t.id}
                className={`${styles.sidebarBtn} ${tab === t.id ? styles.active : ''}`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        ))}
        <div className={styles.sidebarSpacer} />
        <button className={styles.closeBtn} onClick={onClose}>← Back</button>
      </div>
      <div className={styles.main}>
        {tab === 'floorplans' && <FloorPlanTab />}
        {tab === 'tables' && <TablesTab />}
        {tab === 'categories' && <CategoriesTab />}
        {tab === 'menu' && <MenuTab />}
        {tab === 'modifiers' && <ModifiersTab />}
        {tab === 'users' && <UsersTab />}
        {tab === 'stations' && <StationsTab />}
        {tab === 'printers' && <PrintersTab />}
        {tab === 'settings' && <SettingsTab />}
        {tab === 'reports' && <ReportsTab />}
      </div>
    </div>
  );
}
