import { useMemo, useState } from "react";
import "./styles.css";
import { EMPTY_FILTER, GemFilter, MountSlot } from "./rules";
import { actions, useBench, useNow } from "./store";
import {
  BatchPanel,
  BenchFooter,
  FilterBar,
  GemTable,
  Metrics,
  MountDiagram,
  OrderList,
  RuleBanner,
} from "./views";

function App() {
  const state = useBench();
  const nowTs = useNow(1000);
  const [selectedOrderId, setSelectedOrderId] = useState(state.orders[0]?.id ?? "");
  const [filter, setFilter] = useState<GemFilter>(EMPTY_FILTER);

  const order =
    state.orders.find((o) => o.id === selectedOrderId) ?? state.orders[0];

  const sizes = useMemo(
    () => Array.from(new Set(state.gems.map((g) => g.sizeMm))).sort((a, b) => a - b),
    [state.gems]
  );

  // 批次与镶口选择都汇入同一份筛选条件，库存表、批次、镶口共用同一份数据
  const pickSlot = (slot: MountSlot | null) => {
    setFilter((f) =>
      slot
        ? { ...f, shape: slot.shape, sizeMm: slot.sizeMm }
        : { ...f, shape: null, sizeMm: null }
    );
  };

  const activeSlotKey =
    filter.shape && filter.sizeMm !== null ? `${filter.shape}-${filter.sizeMm}` : null;

  if (!order) return null;

  return (
    <main className="app">
      <RuleBanner />
      <Metrics state={state} nowTs={nowTs} />

      <div className="workspace">
        <OrderList
          state={state}
          nowTs={nowTs}
          selectedId={order.id}
          onSelect={setSelectedOrderId}
        />
        <MountDiagram
          state={state}
          order={order}
          nowTs={nowTs}
          activeSlotKey={activeSlotKey}
          onPickSlot={pickSlot}
        />
      </div>

      <div className="workspace workspace-reverse">
        <BatchPanel
          state={state}
          selectedBatch={filter.batch}
          onSelect={(batch) => setFilter((f) => ({ ...f, batch }))}
        />
        <FilterBar sizes={sizes} filter={filter} onChange={setFilter} />
      </div>

      <GemTable state={state} filter={filter} order={order} nowTs={nowTs} />

      <BenchFooter onReset={actions.resetAll} />
    </main>
  );
}

export default App;
