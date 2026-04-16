import { useState, useEffect } from 'react';
import { api, setBaseUrl, setStationId } from './api';
import type { TableRow } from './api';
import { AuthProvider, useAuth } from './context/AuthContext';
import { WsProvider, useWs } from './context/WsContext';
import { printBarChit } from './print';
import type { BarChit } from './print';
import Setup from './screens/Setup';
import Login from './screens/Login';
import FirstRun from './screens/FirstRun';
import TableView from './screens/TableView';
import OrderScreen from './screens/OrderScreen';
import KitchenScreen from './screens/KitchenScreen';
import BarScreen from './screens/BarScreen';
import PaymentScreen from './screens/PaymentScreen';
import BackOffice from './screens/BackOffice';
import './App.css';

type Screen = 'tables' | 'order' | 'kitchen' | 'bar' | 'payment' | 'backoffice';

// ── Inner app (requires auth + ws context) ────────────────────────────────────
function InnerApp() {
  const { user, logout, loginDirect, initialized } = useAuth();
  const { connected, on } = useWs();
  const [screen, setScreen] = useState<Screen>('tables');
  const [selectedTable, setSelectedTable] = useState<TableRow | null>(null);
  const [paymentOrderId, setPaymentOrderId] = useState<string | null>(null);
  const [autoLogout, setAutoLogout] = useState(true);
  const [autoLogoutTimeout, setAutoLogoutTimeout] = useState(120); // seconds
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);

  // Load auto-logout settings whenever user changes
  useEffect(() => {
    if (!user) return;
    api.settings.list().then(rows => {
      const al = rows.find(r => r.key === 'auto_logout')?.value;
      const alt = rows.find(r => r.key === 'auto_logout_timeout')?.value;
      setAutoLogout(al !== 'false');
      if (alt) setAutoLogoutTimeout(parseInt(alt, 10) || 120);
    }).catch(() => {});
  }, [user]);

  // Check if any users exist (show FirstRun if not)
  useEffect(() => {
    if (user) { setNeedsSetup(false); return; }
    if (!initialized) return;
    api.auth.setupStatus().then(({ needsSetup }) => setNeedsSetup(needsSetup)).catch(() => setNeedsSetup(false));
  }, [user, initialized]);

  // Idle session timeout — resets on any user activity
  useEffect(() => {
    if (!user || !autoLogout || autoLogoutTimeout <= 0) return;
    let timer: ReturnType<typeof setTimeout>;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => logout(), autoLogoutTimeout * 1000);
    };
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart'] as const;
    events.forEach(e => window.addEventListener(e, reset));
    reset(); // start immediately
    return () => {
      clearTimeout(timer);
      events.forEach(e => window.removeEventListener(e, reset));
    };
  }, [user, autoLogout, autoLogoutTimeout, logout]);

  // Auto-print bar chits for new orders with BAR items
  useEffect(() => {
    const handle = (envelope: unknown) => {
      const env = envelope as { data: { orderId: string; tableId: string; items?: { printDestination: string; id: string; name: string; quantity: number; unitPrice: number; isTaxable: boolean; appliedModifiers: { label: string; action: string; priceDelta: number }[]; notes: string; status: string }[] } };
      const barItems = (env.data.items ?? []).filter(i => i.printDestination === 'BAR');
      if (!barItems.length) return;
      const chit: BarChit = {
        orderId: env.data.orderId,
        tableId: env.data.tableId,
        items: barItems,
        receivedAt: new Date().toISOString(),
      };
      printBarChit(chit).catch(() => {});
    };
    const off1 = on('order.created', handle);
    const off2 = on('order.updated', handle);
    return () => { off1(); off2(); };
  }, [on]);

  if (!initialized) return null;
  if (!user) {
    if (needsSetup === null) return null; // still checking
    if (needsSetup) return <FirstRun onComplete={loginDirect} />;
    return <Login />;
  }

  const handleSelectTable = (table: TableRow) => {
    setSelectedTable(table);
    setScreen('order');
  };

  const handlePayment = (orderId: string) => {
    setPaymentOrderId(orderId);
    setScreen('payment');
  };

  const handlePaymentComplete = () => {
    setScreen('tables');
    setSelectedTable(null);
    setPaymentOrderId(null);
  };

  const handleBackToTables = () => {
    setScreen('tables');
    setSelectedTable(null);
  };

  return (
    <div className="app">
      {/* Connection lost overlay */}
      {!connected && (
        <div className="connection-lost">
          <div className="connection-lost-inner">
            <p>Connection lost</p>
            <small>Reconnecting to server…</small>
          </div>
        </div>
      )}

      {/* Navigation bar */}
      <nav className="nav">
        <img src="/logo.png" alt="RapidTicket" className="nav-logo" />
        <button className={`nav-btn ${screen === 'tables' ? 'active' : ''}`} onClick={() => setScreen('tables')}>Tables</button>
        <button className={`nav-btn ${screen === 'kitchen' ? 'active' : ''}`} onClick={() => setScreen('kitchen')}>Kitchen</button>
        {(user.role === 'admin' || user.role === 'bar') && (
          <button className={`nav-btn ${screen === 'bar' ? 'active' : ''}`} onClick={() => setScreen('bar')}>Bar</button>
        )}
        {user.role === 'admin' && (
          <button className={`nav-btn ${screen === 'backoffice' ? 'active' : ''}`} onClick={() => setScreen('backoffice')}>Back Office</button>
        )}
        <div className="nav-spacer" />
        <span className="nav-user">{user.name}</span>
        <button className="nav-logout" onClick={logout}>Logout</button>
      </nav>

      {/* Screens */}
      <div className="screen">
        {screen === 'tables' && <TableView onSelectTable={handleSelectTable} />}
        {screen === 'order' && selectedTable && (
          <OrderScreen table={selectedTable} onBack={handleBackToTables} onPayment={handlePayment} />
        )}
        {screen === 'kitchen' && <KitchenScreen />}
        {screen === 'bar' && <BarScreen />}
        {screen === 'payment' && paymentOrderId && (
          <PaymentScreen orderId={paymentOrderId} onComplete={handlePaymentComplete} onBack={() => setScreen('order')} />
        )}
        {screen === 'backoffice' && user.role === 'admin' && (
          <BackOffice onClose={() => setScreen('tables')} />
        )}
      </div>
    </div>
  );
}

// ── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [config, setConfig] = useState<AppConfig | null | undefined>(undefined);

  useEffect(() => {
    if (window.electronAPI?.config?.read) {
      window.electronAPI.config.read().then(c => setConfig(c ?? null));
    } else {
      // Dev mode without Electron: use defaults
      const stored = sessionStorage.getItem('rt_config');
      setConfig(stored ? JSON.parse(stored) : null);
    }
  }, []);

  const handleSetupComplete = (cfg: AppConfig) => {
    if (window.electronAPI?.config?.write) {
      window.electronAPI.config.write(cfg);
    } else {
      sessionStorage.setItem('rt_config', JSON.stringify(cfg));
    }
    setBaseUrl(cfg.serverUrl);
    setConfig(cfg);
  };

  // Still loading config
  if (config === undefined) {
    return <div className="splash">Loading…</div>;
  }

  // No config → Show Setup
  if (!config) {
    return <Setup onComplete={handleSetupComplete} />;
  }

  setBaseUrl(config.serverUrl);
  setStationId(config.stationId ?? null);

  return (
    <AuthProvider>
      <WsProvider url={config.serverUrl}>
        <InnerApp />
      </WsProvider>
    </AuthProvider>
  );
}
