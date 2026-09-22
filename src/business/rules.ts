/**
 * 规则层：领域类型、预置数据、纯业务规则。
 * 不依赖 React、不读写浏览器存储，所有时间均通过 now 参数注入，方便测试与时间模拟。
 */

/* ---------------------------------- 类型 ---------------------------------- */

export type GemShape = "圆形" | "椭圆" | "梨形" | "祖母绿切";
export type GemKind = "钻石" | "蓝宝石" | "海蓝宝" | "祖母绿";
export type GemStatus = "待借" | "借出" | "待定";

/** 分拣批次 */
export type BatchId = "B2501" | "B2502" | "B2503";

/** 镶口类型：主石位 / 围石组（数量）/ 配石位（数量） */
export type SeatType = "主石位" | "围石组" | "配石位";

export interface Gem {
  id: string; // 宝石编号
  kind: GemKind;
  shape: GemShape;
  carat: number; // 克拉重量
  size: string; // 尺寸描述，如 6.0×4.0
  mm: number; // 代表尺寸（mm），用于尺寸筛选
  clarity: string; // 净度
  color: string; // 颜色
  cut: string; // 切工
  position: string; // 镶嵌位置（分拣标注）
  batch: BatchId; // 分拣批次
  status: GemStatus; // 分拣状态 / 借出状态
  defectNote: string; // 缺陷备注（分拣或复检）
  /** 借出信息：借出期间其他订单不得占用同一颗 */
  loan?: {
    orderId: string;
    borrowedAt: number; // 借出时间戳（ms）
    deadlineAt: number; // 应还时间 = 借出 + 4h
    releasedAt?: number; // 超时自动释放时间
    autoReleased?: boolean;
  };
}

export interface SeatSpec {
  key: string;
  type: SeatType;
  label: string;
  shape: GemShape;
  kind: GemKind;
  count: number; // 该镶口需要的宝石数量
  mm: number; // 代表尺寸（mm）
  size: string;
}

export interface OrderEvent {
  id: string;
  at: number;
  text: string;
  kind: "borrow" | "return-ok" | "return-bad" | "release" | "freeze" | "unfreeze";
}

export interface Order {
  id: string;
  customer: string;
  piece: string; // 镶嵌件类型，用于镶口示意
  seats: SeatSpec[];
  frozen: boolean; // 复检不合格后冻结，停止后续借出
  freezeReason?: string;
  events: OrderEvent[];
}

export interface State {
  gems: Gem[];
  orders: Order[];
  activeOrderId: string; // 当前操作的订单
}

/* ---------------------------------- 常量 ---------------------------------- */

export const LOAN_LIMIT_MS = 4 * 60 * 60 * 1000; // 借出期限：4 小时
export const STORAGE_KEY = "trial-setting-bench:v1";
export const TICK_MS = 1000; // 界面计时刷新
export const SWEEP_MS = 30 * 1000; // 自动释放巡检

export const BATCHES: { id: BatchId; name: string }[] = [
  { id: "B2501", name: "B2501 主石批" },
  { id: "B2502", name: "B2502 圆钻配石批" },
  { id: "B2503", name: "B2503 配石补批" },
];

export const SHAPE_FILTERS: ("全部" | GemShape)[] = [
  "全部",
  "圆形",
  "椭圆",
  "梨形",
  "祖母绿切",
];

/** 尺寸筛选区间（mm，以代表尺寸归带） */
export const SIZE_BANDS: { id: string; label: string; min: number; max: number }[] = [
  { id: "all", label: "全部尺寸", min: 0, max: Infinity },
  { id: "s", label: "≤ 2mm 配石", min: 0, max: 2.0 },
  { id: "m", label: "2–4mm 围石", min: 2.0, max: 4.0 },
  { id: "l", label: "≥ 4mm 主石", min: 4.0, max: Infinity },
];

export const QC_FAIL_REASONS = ["镶口受力崩边", "腰棱缺口", "颜色与订单不符", "复检发现内含物加重"];

/* -------------------------------- 预置数据 -------------------------------- */

export function createSeedState(): State {
  const orders: Order[] = [
    {
      id: "ORD-1101",
      customer: "林女士",
      piece: "椭圆主石钻戒",
      frozen: false,
      seats: [
        {
          key: "main",
          type: "主石位",
          label: "主石位",
          shape: "椭圆",
          kind: "蓝宝石",
          count: 1,
          mm: 6,
          size: "6.0×4.0",
        },
        {
          key: "halo-a",
          type: "围石组",
          label: "围石 A 组",
          shape: "圆形",
          kind: "钻石",
          count: 6,
          mm: 1.5,
          size: "Φ1.5",
        },
      ],
      events: [],
    },
    {
      id: "ORD-1102",
      customer: "周先生",
      piece: "梨形海蓝宝吊坠",
      frozen: false,
      seats: [
        {
          key: "main",
          type: "主石位",
          label: "主石位",
          shape: "梨形",
          kind: "海蓝宝",
          count: 1,
          mm: 8,
          size: "8.0×5.0",
        },
        {
          key: "halo-b",
          type: "围石组",
          label: "围石 B 组",
          shape: "圆形",
          kind: "钻石",
          count: 4,
          mm: 2,
          size: "Φ2.0",
        },
      ],
      events: [],
    },
    {
      id: "ORD-1103",
      customer: "陈先生",
      piece: "祖母绿切男戒",
      frozen: false,
      seats: [
        {
          key: "main",
          type: "主石位",
          label: "主石位",
          shape: "祖母绿切",
          kind: "祖母绿",
          count: 1,
          mm: 7,
          size: "7.0×5.0",
        },
        {
          key: "acc-c",
          type: "配石位",
          label: "两侧配石",
          shape: "圆形",
          kind: "钻石",
          count: 2,
          mm: 2.5,
          size: "Φ2.5",
        },
      ],
      events: [],
    },
  ];

  const gems: Gem[] = [
    // B2501 主石批
    { id: "ST-2048", kind: "蓝宝石", shape: "椭圆", carat: 1.02, size: "6.0×4.0", mm: 6.0, clarity: "VVS", color: "皇家蓝", cut: "椭圆明亮切工", position: "主石位", batch: "B2501", status: "待借", defectNote: "" },
    { id: "ST-2052", kind: "蓝宝石", shape: "椭圆", carat: 0.96, size: "5.8×3.9", mm: 5.8, clarity: "VS", color: "矢车菊", cut: "椭圆明亮切工", position: "主石位", batch: "B2501", status: "待借", defectNote: "亭部轻微色带" },
    { id: "ST-2063", kind: "海蓝宝", shape: "梨形", carat: 1.35, size: "8.0×5.0", mm: 8.0, clarity: "VVS", color: "圣玛利亚", cut: "梨形混切", position: "主石位", batch: "B2501", status: "待借", defectNote: "" },
    { id: "ST-2071", kind: "祖母绿", shape: "祖母绿切", carat: 1.88, size: "7.0×5.0", mm: 7.0, clarity: "VS", color: "Muzo 绿", cut: "阶梯切工", position: "主石位", batch: "B2501", status: "待借", defectNote: "内含物明显，需客户确认" },
    // B2502 圆钻配石批（Φ1.5，围石 A 组）
    { id: "ST-3101", kind: "钻石", shape: "圆形", carat: 0.015, size: "Φ1.5", mm: 1.5, clarity: "VVS", color: "D", cut: "明亮切工", position: "围石A组", batch: "B2502", status: "待借", defectNote: "" },
    { id: "ST-3102", kind: "钻石", shape: "圆形", carat: 0.016, size: "Φ1.5", mm: 1.5, clarity: "VVS", color: "E", cut: "明亮切工", position: "围石A组", batch: "B2502", status: "待借", defectNote: "" },
    { id: "ST-3103", kind: "钻石", shape: "圆形", carat: 0.014, size: "Φ1.5", mm: 1.5, clarity: "VS", color: "E", cut: "明亮切工", position: "围石A组", batch: "B2502", status: "待借", defectNote: "" },
    { id: "ST-3104", kind: "钻石", shape: "圆形", carat: 0.015, size: "Φ1.5", mm: 1.5, clarity: "VVS", color: "F", cut: "明亮切工", position: "围石A组", batch: "B2502", status: "待借", defectNote: "" },
    { id: "ST-3105", kind: "钻石", shape: "圆形", carat: 0.017, size: "Φ1.5", mm: 1.5, clarity: "VVS", color: "D", cut: "明亮切工", position: "围石A组", batch: "B2502", status: "待借", defectNote: "" },
    { id: "ST-3106", kind: "钻石", shape: "圆形", carat: 0.015, size: "Φ1.5", mm: 1.5, clarity: "VS", color: "F", cut: "明亮切工", position: "围石A组", batch: "B2502", status: "待借", defectNote: "台面略偏" },
    // B2503 配石补批（Φ2.0 / Φ2.5，围石 B 组与配石位）
    { id: "ST-4201", kind: "钻石", shape: "圆形", carat: 0.03, size: "Φ2.0", mm: 2.0, clarity: "VVS", color: "E", cut: "明亮切工", position: "围石B组", batch: "B2503", status: "待借", defectNote: "" },
    { id: "ST-4208", kind: "钻石", shape: "圆形", carat: 0.05, size: "Φ2.5", mm: 2.5, clarity: "VS", color: "G", cut: "明亮切工", position: "配石位", batch: "B2503", status: "待借", defectNote: "" },
  ];

  return { gems, orders, activeOrderId: orders[0].id };
}

/* -------------------------------- 纯规则函数 ------------------------------- */

let seq = 0;
export function makeEventId(): string {
  seq += 1;
  return `ev-${Date.now().toString(36)}-${seq}`;
}

/** 判断一颗宝石是否符合某个镶口要求（同种类、同形状，尺寸公差 ±0.5mm） */
export function gemMatchesSeat(gem: Gem, seat: SeatSpec): boolean {
  return (
    gem.status === "待借" &&
    gem.kind === seat.kind &&
    gem.shape === seat.shape &&
    Math.abs(gem.mm - seat.mm) <= 0.5
  );
}

/** 某订单当前占用（借出未释放）的宝石 */
export function gemsLoanedByOrder(state: State, orderId: string): Gem[] {
  return state.gems.filter((g) => g.status === "借出" && g.loan?.orderId === orderId);
}

/** 订单各镶口已借数量（镶口、尺寸筛选、订单清单共用） */
export function seatFillCounts(state: State, orderId: string): Record<string, number> {
  const order = state.orders.find((o) => o.id === orderId);
  const counts: Record<string, number> = {};
  if (!order) return counts;
  for (const seat of order.seats) counts[seat.key] = 0;
  for (const gem of gemsLoanedByOrder(state, order.id)) {
    const seat = order.seats.find(
      (s) => s.kind === gem.kind && s.shape === gem.shape && Math.abs(s.mm - gem.mm) <= 0.5,
    );
    if (seat) counts[seat.key] += 1;
  }
  return counts;
}

export type RejectReason =
  | "ORDER_FROZEN"
  | "GEM_NOT_AVAILABLE"
  | "GEM_PENDING"
  | "GEM_HELD_BY_OTHER"
  | "ALREADY_HELD_BY_ORDER";

export function canBorrow(
  state: State,
  orderId: string,
  gemId: string,
): { ok: true } | { ok: false; reason: RejectReason } {
  const order = state.orders.find((o) => o.id === orderId);
  const gem = state.gems.find((g) => g.id === gemId);
  if (!order || !gem) return { ok: false, reason: "GEM_NOT_AVAILABLE" };
  if (order.frozen) return { ok: false, reason: "ORDER_FROZEN" };
  if (gem.status === "待定") return { ok: false, reason: "GEM_PENDING" };
  if (gem.status === "借出") {
    if (gem.loan?.orderId === orderId) return { ok: false, reason: "ALREADY_HELD_BY_ORDER" };
    return { ok: false, reason: "GEM_HELD_BY_OTHER" };
  }
  return { ok: true };
}

export const REJECT_TEXT: Record<RejectReason, string> = {
  ORDER_FROZEN: "订单已冻结，暂停借出",
  GEM_NOT_AVAILABLE: "宝石不可借",
  GEM_PENDING: "宝石处于待定，禁止借出",
  GEM_HELD_BY_OTHER: "其他订单正在试镶，占用中",
  ALREADY_HELD_BY_ORDER: "该订单已借出此宝石",
};

/** 借出：写入占用订单与 4 小时期限。返回新状态（不可变更新）。 */
export function borrowGem(state: State, orderId: string, gemId: string, now: number): State {
  const check = canBorrow(state, orderId, gemId);
  if (!check.ok) return state;
  return {
    ...state,
    gems: state.gems.map((g) =>
      g.id === gemId
        ? {
            ...g,
            status: "借出",
            loan: { orderId, borrowedAt: now, deadlineAt: now + LOAN_LIMIT_MS },
          }
        : g,
    ),
    orders: state.orders.map((o) =>
      o.id === orderId
        ? {
            ...o,
            events: [
              { id: makeEventId(), at: now, kind: "borrow", text: `借出 ${gemId} 试镶` },
              ...o.events,
            ],
          }
        : o,
    ),
  };
}

/**
 * 归还复检。
 * - 合格：回到待借，清除占用。
 * - 不合格：宝石转待定（保留复检备注），订单冻结、停止后续借出。
 */
export function returnGem(
  state: State,
  gemId: string,
  passed: boolean,
  now: number,
  note: string,
): State {
  const gem = state.gems.find((g) => g.id === gemId);
  if (!gem || gem.status !== "借出" || !gem.loan) return state;
  const orderId = gem.loan.orderId;

  if (passed) {
    return {
      ...state,
      gems: state.gems.map((g) =>
        g.id === gemId
          ? {
              ...g,
              status: "待借",
              defectNote: note.trim() || g.defectNote,
              loan: undefined,
            }
          : g,
      ),
      orders: state.orders.map((o) =>
        o.id === orderId
          ? {
              ...o,
              events: [
                { id: makeEventId(), at: now, kind: "return-ok", text: `${gemId} 复检合格，已归还` },
                ...o.events,
              ],
            }
          : o,
      ),
    };
  }

  const reasonText = note.trim() || "复检不合格";
  return {
    ...state,
    gems: state.gems.map((g) =>
      g.id === gemId
        ? {
            ...g,
            status: "待定",
            defectNote: `复检不合格：${reasonText}`,
            loan: { ...g.loan!, releasedAt: now },
          }
        : g,
    ),
    orders: state.orders.map((o) =>
      o.id === orderId
        ? {
            ...o,
            frozen: true,
            freezeReason: `${gemId} 复检不合格：${reasonText}`,
            events: [
              { id: makeEventId(), at: now, kind: "freeze", text: `复检不合格，订单冻结（${gemId}：${reasonText}）` },
              { id: makeEventId(), at: now, kind: "return-bad", text: `${gemId} 复检不合格，转待定` },
              ...o.events,
            ],
          }
        : o,
    ),
  };
}

/**
 * 超时巡检：借出超过 4 小时未归还，自动释放为待借。
 * 释放后任何订单都可以再次借出。
 */
export function sweepOverdue(state: State, now: number): { state: State; released: string[] } {
  const released: string[] = [];
  const eventsByOrder = new Map<string, OrderEvent[]>();

  const gems = state.gems.map((g) => {
    if (g.status === "借出" && g.loan && now >= g.loan.deadlineAt) {
      released.push(g.id);
      const list = eventsByOrder.get(g.loan.orderId) ?? [];
      list.push({
        id: makeEventId(),
        at: now,
        kind: "release",
        text: `${g.id} 超 4 小时未还，自动释放为待借`,
      });
      eventsByOrder.set(g.loan.orderId, list);
      return { ...g, status: "待借" as const, loan: undefined };
    }
    return g;
  });

  if (released.length === 0) return { state, released };

  const orders = state.orders.map((o) => {
    const extra = eventsByOrder.get(o.id);
    return extra ? { ...o, events: [...extra, ...o.events] } : o;
  });
  return { state: { ...state, gems, orders }, released };
}

/** 解除订单冻结（主管处理待定宝石后恢复借出资格；宝石本身仍保持待定） */
export function unfreezeOrder(state: State, orderId: string, now: number): State {
  const order = state.orders.find((o) => o.id === orderId);
  if (!order || !order.frozen) return state;
  return {
    ...state,
    orders: state.orders.map((o) =>
      o.id === orderId
        ? {
            ...o,
            frozen: false,
            freezeReason: undefined,
            events: [
              { id: makeEventId(), at: now, kind: "unfreeze", text: "冻结解除，恢复借出" },
              ...o.events,
            ],
          }
        : o,
    ),
  };
}

/* --------------------------------- 展示辅助 -------------------------------- */

export function formatClock(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function formatCountdown(ms: number): string {
  if (ms <= 0) return "已超时";
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const s = Math.floor((ms % 60000) / 1000);
  return h > 0 ? `${h}小时${m}分` : `${m}分${String(s).padStart(2, "0")}秒`;
}

export const STATUS_META: Record<GemStatus, { label: string; cls: string }> = {
  待借: { label: "待借", cls: "ok" },
  借出: { label: "借出中", cls: "loan" },
  待定: { label: "待定", cls: "hold" },
};
