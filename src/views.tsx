// 界面层：所有展示组件集中于此。
// 共用同一份 store 数据：分拣批次、尺寸筛选、镶口示意、订单清单读到的宝石状态永远一致。

import { useMemo, useState } from "react";
import {
  BenchState,
  Gem,
  GemFilter,
  GemStatus,
  MountSlot,
  Order,
  SHAPE_FILTERS,
  canBorrow,
  currentLoan,
  filterGems,
  fitsSlot,
  formatClock,
  formatCountdown,
  gemAtSlot,
  gemsByBatch,
  gemsOnLoanTo,
  isOverdue,
  remainMs,
  computeMetrics,
  GEM_STATUS_TEXT,
  ORDER_STATUS_TEXT,
} from "./rules";
import { actions, now as benchNow } from "./store";

// ---------- 顶部规则条与指标 ----------

export function RuleBanner() {
  return (
    <header className="hero">
      <p>hxyfront-62006 · 珠宝镶嵌工作室 · 试镶借出台</p>
      <h1>宝石试镶借出管理</h1>
      <span>
        镶嵌师按订单借出宝石试镶，借出期间其他订单不得占用同一颗；借期 4 小时，超时未归还自动释放为「待借」；
        归还复检不合格转「待定」并冻结该订单后续借出。数据仅保存在本机浏览器，刷新保留。
      </span>
    </header>
  );
}

export function Metrics({ state, nowTs }: { state: BenchState; nowTs: number }) {
  const m = computeMetrics(state, nowTs);
  const cards = [
    { key: "待借", value: m.available, sub: `库存 ${m.total} 颗`, tone: "teal" },
    {
      key: "借出",
      value: m.onloan,
      sub: m.overdue > 0 ? `⚠ ${m.overdue} 颗已超期` : "试镶占用中",
      tone: m.overdue > 0 ? "rose" : "rose-soft",
    },
    { key: "待定", value: m.pending, sub: "复检 / 缺陷待确认", tone: "amber" },
    { key: "总克拉", value: m.totalCarat.toFixed(2), sub: `${m.batches} 个分拣批次`, tone: "violet" },
  ];
  return (
    <section className="metrics">
      {cards.map((c) => (
        <article key={c.key} className={`tone-${c.tone}`}>
          <small>{c.key}</small>
          <strong>{c.value}</strong>
          <em>{c.sub}</em>
        </article>
      ))}
    </section>
  );
}

// ---------- 订单清单 ----------

export function OrderList({
  state,
  nowTs,
  selectedId,
  onSelect,
}: {
  state: BenchState;
  nowTs: number;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="panel order-panel">
      <div className="heading">
        <div>
          <p>按订单查看</p>
          <h2>订单清单</h2>
        </div>
      </div>
      <div className="order-cards">
        {state.orders.map((order) => {
          const loaned = gemsOnLoanTo(state, order.id);
          const frozen = order.status === "frozen";
          return (
            <article
              key={order.id}
              className={`order-card ${selectedId === order.id ? "selected" : ""} ${
                frozen ? "frozen" : ""
              }`}
              onClick={() => onSelect(order.id)}
            >
              <div className="order-card-head">
                <b>{order.id}</b>
                <span className={`badge badge-${order.status}`}>{ORDER_STATUS_TEXT[order.status]}</span>
              </div>
              <h3>{order.name}</h3>
              <p className="muted">
                客户 {order.client} · 交付 {order.due}
              </p>
              <p className="muted">
                镶口 {order.slots.length} 个 · 本单借出 {loaned.length} 颗
              </p>
              {frozen && order.frozenReason && (
                <p className="freeze-reason">⛔ {order.frozenReason}</p>
              )}
              {loaned.length > 0 && (
                <ul className="mini-loans">
                  {loaned.map((g) => (
                    <li key={g.id}>
                      <span>
                        {g.id}
                        {isOverdue(g, nowTs) && <i className="dot-overdue">超</i>}
                      </span>
                      <LoanActions gem={g} nowTs={nowTs} compact />
                    </li>
                  ))}
                </ul>
              )}
              {frozen && (
                <button
                  className="link-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    actions.unfreeze(order.id);
                  }}
                >
                  处理完毕，解冻订单
                </button>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

// ---------- 借还操作（复检弹窗内聚在组件内） ----------

function LoanActions({ gem, nowTs, compact }: { gem: Gem; nowTs: number; compact?: boolean }) {
  const [failing, setFailing] = useState(false);
  if (gem.status !== "onloan") return null;
  const overdue = isOverdue(gem, nowTs);
  return (
    <span className="loan-actions" onClick={(e) => e.stopPropagation()}>
      {!compact && (
        <span className={`countdown ${overdue ? "overdue" : ""}`}>
          {overdue ? "已超期 · 待释放" : formatCountdown(remainMs(gem, nowTs))}
        </span>
      )}
      {compact && overdue && <span className="countdown overdue">已超期</span>}
      <button className="btn-pass" onClick={() => actions.returnPassed(gem.id)}>
        复检合格
      </button>
      <button className="btn-fail" onClick={() => setFailing(true)}>
        不合格
      </button>
      {failing && <ReturnFailModal gem={gem} onClose={() => setFailing(false)} />}
    </span>
  );
}

function ReturnFailModal({ gem, onClose }: { gem: Gem; onClose: () => void }) {
  const loan = currentLoan(gem);
  const [defect, setDefect] = useState("复检发现镶口磨损 / 石尖崩缺，待鉴定处理");
  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>归还复检不合格 · {gem.id}</h3>
        <p className="muted">
          宝石将转为「待定」，订单 <b>{loan?.orderId}</b> 会被冻结，后续不可再借宝石。
        </p>
        <textarea
          value={defect}
          onChange={(e) => setDefect(e.target.value)}
          rows={3}
          placeholder="填写不合格原因 / 缺陷备注"
        />
        <div className="modal-actions">
          <button onClick={onClose}>取消</button>
          <button
            className="primary"
            onClick={() => {
              actions.returnFailed(gem.id, defect);
              onClose();
            }}
          >
            确认转待定并冻结订单
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- 镶口示意 ----------

const MOUNT_TITLE: Record<Order["mount"], string> = {
  ring: "戒指镶口示意",
  pendant: "吊坠镶口示意",
  stud: "耳钉镶口示意",
};

export function MountDiagram({
  state,
  order,
  nowTs,
  activeSlotKey,
  onPickSlot,
}: {
  state: BenchState;
  order: Order;
  nowTs: number;
  activeSlotKey: string | null;
  onPickSlot: (slot: MountSlot | null) => void;
}) {
  return (
    <section className="panel">
      <div className="heading">
        <div>
          <p>{order.id} · {order.name}</p>
          <h2>{MOUNT_TITLE[order.mount]}</h2>
        </div>
        {order.status === "frozen" && <span className="badge badge-frozen">订单冻结中</span>}
      </div>
      <svg className="mount-svg" viewBox="0 0 320 260" role="img" aria-label={MOUNT_TITLE[order.mount]}>
        <MountDecoration mount={order.mount} />
        {order.slots.map((slot) => {
          const gem = gemAtSlot(state, order, slot);
          const key = `${slot.shape}-${slot.sizeMm}`;
          const candidates = state.gems.filter((g) => fitsSlot(g, slot)).length;
          const overdue = gem ? isOverdue(gem, nowTs) : false;
          return (
            <g
              key={slot.position}
              className={`slot ${activeSlotKey === key ? "slot-active" : ""}`}
              onClick={() => onPickSlot(activeSlotKey === key ? null : slot)}
            >
              {gem ? (
                <GemIcon gem={gem} x={slot.x} y={slot.y} r={8 + slot.sizeMm * 1.5} />
              ) : (
                <EmptySlot x={slot.x} y={slot.y} r={8 + slot.sizeMm * 1.5} shape={slot.shape} />
              )}
              <text x={slot.x} y={slot.y + 24 + slot.sizeMm * 1.5} textAnchor="middle" className="slot-label">
                {slot.position}
              </text>
              <text x={slot.x} y={slot.y + 37 + slot.sizeMm * 1.5} textAnchor="middle" className="slot-sub">
                {slot.label} · {slot.shape}{slot.sizeMm}mm · 适配 {candidates} 颗
              </text>
              {gem && (
                <text x={slot.x + 12 + slot.sizeMm * 1.5} y={slot.y - 8 - slot.sizeMm * 1.5} className="slot-id">
                  {gem.id}
                  {overdue ? " ⚠" : ""}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <p className="hint">点击镶口可按「形状 + 尺寸」筛选库存宝石，再点一次取消。</p>
    </section>
  );
}

function MountDecoration({ mount }: { mount: Order["mount"] }) {
  if (mount === "ring") {
    return (
      <g className="mount-deco">
        <ellipse cx="160" cy="130" rx="98" ry="98" fill="none" strokeWidth="7" />
        <ellipse cx="160" cy="130" rx="98" ry="98" fill="none" strokeWidth="2" className="deco-inner" />
      </g>
    );
  }
  if (mount === "pendant") {
    return (
      <g className="mount-deco">
        <circle cx="160" cy="26" r="9" fill="none" strokeWidth="3" />
        <line x1="160" y1="35" x2="160" y2="52" strokeWidth="3" />
        <path d="M104 66 Q160 38 216 66 L202 196 Q160 226 118 196 Z" fill="none" strokeWidth="3" />
      </g>
    );
  }
  return (
    <g className="mount-deco">
      <ellipse cx="92" cy="120" rx="34" ry="34" fill="none" strokeWidth="3" />
      <ellipse cx="228" cy="120" rx="34" ry="34" fill="none" strokeWidth="3" />
      <line x1="126" y1="120" x2="194" y2="120" strokeWidth="2" strokeDasharray="4 5" />
    </g>
  );
}

function EmptySlot({ x, y, r, shape }: { x: number; y: number; r: number; shape: string }) {
  return (
    <g className="empty-slot">
      {shape === "椭圆" ? (
        <ellipse cx={x} cy={y} rx={r * 1.25} ry={r * 0.92} />
      ) : shape === "梨形" ? (
        <path d={teardropPath(x, y, r)} />
      ) : shape === "祖母绿切" ? (
        <polygon points={octagonPoints(x, y, r * 1.15, r * 0.95)} />
      ) : (
        <circle cx={x} cy={y} r={r} />
      )}
      <text x={x} y={y + 4} textAnchor="middle" className="empty-mark">
        空
      </text>
    </g>
  );
}

function GemIcon({ gem, x, y, r }: { gem: Gem; x: number; y: number; r: number }) {
  const c = gemPalette(gem.kind);
  const onloan = gem.status === "onloan";
  const pending = gem.status === "pending";
  return (
    <g className={`gem-icon ${onloan ? "onloan" : ""} ${pending ? "pending" : ""}`}>
      {onloan && <circle cx={x} cy={y} r={r + 4} className="gem-halo" />}
      {gem.shape === "椭圆" ? (
        <ellipse cx={x} cy={y} rx={r * 1.25} ry={r * 0.92} fill={c.fill} stroke={c.stroke} strokeWidth="1.5" />
      ) : gem.shape === "梨形" ? (
        <path d={teardropPath(x, y, r)} fill={c.fill} stroke={c.stroke} strokeWidth="1.5" />
      ) : gem.shape === "祖母绿切" ? (
        <polygon points={octagonPoints(x, y, r * 1.15, r * 0.95)} fill={c.fill} stroke={c.stroke} strokeWidth="1.5" />
      ) : (
        <circle cx={x} cy={y} r={r} fill={c.fill} stroke={c.stroke} strokeWidth="1.5" />
      )}
      <path
        d={`M ${x - r * 0.45} ${y - r * 0.15} L ${x} ${y - r * 0.55} L ${x + r * 0.45} ${y - r * 0.15}`}
        fill="none"
        stroke={c.facet}
        strokeWidth="1.2"
        opacity="0.85"
      />
      <line x1={x} y1={y - r * 0.55} x2={x} y2={y + r * 0.5} stroke={c.facet} strokeWidth="0.8" opacity="0.6" />
      {pending && (
        <text x={x} y={y + r + 12} textAnchor="middle" className="pending-tag">
          待定
        </text>
      )}
    </g>
  );
}

function teardropPath(x: number, y: number, r: number): string {
  return `M ${x} ${y - r * 1.3} C ${x + r} ${y - r * 0.5} ${x + r * 0.82} ${y + r * 0.6} ${x} ${y + r}
          C ${x - r * 0.82} ${y + r * 0.6} ${x - r} ${y - r * 0.5} ${x} ${y - r * 1.3} Z`;
}

function octagonPoints(x: number, y: number, rx: number, ry: number): string {
  const k = 0.32;
  return [
    [x - rx * (1 - k), y - ry],
    [x + rx * (1 - k), y - ry],
    [x + rx, y - ry * (1 - k)],
    [x + rx, y + ry * (1 - k)],
    [x + rx * (1 - k), y + ry],
    [x - rx * (1 - k), y + ry],
    [x - rx, y + ry * (1 - k)],
    [x - rx, y - ry * (1 - k)],
  ]
    .map(([px, py]) => `${px.toFixed(1)},${py.toFixed(1)}`)
    .join(" ");
}

function gemPalette(kind: string): { fill: string; stroke: string; facet: string } {
  if (kind.includes("蓝")) return { fill: "#2563eb", stroke: "#1e3a8a", facet: "#bfdbfe" };
  if (kind.includes("钻石")) return { fill: "#f1f5f9", stroke: "#94a3b8", facet: "#7dd3fc" };
  if (kind.includes("祖母绿")) return { fill: "#059669", stroke: "#065f46", facet: "#a7f3d0" };
  if (kind.includes("沙弗莱")) return { fill: "#16a34a", stroke: "#14532d", facet: "#bbf7d0" };
  if (kind.includes("石榴石")) return { fill: "#be123c", stroke: "#881337", facet: "#fecdd3" };
  return { fill: "#a855f7", stroke: "#6b21a8", facet: "#e9d5ff" };
}

// ---------- 分拣批次 ----------

export function BatchPanel({
  state,
  selectedBatch,
  onSelect,
}: {
  state: BenchState;
  selectedBatch: string | null;
  onSelect: (batch: string | null) => void;
}) {
  const groups = gemsByBatch(state);
  return (
    <section className="panel batch-panel">
      <div className="heading">
        <div>
          <p>分拣批次</p>
          <h2>库存分组</h2>
        </div>
        {selectedBatch && (
          <button className="link-btn" onClick={() => onSelect(null)}>
            清除批次选择
          </button>
        )}
      </div>
      <div className="batch-grid">
        {Object.entries(groups).map(([batch, gems]) => {
          const loaned = gems.filter((g) => g.status === "onloan").length;
          const pending = gems.filter((g) => g.status === "pending").length;
          return (
            <button
              key={batch}
              className={`batch-card ${selectedBatch === batch ? "selected" : ""}`}
              onClick={() => onSelect(selectedBatch === batch ? null : batch)}
            >
              <b>{batch}</b>
              <span>{gems.length} 颗</span>
              <span className="muted">
                借出 {loaned} · 待定 {pending}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ---------- 筛选条 ----------

const STATUS_FILTERS: Array<{ key: GemStatus | null; label: string }> = [
  { key: null, label: "全部状态" },
  { key: "available", label: "待借" },
  { key: "onloan", label: "借出" },
  { key: "pending", label: "待定" },
];

export function FilterBar({
  sizes,
  filter,
  onChange,
}: {
  sizes: number[];
  filter: GemFilter;
  onChange: (next: GemFilter) => void;
}) {
  const patch = (p: Partial<GemFilter>) => onChange({ ...filter, ...p });
  return (
    <section className="panel filter-panel">
      <div className="heading">
        <div>
          <p>尺寸筛选 / 库存检索</p>
          <h2>宝石库存</h2>
        </div>
        <button
          className="link-btn"
          onClick={() =>
            onChange({ shape: null, sizeMm: null, batch: filter.batch, status: null, keyword: "" })
          }
        >
          清除筛选
        </button>
      </div>

      <div className="filter-row">
        <span className="filter-label">形状</span>
        <div className="chips">
          {SHAPE_FILTERS.map((s) => (
            <button
              key={s}
              className={filter.shape === s ? "chip-on" : ""}
              onClick={() => patch({ shape: filter.shape === s ? null : s })}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="filter-row">
        <span className="filter-label">尺寸</span>
        <div className="chips">
          {sizes.map((size) => (
            <button
              key={size}
              className={filter.sizeMm === size ? "chip-on" : ""}
              onClick={() => patch({ sizeMm: filter.sizeMm === size ? null : size })}
            >
              {size} mm
            </button>
          ))}
        </div>
      </div>

      <div className="filter-row">
        <span className="filter-label">状态</span>
        <div className="chips">
          {STATUS_FILTERS.map(({ key, label }) => (
            <button
              key={label}
              className={filter.status === key ? "chip-on" : ""}
              onClick={() => patch({ status: key })}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="filter-row">
        <span className="filter-label">检索</span>
        <input
          className="search-input"
          placeholder="编号 / 种类 / 颜色 / 镶口 / 缺陷备注"
          value={filter.keyword}
          onChange={(e) => patch({ keyword: e.target.value })}
        />
      </div>
    </section>
  );
}

// ---------- 库存宝石表 ----------

export function GemTable({
  state,
  filter,
  order,
  nowTs,
}: {
  state: BenchState;
  filter: GemFilter;
  order: Order;
  nowTs: number;
}) {
  const rows = useMemo(() => filterGems(state.gems, filter), [state.gems, filter]);
  return (
    <section className="panel">
      <p className="muted table-summary">
        命中 {rows.length} 颗 · 借出新宝石将计入选中订单 <b>{order.id} {order.name}</b>
        {order.status === "frozen" && <span className="freeze-reason">（该订单已冻结，不可新借）</span>}
      </p>
      {rows.length === 0 && <div className="empty-block">没有符合筛选条件的宝石。</div>}
      <div className="gem-grid gem-grid-head">
        <span>宝石 / 参数</span>
        <span>分拣 · 镶口</span>
        <span>状态与借还</span>
        <span>操作</span>
      </div>
      <div className="gem-rows">
        {rows.map((gem) => (
          <GemRow key={gem.id} gem={gem} state={state} order={order} nowTs={nowTs} />
        ))}
      </div>
    </section>
  );
}

function GemRow({
  gem,
  state,
  order,
  nowTs,
}: {
  gem: Gem;
  state: BenchState;
  order: Order;
  nowTs: number;
}) {
  const loan = currentLoan(gem);
  const loanOrder = loan && state.orders.find((o) => o.id === loan.orderId);
  const guard = canBorrow(state, gem.id, order.id);
  const overdue = isOverdue(gem, nowTs);
  return (
    <article className={`gem-grid gem-row status-${gem.status}`}>
      <div className="gem-id-cell">
        <span className={`status-dot dot-${gem.status}`} />
        <div>
          <h3>
            {gem.id} · {gem.kind}
          </h3>
          <p className="muted">
            {gem.shape} {gem.sizeMm}mm · {gem.carat}ct · {gem.cut}
          </p>
          <p className="muted">
            净度 {gem.clarity} · 颜色 {gem.color}
          </p>
          {gem.defect && <p className="defect-note">备注：{gem.defect}</p>}
        </div>
      </div>

      <div className="gem-batch-cell">
        <b>{gem.batch}</b>
        <p className="muted">镶口 {gem.position}</p>
      </div>

      <div className="gem-status-cell">
        <span className={`badge badge-gem-${gem.status}`}>{GEM_STATUS_TEXT[gem.status]}</span>
        {loan && (
          <>
            <p className="muted">
              → {loanOrder?.name ?? loan.orderId} · {formatClock(loan.borrowedAt)} 借出
            </p>
            <p className={`countdown ${overdue ? "overdue" : ""}`}>
              {overdue
                ? "超过 4 小时，系统即将自动释放"
                : `剩余 ${formatCountdown(remainMs(gem, nowTs))}`}
            </p>
          </>
        )}
        {gem.status === "available" && gem.loans.length > 0 && (
          <p className="muted">历史试镶 {gem.loans.filter((l) => l.result).length} 次</p>
        )}
      </div>

      <div className="gem-action-cell">
        {gem.status === "available" && (
          <button
            className="primary"
            disabled={!guard.ok}
            title={guard.ok ? `借给 ${order.id} 试镶` : guard.reason}
            onClick={() => actions.borrowGem(gem.id, order.id)}
          >
            借给 {order.id}
          </button>
        )}
        {gem.status === "onloan" && <LoanActions gem={gem} nowTs={nowTs} />}
        {gem.status === "pending" && <span className="muted">待定处理中，不可借出</span>}
      </div>
    </article>
  );
}

// ---------- 底部演练与说明 ----------

export function BenchFooter({ onReset }: { onReset: () => void }) {
  return (
    <footer className="bench-footer">
      <p className="muted">
        规则：借出独占同一颗宝石 · 借期 {">"} 4 小时自动释放为待借 · 复检不合格转待定并冻结订单后续借出 ·
        数据只存浏览器 localStorage，刷新保留，不接后端。
      </p>
      <div className="footer-actions">
        <button onClick={actions.fastForwardFourHours}>⏩ 演练：快进 4 小时（触发自动释放）</button>
        <button onClick={onReset}>↺ 恢复预置数据</button>
      </div>
      <p className="muted tiny">当前业务时钟：{formatClock(benchNow())}</p>
    </footer>
  );
}
