/**
 * 界面层：珠宝镶嵌试镶借出台。
 * 分拣批次、尺寸筛选、镶口示意、订单清单共用规则层与状态层的同一份数据。
 */

import { useMemo, useState } from "react";
import { now, store, useStore } from "./store";
import {
  BATCHES,
  QC_FAIL_REASONS,
  REJECT_TEXT,
  SHAPE_FILTERS,
  SIZE_BANDS,
  STATUS_META,
  canBorrow,
  formatClock,
  formatCountdown,
  gemMatchesSeat,
  gemsLoanedByOrder,
  seatFillCounts,
  type BatchId,
  type Gem,
  type GemKind,
  type GemShape,
  type GemStatus,
  type Order,
  type SeatSpec,
} from "./rules";

/* --------------------------------- 小部件 --------------------------------- */

const KIND_COLOR: Record<GemKind, { fill: string; stroke: string }> = {
  钻石: { fill: "#e0f2fe", stroke: "#0284c7" },
  蓝宝石: { fill: "#1d4ed8", stroke: "#1e3a8a" },
  海蓝宝: { fill: "#38bdf8", stroke: "#0369a1" },
  祖母绿: { fill: "#059669", stroke: "#065f46" },
};

function MainStoneShape({ shape, r, filled, kind }: { shape: GemShape; r: number; filled: boolean; kind: GemKind }) {
  const empty = { fill: "#eef2f7", stroke: "#94a3b8", strokeDasharray: "4 3" };
  const full = { fill: KIND_COLOR[kind].fill, stroke: KIND_COLOR[kind].stroke };
  const p = filled ? full : empty;
  switch (shape) {
    case "圆形":
      return <circle r={r} {...p} strokeWidth={2} />;
    case "椭圆":
      return <ellipse rx={r * 0.78} ry={r} {...p} strokeWidth={2} />;
    case "祖母绿切":
      return (
        <g {...p} strokeWidth={2}>
          <rect x={-r * 0.72} y={-r} width={r * 1.44} height={r * 2} rx={3} />
          {filled && (
            <g stroke={KIND_COLOR[kind].stroke} opacity={0.55}>
              <line x1={-r * 0.45} y1={-r * 0.45} x2={r * 0.45} y2={-r * 0.45} />
              <line x1={-r * 0.45} y1={r * 0.45} x2={r * 0.45} y2={r * 0.45} />
            </g>
          )}
        </g>
      );
    case "梨形":
      return (
        <path
          d={`M 0 ${-r * 1.12} C ${r * 0.95} ${-r * 0.5} ${r} ${r * 0.55} 0 ${r}
              C ${-r} ${r * 0.55} ${-r * 0.95} ${-r * 0.5} 0 ${-r * 1.12} Z`}
          {...p}
          strokeWidth={2}
        />
      );
  }
}

/* ------------------------------- 镶口示意 SVG ------------------------------ */

function SettingDiagram({ order, fills }: { order: Order; fills: Record<string, number> }) {
  const pendant = order.piece.includes("吊坠");
  const main = order.seats.find((s) => s.type === "主石位");
  const halo = order.seats.find((s) => s.type === "围石组");
  const accents = order.seats.filter((s) => s.type === "配石位");

  const mainCy = pendant ? 104 : 92;
  const haloR = 40;
  const accentPoints = pendant
    ? [
        [72, 142],
        [188, 142],
        [60, 168],
        [200, 168],
      ]
    : [
        [70, 132],
        [190, 132],
        [46, 150],
        [214, 150],
      ];

  const haloDots =
    halo &&
    Array.from({ length: halo.count }, (_, i) => {
      const angle = (-90 + (360 / halo.count) * i) * (Math.PI / 180);
      return { x: 130 + haloR * Math.cos(angle), y: mainCy + haloR * Math.sin(angle), filled: i < fills[halo.key] };
    });

  return (
    <svg className="setting-svg" viewBox="0 0 260 210" role="img" aria-label={`${order.piece}镶口示意图`}>
      <title>{`${order.piece}镶口示意：数据来自该订单镶口清单`}</title>
      {pendant ? (
        <g stroke="#cbd5e1" fill="none" strokeLinecap="round">
          <path d="M36 14 Q130 -8 224 14" strokeWidth={3} />
          <circle cx={130} cy={30} r={8} strokeWidth={4} />
          <line x1={130} y1={38} x2={130} y2={mainCy - 34} strokeWidth={5} />
        </g>
      ) : (
        <g stroke="#cbd5e1" fill="none" strokeLinecap="round">
          <ellipse cx={130} cy={168} rx={86} ry={30} strokeWidth={12} />
          <line x1={86} y1={146} x2={108} y2={mainCy + 22} strokeWidth={9} />
          <line x1={174} y1={146} x2={152} y2={mainCy + 22} strokeWidth={9} />
        </g>
      )}

      {accents.map((seat, si) =>
        Array.from({ length: seat.count }, (_, i) => {
          const [x, y] = accentPoints[si * 2 + i] ?? accentPoints[si * 2 + (i % 2)];
          const filled = i < fills[seat.key];
          const color = filled ? KIND_COLOR[seat.kind] : null;
          return (
            <circle
              key={`${seat.key}-${i}`}
              cx={x}
              cy={y}
              r={8}
              fill={color ? color.fill : "#eef2f7"}
              stroke={color ? color.stroke : "#94a3b8"}
              strokeDasharray={color ? undefined : "3 3"}
              strokeWidth={2}
            />
          );
        }),
      )}

      {haloDots?.map((d, i) => (
        <circle
          key={i}
          cx={d.x}
          cy={d.y}
          r={6}
          fill={d.filled ? KIND_COLOR[halo!.kind].fill : "#eef2f7"}
          stroke={d.filled ? KIND_COLOR[halo!.kind].stroke : "#94a3b8"}
          strokeDasharray={d.filled ? undefined : "3 3"}
          strokeWidth={1.5}
        />
      ))}

      {main && (
        <g transform={`translate(130 ${mainCy})`}>
          <MainStoneShape shape={main.shape} r={28} kind={main.kind} filled={fills[main.key] > 0} />
        </g>
      )}
    </svg>
  );
}

/* -------------------------------- 订单清单 -------------------------------- */

function OrderCard({ order, active, state }: { order: Order; active: boolean; state: ReturnType<typeof useStore> }) {
  const fills = seatFillCounts(state, order.id);
  const need = order.seats.reduce((n, s) => n + s.count, 0);
  const have = Object.values(fills).reduce((a, b) => a + b, 0);
  const loans = gemsLoanedByOrder(state, order.id);

  return (
    <button className={`order-card${active ? " active" : ""}${order.frozen ? " frozen" : ""}`} onClick={() => store.selectOrder(order.id)}>
      <div className="order-card-head">
        <b>{order.id}</b>
        {order.frozen && <span className="tag tag-danger">已冻结</span>}
        {!order.frozen && loans.length > 0 && <span className="tag tag-loan">试镶中</span>}
      </div>
      <p className="order-piece">{order.piece}</p>
      <p className="order-customer">{order.customer}</p>
      <div className="mini-progress">
        <span style={{ width: `${Math.min(100, (have / need) * 100)}%` }} />
      </div>
      <small>
        已借 {have}/{need} 颗 · {loans.length} 颗未归还
      </small>
    </button>
  );
}

/* -------------------------------- 宝石卡片 -------------------------------- */

function GemCard({ gem, order, onReturn }: { gem: Gem; order: Order; onReturn: (gemId: string) => void }) {
  const meta = STATUS_META[gem.status];
  const matchesOrder = order.seats.some((s) => gem.kind === s.kind && gem.shape === s.shape && Math.abs(gem.mm - s.mm) <= 0.5);
  const borrowCheck = canBorrow({ gems: [gem], orders: [order], activeOrderId: order.id }, order.id, gem.id);
  const remaining = gem.loan ? gem.loan.deadlineAt - now() : 0;
  const holder = gem.loan ? getOrderById(gem.loan.orderId) : undefined;

  return (
    <article className={`gem-card status-${meta.cls}`}>
      <div className="gem-card-head">
        <b>{gem.id}</b>
        <span className={`tag tag-${meta.cls}`}>{meta.label}</span>
      </div>
      <h4>
        {gem.kind} · {gem.shape}
        <em>{gem.carat.toFixed(2)} ct</em>
      </h4>
      <p className="gem-spec">
        {gem.size} · {gem.color} · {gem.clarity} · {gem.cut}
      </p>
      <p className="gem-position">
        批次 {gem.batch} · 分拣位置：{gem.position}
      </p>
      {gem.defectNote && <p className="defect">⚠ {gem.defectNote}</p>}

      {gem.status === "借出" && gem.loan && (
        <div className="loan-line">
          <span className={remaining < 30 * 60 * 1000 ? "urgent" : ""}>
            {gem.loan.orderId === order.id ? "本单试镶中" : `${gem.loan.orderId} 占用`}
            {holder ? `（${holder.customer}）` : ""} · 剩余 {formatCountdown(remaining)}
          </span>
        </div>
      )}

      {gem.status === "待借" && !matchesOrder && <p className="hint">与当前订单镶口规格不符，仍可试镶</p>}

      <div className="gem-actions">
        {gem.status === "待借" && (
          <>
            <button
              className="primary sm"
              disabled={!borrowCheck.ok}
              title={borrowCheck.ok ? `借给 ${order.id}` : REJECT_TEXT[borrowCheck.reason]}
              onClick={() => store.borrow(order.id, gem.id)}
            >
              借出试镶
            </button>
            {!borrowCheck.ok && <small className="reject">{REJECT_TEXT[borrowCheck.reason]}</small>}
          </>
        )}
        {gem.status === "借出" && (
          <button className="sm" onClick={() => onReturn(gem.id)}>
            归还复检
          </button>
        )}
        {gem.status === "待定" && <small className="reject">待定，禁止借出</small>}
      </div>
    </article>
  );
}

/** 从最新 store 快照查持单客户（卡片内的轻量查询） */
function getOrderById(orderId: string): Order | undefined {
  return store.getState().orders.find((o) => o.id === orderId);
}

/* ------------------------------ 归还复检弹窗 ------------------------------- */

function ReturnModal({ gemId, onClose }: { gemId: string; onClose: () => void }) {
  const state = useStore();
  const gem = state.gems.find((g) => g.id === gemId);
  const [passed, setPassed] = useState(true);
  const [reason, setReason] = useState(QC_FAIL_REASONS[0]);
  const [note, setNote] = useState("");

  if (!gem) return null;
  const loaned = gem.status === "借出";

  const confirm = () => {
    const finalNote = passed ? note.trim() : `${reason}${note.trim() ? `：${note.trim()}` : ""}`;
    store.returnGem(gemId, passed, finalNote);
    onClose();
  };

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="heading">
          <div>
            <p>归还复检</p>
            <h2>{gem.id}</h2>
          </div>
          <button className="sm" onClick={onClose}>取消</button>
        </div>
        {!loaned && (
          <p className="defect">该宝石已不在借出状态（可能已超时自动释放），无需归还。</p>
        )}
        <div className="qc-choice">
          <label className={passed ? "pick" : ""}>
            <input type="radio" checked={passed} onChange={() => setPassed(true)} />
            复检合格 · 归还为待借
          </label>
          <label className={!passed ? "pick danger" : "danger"}>
            <input type="radio" checked={!passed} onChange={() => setPassed(false)} />
            复检不合格 · 转待定并冻结订单
          </label>
        </div>
        {!passed && (
          <div className="chips reason-chips">
            {QC_FAIL_REASONS.map((r) => (
              <button key={r} className={reason === r ? "chip-on" : ""} onClick={() => setReason(r)}>
                {r}
              </button>
            ))}
          </div>
        )}
        <label className="note-field">
          <span>复检备注（可选）</span>
          <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="补充复检现象或缺陷描述" />
        </label>
        <div className="modal-actions">
          <button className="primary" disabled={!loaned} onClick={confirm}>
            确认归还
          </button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------- 主界面 ---------------------------------- */

type ShapeFilter = "全部" | GemShape;
type StatusFilter = "全部" | GemStatus;
type BatchFilter = "全部" | BatchId;

export default function Bench() {
  const state = useStore();
  const [shape, setShape] = useState<ShapeFilter>("全部");
  const [sizeBand, setSizeBand] = useState(SIZE_BANDS[0].id);
  const [batch, setBatch] = useState<BatchFilter>("全部");
  const [status, setStatus] = useState<StatusFilter>("全部");
  const [keyword, setKeyword] = useState("");
  const [returnGemId, setReturnGemId] = useState<string | null>(null);

  const order = state.orders.find((o) => o.id === state.activeOrderId) ?? state.orders[0];
  const fills = useMemo(() => seatFillCounts(state, order.id), [state, order.id]);
  const offset = store.getClockOffset();

  const metrics = useMemo(() => {
    const count = (s: GemStatus) => state.gems.filter((g) => g.status === s).length;
    return [
      { label: "借出中", value: count("借出"), cls: "loan" },
      { label: "待借", value: count("待借"), cls: "ok" },
      { label: "待定", value: count("待定"), cls: "hold" },
      { label: "冻结订单", value: state.orders.filter((o) => o.frozen).length, cls: "danger" },
    ];
  }, [state]);

  const band = SIZE_BANDS.find((b) => b.id === sizeBand) ?? SIZE_BANDS[0];
  const filtered = useMemo(
    () =>
      state.gems.filter((g) => {
        if (shape !== "全部" && g.shape !== shape) return false;
        if (status !== "全部" && g.status !== status) return false;
        if (batch !== "全部" && g.batch !== batch) return false;
        if (g.mm < band.min || g.mm >= band.max) return false;
        const kw = keyword.trim();
        if (kw && !`${g.id}${g.kind}${g.shape}${g.position}`.includes(kw)) return false;
        return true;
      }),
    [state.gems, shape, status, batch, band, keyword],
  );

  const resetData = () => {
    if (window.confirm("确定清空浏览器中的借出记录，恢复预置三张订单与十二颗宝石？")) store.resetAll();
  };

  return (
    <main className="app bench">
      <header className="topbar panel">
        <div>
          <p className="kicker">珠宝镶嵌工作室 · 试镶借出台</p>
          <h1>宝石试镶借出管理</h1>
          <span className="clock">
            业务时间 {formatClock(now())}
            {offset !== 0 && <em className="clock-offset">（演示快进 +{Math.round(offset / 3600000)} 小时）</em>}
          </span>
        </div>
        <div className="clock-tools">
          <button className="sm" onClick={() => store.advanceClock(3600000)}>快进 1 小时</button>
          <button className="sm" onClick={() => store.advanceClock(4 * 3600000)}>快进 4 小时</button>
          <button className="sm" onClick={() => store.resetClock()}>恢复实时</button>
          <button className="sm danger-btn" onClick={resetData}>重置数据</button>
        </div>
      </header>

      <section className="metrics">
        {metrics.map((m) => (
          <article key={m.label} className={`metric metric-${m.cls}`}>
            <small>{m.label}</small>
            <strong>{m.value}</strong>
          </article>
        ))}
      </section>

      <div className="bench-grid">
        {/* 左：订单清单（共用订单数据） */}
        <aside className="panel">
          <h2>订单清单</h2>
          <div className="order-list">
            {state.orders.map((o) => (
              <OrderCard key={o.id} order={o} active={o.id === order.id} state={state} />
            ))}
          </div>
          <p className="rule-note">
            规则：按当前选中订单借出；借出期间其他订单不得占用同一颗；超 4 小时未还自动释放；复检不合格冻结该订单后续借出。
          </p>
        </aside>

        {/* 中：分拣批次 + 尺寸筛选 + 库存 */}
        <section className="panel inventory">
          <div className="heading">
            <div>
              <p>分拣批次 / 库存宝石</p>
              <h2>
                为 {order.id}（{order.piece}）挑石
              </h2>
            </div>
          </div>

          {order.frozen && (
            <div className="freeze-banner">
              ⛔ 该订单已冻结：{order.freezeReason}
              <button className="sm" onClick={() => store.unfreeze(order.id)}>主管复核后解冻</button>
            </div>
          )}

          <div className="filters">
            <input
              className="search"
              placeholder="搜编号 / 种类 / 形状 / 镶位"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
            <select value={batch} onChange={(e) => setBatch(e.target.value as BatchFilter)}>
              <option value="全部">全部分批</option>
              {BATCHES.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            <select value={sizeBand} onChange={(e) => setSizeBand(e.target.value)}>
              {SIZE_BANDS.map((b) => (
                <option key={b.id} value={b.id}>{b.label}</option>
              ))}
            </select>
            <select value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}>
              <option value="全部">全部状态</option>
              <option value="待借">待借</option>
              <option value="借出">借出中</option>
              <option value="待定">待定</option>
            </select>
          </div>
          <div className="chips shape-chips">
            {SHAPE_FILTERS.map((s) => (
              <button key={s} className={shape === s ? "chip-on" : ""} onClick={() => setShape(s)}>
                {s}
              </button>
            ))}
          </div>

          {BATCHES.map((b) => {
            const gems = filtered.filter((g) => g.batch === b.id);
            if (gems.length === 0) return null;
            const loaned = gems.filter((g) => g.status === "借出").length;
            const held = gems.filter((g) => g.status === "待定").length;
            return (
              <section key={b.id} className="batch-block">
                <div className="batch-head">
                  <h3>{b.name}</h3>
                  <small>
                    {gems.length} 颗 · 借出 {loaned} · 待定 {held}
                  </small>
                </div>
                <div className="gem-grid">
                  {gems.map((g) => (
                    <GemCard key={g.id} gem={g} order={order} onReturn={(id) => setReturnGemId(id)} />
                  ))}
                </div>
              </section>
            );
          })}
          {filtered.length === 0 && <p className="empty">没有符合筛选条件的宝石。</p>}
        </section>

        {/* 右：镶口示意 + 镶口清单 + 订单流水 */}
        <aside className="panel detail">
          <div className="heading">
            <div>
              <p>镶口示意（数据共用）</p>
              <h2>{order.piece}</h2>
            </div>
          </div>
          <SettingDiagram order={order} fills={fills} />
          <div className="legend">
            <span><i className="dot dot-filled" /> 已借到石</span>
            <span><i className="dot dot-empty" /> 空缺镶口</span>
          </div>

          <div className="seat-list">
            {order.seats.map((s) => (
              <SeatRow key={s.key} seat={s} state={state} filled={fills[s.key]} />
            ))}
          </div>

          <h3 className="log-title">订单流水</h3>
          <ul className="log">
            {order.events.length === 0 && <li className="empty">暂无借出 / 归还记录。</li>}
            {order.events.slice(0, 12).map((e) => (
              <li key={e.id} className={`log-item log-${e.kind}`}>
                <i />
                <div>
                  <p>{e.text}</p>
                  <small>{formatClock(e.at)}</small>
                </div>
              </li>
            ))}
          </ul>
        </aside>
      </div>

      {returnGemId && <ReturnModal gemId={returnGemId} onClose={() => setReturnGemId(null)} />}
    </main>
  );
}

function SeatRow({ seat, state, filled }: { seat: SeatSpec; state: ReturnType<typeof useStore>; filled: number }) {
  const available = state.gems.filter((g) => gemMatchesSeat(g, seat)).length;
  const complete = filled >= seat.count;
  return (
    <div className={`seat-row${complete ? " complete" : ""}`}>
      <div className="seat-row-head">
        <b>
          {seat.label} <em>{seat.type}</em>
        </b>
        <span className={complete ? "seat-count ok-text" : "seat-count"}>
          {filled}/{seat.count}
        </span>
      </div>
      <p>
        {seat.kind} · {seat.shape} · {seat.size} · 共需 {seat.count} 颗 · 库中可借 {available} 颗
      </p>
      <div className="mini-progress">
        <span style={{ width: `${Math.min(100, (filled / seat.count) * 100)}%` }} />
      </div>
    </div>
  );
}
