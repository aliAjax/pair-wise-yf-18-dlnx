/**
 * 状态层：全局唯一数据源。
 * - 只存浏览器（localStorage），刷新保留，不接后端。
 * - useSyncExternalStore 订阅；每秒通知界面刷新倒计时，每 30 秒巡检超时借出。
 * - 演示时钟：快进时间用于观察"超 4 小时自动释放"，不改动业务规则。
 */

import { useSyncExternalStore } from "react";
import {
  STORAGE_KEY,
  SWEEP_MS,
  TICK_MS,
  borrowGem,
  createSeedState,
  returnGem as returnGemRule,
  sweepOverdue,
  unfreezeOrder,
  type State,
} from "./rules";

interface PersistShape {
  state: State;
  clockOffset: number;
}

let state: State;
let clockOffset = 0;

function load(): { state: State; clockOffset: number } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PersistShape;
      if (parsed && Array.isArray(parsed.state?.gems) && Array.isArray(parsed.state?.orders)) {
        return { state: parsed.state, clockOffset: parsed.clockOffset ?? 0 };
      }
    }
  } catch {
    /* 存储损坏时回落到预置数据 */
  }
  return { state: createSeedState(), clockOffset: 0 };
}

const initial = load();
state = initial.state;
clockOffset = initial.clockOffset;

/* ------------------------------ store 基础能力 ----------------------------- */

const listeners = new Set<() => void>();
let scheduled = false;

function notify(): void {
  // 同一时刻的多次动作合并为一次通知
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => {
    scheduled = false;
    listeners.forEach((l) => l());
  });
}

function persist(): void {
  try {
    const payload: PersistShape = { state, clockOffset };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* 隐私模式 / 配额超限时静默降级为仅内存 */
  }
}

/** 当前业务时间（受演示快进影响） */
export function now(): number {
  return Date.now() + clockOffset;
}

/** 执行一个状态变更：自动巡检 → 变更 → 再巡检 → 落盘通知 */
function commit(mutator: (draft: State, at: number) => State): void {
  const before = sweepOverdue(state, now());
  const draft = mutator(before.state, now());
  const after = sweepOverdue(draft, now());
  state = after.state;
  persist();
  notify();
}

export const store = {
  getState(): State {
    return state;
  },
  getClockOffset(): number {
    return clockOffset;
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  selectOrder(orderId: string): void {
    state = { ...state, activeOrderId: orderId };
    persist();
    notify();
  },

  borrow(orderId: string, gemId: string): void {
    commit((draft, at) => borrowGem(draft, orderId, gemId, at));
  },

  returnGem(gemId: string, passed: boolean, note: string): void {
    commit((draft, at) => returnGemRule(draft, gemId, passed, at, note));
  },

  unfreeze(orderId: string): void {
    commit((draft, at) => unfreezeOrder(draft, orderId, at));
  },

  /** 演示用：快进业务时钟 */
  advanceClock(ms: number): void {
    clockOffset += ms;
    const swept = sweepOverdue(state, now());
    state = swept.state;
    persist();
    notify();
  },

  /** 演示用：恢复实时时钟（既有借出记录的时间戳保留） */
  resetClock(): void {
    clockOffset = 0;
    persist();
    notify();
  },

  /** 清空浏览器数据，恢复预置三张订单与十二颗宝石 */
  resetAll(): void {
    clockOffset = 0;
    state = createSeedState();
    persist();
    notify();
  },
};

/* ------------------------------ 定时巡检 / 计时 ----------------------------- */

// 每秒刷新倒计时显示（不写盘）
setInterval(notify, TICK_MS);

// 每 30 秒处理"超 4 小时未归还 → 自动释放"
setInterval(() => {
  const swept = sweepOverdue(state, now());
  if (swept.released.length > 0) {
    state = swept.state;
    persist();
    notify();
  }
}, SWEEP_MS);

// 页面重新可见时立刻巡检一次（处理标签页挂起期间到期的借出）
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    const swept = sweepOverdue(state, now());
    if (swept.released.length > 0) {
      state = swept.state;
      persist();
      notify();
    }
  }
});

/* -------------------------------- React 绑定 ------------------------------- */

export function useStore(): State {
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}
