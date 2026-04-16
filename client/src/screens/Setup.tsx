import { useState } from 'react';
import { setBaseUrl, api } from '../api';
import styles from './Setup.module.css';

interface Props {
  onComplete: (config: AppConfig) => void;
}

export default function Setup({ onComplete }: Props) {
  const [step, setStep] = useState<'server' | 'printer' | 'registering'>('server');
  const [serverUrl, setServerUrl] = useState('http://192.168.1.10:3000');
  const [printerType, setPrinterType] = useState<'USB' | 'BLUETOOTH' | 'NONE'>('NONE');
  const [printerName, setPrinterName] = useState<string | null>(null);
  const [printers, setPrinters] = useState<{ name: string; isDefault: boolean }[]>([]);
  const [error, setError] = useState('');

  const handleServerNext = async () => {
    setError('');
    try {
      setBaseUrl(serverUrl);
      // Quick connectivity check
      await fetch(`${serverUrl}/settings/tax-rate`).then(r => { if (!r.ok && r.status !== 401) throw new Error(); });
      // Detect printers
      if (window.electronAPI) {
        const list = await window.electronAPI.system.listPrinters();
        setPrinters(list);
        const def = list.find(p => p.isDefault);
        if (def) { setPrinterName(def.name); setPrinterType('USB'); }
      }
      setStep('printer');
    } catch {
      setError('Cannot reach server. Check the IP and port.');
    }
  };

  const handleRegister = async () => {
    setStep('registering');
    setError('');
    try {
      let mac = 'unknown';
      if (window.electronAPI) {
        mac = (await window.electronAPI.system.mac()) ?? 'unknown';
      }
      const stationName = `Station-${mac.replace(/:/g, '').slice(-6).toUpperCase()}`;
      const { stationId, license } = await api.stations.register({
        stationName, macAddress: mac, printerType, printerName,
      });
      const config: AppConfig = { serverUrl, stationId, licenseToken: license, printerName, printerType };
      if (window.electronAPI) await window.electronAPI.config.write(config);
      onComplete(config);
    } catch (e) {
      setError((e as Error).message);
      setStep('printer');
    }
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>RapidTicket Setup</h1>

      {step === 'server' && (
        <div className={styles.card}>
          <h2>Server Address</h2>
          <p>Enter the LAN IP address and port of the RapidTicket server.</p>
          <input
            className={styles.input}
            value={serverUrl}
            onChange={e => setServerUrl(e.target.value)}
            placeholder="http://192.168.1.10:3000"
          />
          {error && <p className={styles.error}>{error}</p>}
          <button className={styles.btn} onClick={handleServerNext}>Next</button>
        </div>
      )}

      {step === 'printer' && (
        <div className={styles.card}>
          <h2>Printer Setup</h2>
          <p>Select the printer attached to this station.</p>
          <select className={styles.input} value={printerType} onChange={e => setPrinterType(e.target.value as 'USB' | 'BLUETOOTH' | 'NONE')}>
            <option value="NONE">No Printer</option>
            <option value="USB">USB</option>
            <option value="BLUETOOTH">Bluetooth</option>
          </select>
          {printerType !== 'NONE' && (
            <select className={styles.input} value={printerName ?? ''} onChange={e => setPrinterName(e.target.value || null)}>
              <option value="">Select printer…</option>
              {printers.map(p => <option key={p.name} value={p.name}>{p.name}{p.isDefault ? ' (default)' : ''}</option>)}
            </select>
          )}
          {error && <p className={styles.error}>{error}</p>}
          <button className={styles.btn} onClick={handleRegister}>Register Station</button>
        </div>
      )}

      {step === 'registering' && (
        <div className={styles.card}>
          <p>Registering station…</p>
        </div>
      )}
    </div>
  );
}
