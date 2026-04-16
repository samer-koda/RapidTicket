import { useState, useEffect, useCallback } from 'react';
import { api, getStationId, type FloorPlan, type TableRow } from '../api';
import { useWs } from '../context/WsContext';
import styles from './TableView.module.css';

interface Props {
  onSelectTable: (table: TableRow) => void;
}

export default function TableView({ onSelectTable }: Props) {
  const [floorPlans, setFloorPlans] = useState<FloorPlan[]>([]);
  const [tables, setTables] = useState<TableRow[]>([]);
  const [activePlan, setActivePlan] = useState<string | null>(null);
  const { on } = useWs();

  const loadTables = useCallback(async (planId: string) => {
    const data = await api.tables.list(planId);
    setTables(data);
  }, []);

  useEffect(() => {
    api.floorPlans.list().then(async plans => {
      setFloorPlans(plans);
      if (plans.length === 0) return;

      // Use the station's configured default floor plan if set, otherwise fall back to first
      let preferredId = plans[0].id;
      const stationId = getStationId();
      if (stationId) {
        try {
          const station = await api.stations.get(stationId);
          if (station.defaultFloorPlanId && plans.some(p => p.id === station.defaultFloorPlanId)) {
            preferredId = station.defaultFloorPlanId;
          }
        } catch { /* fall back to first plan */ }
      }

      setActivePlan(preferredId);
      loadTables(preferredId);
    });
  }, [loadTables]);

  // Real-time: refresh table list on order/payment events
  useEffect(() => {
    if (!activePlan) return;
    const refresh = () => loadTables(activePlan);
    const off1 = on('order.created', refresh);
    const off2 = on('payment.completed', refresh);
    return () => { off1(); off2(); };
  }, [activePlan, on, loadTables]);

  const switchPlan = (id: string) => {
    setActivePlan(id);
    loadTables(id);
  };

  return (
    <div className={styles.container}>
      <div className={styles.tabs}>
        {floorPlans.map(fp => (
          <button
            key={fp.id}
            className={`${styles.tab} ${fp.id === activePlan ? styles.active : ''}`}
            onClick={() => switchPlan(fp.id)}
          >
            {fp.name}
          </button>
        ))}
      </div>

      <div className={styles.canvas}>
        {tables.map(table => (
          <button
            key={table.id}
            className={`${styles.table} ${table.occupied ? styles.occupied : ''}`}
            style={{ left: table.positionX, top: table.positionY }}
            onClick={() => onSelectTable(table)}
          >
            <span className={styles.tableName}>{table.name}</span>
            <span className={styles.tableState}>
              {table.occupied ? 'Occupied' : 'Open'}
            </span>
          </button>
        ))}
        {tables.length === 0 && (
          <p className={styles.empty}>No tables on this floor plan.</p>
        )}
      </div>
    </div>
  );
}
