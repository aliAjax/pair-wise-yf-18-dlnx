// 业务规则层：领域类型、状态常量、规则常量、纯逻辑函数与预置数据。
// 本文件不依赖 React / DOM，所有状态流转都是可单测的纯函数。

// ---------- 领域类型 ----------

export type GemStatus = "available" | "onloan" | "pending";

export type OrderStatus = "active" | "frozen";

export interface LoanRecord {
  orderId: string;
  borrowedAt: number;
  returnedAt?: number;
  result?: "pass" | "fail";
  note?: string;
}

export interface Gem {
  id: string; // 宝石编号
  kind: string; // 种类
  shape: string; // 形状：圆形 / 椭圆 / 梨形 / 祖母绿切
  carat: number; // 克拉重量
  sizeMm: number; // 尺寸（直径/口径，毫米）
  clarity: string; // 净度
  color: string; // 颜色
  cut: string; // 切工
  position: string; // 镶嵌位置（镶口编码）
  batch: string; // 分拣批次
  defect?: string; // 缺陷备注
  status: GemStatus; // 分拣/借还状态：待借 / 借出 / 待定
  loans: LoanRecord[]; // 借还履历
}

export interface MountSlot {
  position: string; // 镶口编码
  label: string; // 镶口名称
  shape: string; // 适配形状
  sizeMm: number; // 适配尺寸
  x: number; // SVG 坐标（viewBox 0 0 320 260）
  y: number;
}

export interface Order {
  id: string; // 订单号
  name: string; // 订单名称
  client: string; // 客户
  due: string; // 交付日期
  mount: "ring" | "pendant" | "stud"; // 镶嵌位置示意图类型
  slots: MountSlot[]; // 镶口清单
  status: OrderStatus; // 正常 / 冻结（复检不合格后冻结后续借出）
  frozenReason?: string;
}

export interface BenchState {
  gems: Gem[];
  orders: Order[];
}

// ---------- 规则常量 ----------

export const LOAN_LIMIT_MS = 4 * 60 * 60 * 1000; // 试镶借期：4 小时
export const STORE_VERSION = 1;
export const STORAGE_KEY = `trial-setting-bench:v${STORE_VERSION}`;
export const SIZE_TOLERANCE_MM = 0.2; // 镶口与宝石的尺寸匹配容差

// ---------- 展示文案 ----------

export const GEM_STATUS_TEXT: Record<GemStatus, string> = {
  available: "待借",
  onloan: "借出",
  pending: "待定",
};

export const ORDER_STATUS_TEXT: Record<OrderStatus, string> = {
  active: "可借出",
  frozen: "已冻结",
};

export const SHAPE_FILTERS = ["圆形", "椭圆", "梨形", "祖母绿切"];

// ---------- 预置数据：三张订单 ----------

export const SEED_ORDERS: Order[] = [
  {
    id: "ORD-301",
    name: "星轨戒指",
    client: "林女士",
    due: "2026-10-08",
    mount: "ring",
    status: "active",
    slots: [
      { position: "C", label: "主石位", shape: "椭圆", sizeMm: 6, x: 160, y: 130 },
      ...Array.from({ length: 6 }, (_, i) => {
        const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
        return {
          position: `P${i + 1}`,
          label: `围石 ${i + 1} 位`,
          shape: "圆形",
          sizeMm: 2,
          x: 160 + Math.cos(a) * 78,
          y: 130 + Math.sin(a) * 78,
        } satisfies MountSlot;
      }),
    ],
  },
  {
    id: "ORD-302",
    name: "晨露吊坠",
    client: "周先生",
    due: "2026-10-15",
    mount: "pendant",
    status: "active",
    slots: [
      { position: "C", label: "主石位", shape: "梨形", sizeMm: 7, x: 160, y: 122 },
      ...Array.from({ length: 4 }, (_, i) => {
        const a = (i / 4) * Math.PI * 2 - Math.PI / 2;
        return {
          position: `A${i + 1}`,
          label: `围石 A${i + 1}`,
          shape: "圆形",
          sizeMm: 3,
          x: 160 + Math.cos(a) * 66,
          y: 122 + Math.sin(a) * 66,
        } satisfies MountSlot;
      }),
    ],
  },
  {
    id: "ORD-303",
    name: "月华耳钉（一对）",
    client: "陈女士",
    due: "2026-10-20",
    mount: "stud",
    status: "active",
    slots: [
      { position: "L", label: "左耳钉主石", shape: "圆形", sizeMm: 4, x: 92, y: 120 },
      { position: "R", label: "右耳钉主石", shape: "圆形", sizeMm: 4, x: 228, y: 120 },
    ],
  },
];

// ---------- 预置数据：十二颗库存宝石（三个分拣批次） ----------

export const SEED_GEMS: Gem[] = [
  // 批次 A-2609：主石
  {
    id: "ST-2048",
    kind: "蓝宝石",
    shape: "椭圆",
    carat: 1.18,
    sizeMm: 6,
    clarity: "VVS",
    color: "皇家蓝",
    cut: "椭圆明亮式",
    position: "C",
    batch: "A-2609",
    status: "available",
    loans: [],
  },
  {
    id: "ST-2052",
    kind: "蓝宝石",
    shape: "梨形",
    carat: 1.62,
    sizeMm: 7,
    clarity: "VS",
    color: "矢车菊蓝",
    cut: "梨形玫瑰式",
    position: "C",
    batch: "A-2609",
    status: "available",
    loans: [],
  },
  {
    id: "ST-2061",
    kind: "钻石",
    shape: "圆形",
    carat: 0.32,
    sizeMm: 4,
    clarity: "VVS1",
    color: "D",
    cut: "明亮式",
    position: "L",
    batch: "A-2609",
    status: "available",
    loans: [],
  },
  {
    id: "ST-2063",
    kind: "钻石",
    shape: "圆形",
    carat: 0.31,
    sizeMm: 4,
    clarity: "VS1",
    color: "E",
    cut: "明亮式",
    position: "R",
    batch: "A-2609",
    status: "available",
    loans: [],
  },
  // 批次 B-2611：围石小钻（6 颗）
  ...(["P1", "P2", "P3", "P4", "P5", "P6"] as const).map((position, i) => ({
    id: `ST-${2101 + i}`,
    kind: "钻石",
    shape: "圆形",
    carat: 0.08,
    sizeMm: 2,
    clarity: "SI1",
    color: "G",
    cut: "明亮式",
    position,
    batch: "B-2611",
    status: "available" as GemStatus,
    loans: [] as LoanRecord[],
  })),
  // 批次 C-2614：备用围石与主石
  {
    id: "ST-3208",
    kind: "沙弗莱石",
    shape: "圆形",
    carat: 0.21,
    sizeMm: 3,
    clarity: "VS",
    color: "翠绿",
    cut: "明亮式",
    position: "A1",
    batch: "C-2614",
    status: "pending",
    defect: "腰围可见内含物，需客户确认是否可用",
    loans: [],
  },
  {
    id: "ST-3215",
    kind: "石榴石",
    shape: "圆形",
    carat: 0.15,
    sizeMm: 3,
    clarity: "SI",
    color: "酒红",
    cut: "明亮式",
    position: "A2",
    batch: "C-2614",
    status: "available",
    loans: [],
  },
];

export function seedState(): BenchState {
  return {
    orders: SEED_ORDERS.map((o) => ({ ...o, slots: o.slots.map((s) => ({ ...s })) })),
    gems: SEED_GEMS.map((g) => ({ ...g, loans: [] })),
  };
}

// ---------- 查询辅助 ----------

export function currentLoan(gem: Gem): LoanRecord | undefined {
  return gem.status === "onloan" ? gem.loans[gem.loans.length - 1] : undefined;
}

export function isOverdue(gem: Gem, now: number): boolean {
  const loan = currentLoan(gem);
  return !!loan && now - loan.borrowedAt > LOAN_LIMIT_MS;
}

/** 剩余借期毫秒数；非借出状态返回 0 */
export function remainMs(gem: Gem, now: number): number {
  const loan = currentLoan(gem);
  if (!loan) return 0;
  return Math.max(0, loan.borrowedAt + LOAN_LIMIT_MS - now);
}

export function gemsByBatch(state: BenchState): Record<string, Gem[]> {
  const groups: Record<string, Gem[]> = {};
  for (const gem of state.gems) {
    (groups[gem.batch] ??= []).push(gem);
  }
  return groups;
}

export function gemsOnLoanTo(state: BenchState, orderId: string): Gem[] {
  return state.gems.filter((g) => currentLoan(g)?.orderId === orderId);
}

/** 该订单已通过复检（归还 pass）的宝石 */
export function gemsPassedFor(order: Order, state: BenchState): Gem[] {
  const seen = new Set<string>();
  const passed: Gem[] = [];
  for (const gem of state.gems) {
    if (gem.loans.some((l) => l.orderId === order.id && l.result === "pass") && !seen.has(gem.id)) {
      seen.add(gem.id);
      passed.push(gem);
    }
  }
  return passed;
}

/** 宝石是否与镶口匹配（形状一致、尺寸在容差内） */
export function fitsSlot(gem: Gem, slot: MountSlot): boolean {
  return gem.shape === slot.shape && Math.abs(gem.sizeMm - slot.sizeMm) <= SIZE_TOLERANCE_MM;
}

/** 订单当前在该镶口上占用/试镶的宝石：优先按镶口编号精确匹配，再按形状尺寸 */
export function gemAtSlot(state: BenchState, order: Order, slot: MountSlot): Gem | undefined {
  // 已通过本单复检、但当前又被其他订单借走的宝石，不再显示在本单镶口上
  const passed = gemsPassedFor(order, state).filter((g) => g.status !== "onloan");
  const onLoan = state.gems.filter((g) => currentLoan(g)?.orderId === order.id);
  return (
    onLoan.find((g) => g.position === slot.position) ??
    onLoan.find((g) => fitsSlot(g, slot)) ??
    passed.find((g) => g.position === slot.position) ??
    passed.find((g) => fitsSlot(g, slot))
  );
}

// ---------- 规则校验 ----------

export type GuardResult = { ok: true } | { ok: false; reason: string };

export function canBorrow(state: BenchState, gemId: string, orderId: string): GuardResult {
  const gem = state.gems.find((g) => g.id === gemId);
  const order = state.orders.find((o) => o.id === orderId);
  if (!gem) return { ok: false, reason: "宝石不存在" };
  if (!order) return { ok: false, reason: "订单不存在" };
  if (gem.status === "onloan") {
    const loan = currentLoan(gem)!;
    if (loan.orderId === orderId) return { ok: false, reason: "该宝石已借给本订单" };
    const other = state.orders.find((o) => o.id === loan.orderId);
    return { ok: false, reason: `已借给 ${other?.name ?? loan.orderId}，借出期间不可重复占用` };
  }
  if (gem.status === "pending")
    return { ok: false, reason: "宝石待定（复检不合格 / 缺陷待确认），不能借出" };
  if (order.status === "frozen")
    return {
      ok: false,
      reason: `订单已冻结：${order.frozenReason ?? "复检不合格，暂停后续借出"}`,
    };
  return { ok: true };
}

// ---------- 状态流转（纯函数，返回新状态） ----------

/**
 * 自动释放：借出超过 4 小时未归还，宝石回到待借、借出履历标记 timeout。
 * 订单不因此冻结。
 */
export function sweepOverdue(prev: BenchState, now: number): BenchState {
  let changed = false;
  const gems: Gem[] = prev.gems.map((gem) => {
    const loan = currentLoan(gem);
    if (!loan || !isOverdue(gem, now)) return gem;
    changed = true;
    const loans = gem.loans.slice();
    loans[loans.length - 1] = { ...loan, returnedAt: now, result: "fail", note: "超 4 小时未归还，系统自动释放" };
    return { ...gem, status: "available", loans };
  });
  return changed ? { ...prev, gems } : prev;
}

export function borrow(prev: BenchState, gemId: string, orderId: string, now: number): BenchState {
  if (!canBorrow(prev, gemId, orderId).ok) return prev;
  return {
    ...prev,
    gems: prev.gems.map((g) =>
      g.id === gemId
        ? {
            ...g,
            status: "onloan",
            loans: [...g.loans, { orderId, borrowedAt: now }],
          }
        : g
    ),
  };
}

/** 归还复检合格：回到待借，履历记 pass（可供其他订单试镶） */
export function returnPassed(prev: BenchState, gemId: string, now: number): BenchState {
  return finishLoan(prev, gemId, now, "pass", "复检合格，归还入库");
}

/**
 * 归还复检不合格：宝石转待定，
 * 同时冻结对应订单的后续借出（仍允许归还本单已借宝石）。
 */
export function returnFailed(
  prev: BenchState,
  gemId: string,
  now: number,
  defect: string
): BenchState {
  const gem = prev.gems.find((g) => g.id === gemId);
  const loan = gem && currentLoan(gem);
  if (!loan) return prev;
  const reason = defect.trim() || "归还复检不合格";
  const next = finishLoan(prev, gemId, now, "fail", reason);
  return {
    ...next,
    orders: next.orders.map((o) =>
      o.id === loan.orderId
        ? { ...o, status: "frozen", frozenReason: `${gem!.id} 复检不合格：${reason}` }
        : o
    ),
  };
}

function finishLoan(
  prev: BenchState,
  gemId: string,
  now: number,
  result: "pass" | "fail",
  note: string
): BenchState {
  const gem = prev.gems.find((g) => g.id === gemId);
  if (!gem || gem.status !== "onloan") return prev;
  return {
    ...prev,
    gems: prev.gems.map((g) => {
      if (g.id !== gemId) return g;
      const loans = g.loans.slice();
      loans[loans.length - 1] = {
        ...loans[loans.length - 1],
        returnedAt: now,
        result,
        note,
      };
      return { ...g, status: result === "pass" ? "available" : "pending", loans };
    }),
  };
}

/** 解冻订单（复检不合格的宝石仍保持待定） */
export function unfreezeOrder(prev: BenchState, orderId: string): BenchState {
  return {
    ...prev,
    orders: prev.orders.map((o) =>
      o.id === orderId ? { ...o, status: "active", frozenReason: undefined } : o
    ),
  };
}

// ---------- 筛选 ----------

export interface GemFilter {
  shape: string | null;
  sizeMm: number | null;
  batch: string | null;
  status: GemStatus | null;
  keyword: string;
}

export const EMPTY_FILTER: GemFilter = {
  shape: null,
  sizeMm: null,
  batch: null,
  status: null,
  keyword: "",
};

export function filterGems(gems: Gem[], filter: GemFilter): Gem[] {
  const kw = filter.keyword.trim().toLowerCase();
  return gems.filter((g) => {
    if (filter.shape && g.shape !== filter.shape) return false;
    if (filter.sizeMm !== null && Math.abs(g.sizeMm - filter.sizeMm) > SIZE_TOLERANCE_MM)
      return false;
    if (filter.batch && g.batch !== filter.batch) return false;
    if (filter.status && g.status !== filter.status) return false;
    if (kw && !`${g.id} ${g.kind} ${g.color} ${g.position} ${g.defect ?? ""}`.toLowerCase().includes(kw))
      return false;
    return true;
  });
}

// ---------- 时间格式 ----------

export function formatClock(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(h)}:${p(m)}:${p(s)}`;
}

// ---------- 指标 ----------

export interface Metrics {
  total: number;
  available: number;
  onloan: number;
  pending: number;
  overdue: number;
  totalCarat: number;
  batches: number;
}

export function computeMetrics(state: BenchState, now: number): Metrics {
  return {
    total: state.gems.length,
    available: state.gems.filter((g) => g.status === "available").length,
    onloan: state.gems.filter((g) => g.status === "onloan").length,
    pending: state.gems.filter((g) => g.status === "pending").length,
    overdue: state.gems.filter((g) => isOverdue(g, now)).length,
    totalCarat: state.gems.reduce((sum, g) => sum + g.carat, 0),
    batches: new Set(state.gems.map((g) => g.batch)).size,
  };
}
