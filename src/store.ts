// 状态层：全应用唯一数据源。
// 负责 localStorage 持久化（刷新保留、不接后端）、定时自动释放、跨标签页同步。
// 组件只能通过此处导出的动作修改状态，规则纯函数集中在 rules.ts。

import { useSyncExternalStore } from "react";
import {
  BenchState,
  STORAGE_KEY,
  borrow,
  returnPassed,
  returnFailed,
  seedState,
  sweepOverdue,
  unfreezeOrder,
} from "./rules";

interface PersistShape {
  version: number;
  state: BenchState;
  clockOffsetMs: number;
}

function load(): PersistShape {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PersistShape;
      if (parsed.version === 1 && parsed.state?.gems && parsed.state?.orders) {
        return { ...parsed, clockOffsetMs: parsed.clockOffsetMs ?? 0 };
      }
    }
  } catch {
    // 存储损坏时回落到预置数据
  }
  return { version: 1, state: seedState(), clockOffsetMs: 0 };
}

let persist = load();
// 进入时先执行一次超时释放（含「上次打开已超时」的借单）
persist.state = sweepOverdue(persist.state, Date.now() + persist.clockOffsetMs);

let listeners = new Set<() => void>();

function commit(next: BenchState) {
  persist.state = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persist));
  } catch {
    // 配额满或隐私模式下仅保留内存态
  }
  listeners.forEach((fn) => fn());
}

function emit() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persist));
  } catch {
    // ignore
  }
  listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue) as PersistShape;
        if (parsed.version === 1) {
          persist = parsed;
          fn();
        }
      } catch {
        // ignore malformed payload
      }
    }
  };
  window.addEventListener("storage", onStorage);
  document.addEventListener("visibilitychange", sweep);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", onStorage);
    document.removeEventListener("visibilitychange", sweep);
  };
}

/** 统一时钟：真实时间 + 演练偏移（演练「快进 4 小时」用，仅影响本机） */
export function now(): number {
  return Date.now() + persist.clockOffsetMs;
}

/** 动作前先跑一次自动释放，保证借出/归还判定基于最新时钟 */
function sweep() {
  const swept = sweepOverdue(persist.state, now());
  if (swept !== persist.state) commit(swept);
}

// ---------- 对外动作 ----------

export const actions = {
  borrowGem(gemId: string, orderId: string) {
    sweep();
    commit(borrow(persist.state, gemId, orderId, now()));
  },
  returnPassed(gemId: string) {
    sweep();
    commit(returnPassed(persist.state, gemId, now()));
  },
  returnFailed(gemId: string, defect: string) {
    sweep();
    commit(returnFailed(persist.state, gemId, now(), defect));
  },
  unfreeze(orderId: string) {
    commit(unfreezeOrder(persist.state, orderId));
  },
  /** 演练：把时钟快进 4 小时，触发超时自动释放 */
  fastForwardFourHours() {
    persist.clockOffsetMs += 4 * 60 * 60 * 1000;
    sweep();
    emit();
  },
  resetAll() {
    persist = { version: 1, state: seedState(), clockOffsetMs: 0 };
    emit();
  },
};

// ---------- React 订阅 ----------

export function useBench(): BenchState {
  return useSyncExternalStore(
    subscribe,
    () => persist.state,
    () => persist.state
  );
}

export function useNow(tickMs = 1000): number {
  return useSyncExternalStore(
    (onChange) => {
      const timer = window.setInterval(onChange, tickMs);
      return () => window.clearInterval(timer);
    },
    () => now(),
    () => Date.now()
  );
}

// 后台定时巡检：每 20 秒检查一次超期借单
if (typeof window !== "undefined") {
  window.setInterval(sweep, 20_000);
}
