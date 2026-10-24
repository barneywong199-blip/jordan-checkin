// 打卡统计与备份提醒。

import { REGIONS } from './data.js';

export const BACKUP_REMIND_DAYS = 30;

export function visitedSet(checkins) {
  return new Set(checkins.map((c) => c.siteId));
}

export function computeStats(sites, eras, checkins) {
  const visited = visitedSet(checkins);
  const siteIds = new Set(sites.map((s) => s.id));
  const visitedSites = sites.filter((s) => visited.has(s.id));
  const erasCovered = new Set(visitedSites.map((s) => s.era));
  const byRegion = Object.fromEntries(
    REGIONS.map((r) => {
      const list = sites.filter((s) => s.region === r.id);
      return [r.id, { total: list.length, visited: list.filter((s) => visited.has(s.id)).length }];
    }),
  );
  return {
    total: sites.length,
    visitedCount: visitedSites.length,
    checkinCount: checkins.filter((c) => siteIds.has(c.siteId)).length,
    erasCovered: erasCovered.size,
    totalEras: eras.length,
    byRegion,
  };
}

// 有打卡资料、而且从未备份或上次备份超过 30 天，就提醒。
export function needsBackupReminder({ lastBackupAt, firstCheckinAt, hasCheckins }, now = Date.now()) {
  if (!hasCheckins) return false;
  const day = 24 * 3600 * 1000;
  const since = lastBackupAt ?? firstCheckinAt;
  if (!since) return false;
  return now - since > BACKUP_REMIND_DAYS * day;
}

// 足迹：按打卡日期从新到旧，同一天按建立时间从新到旧。
export function sortCheckinsNewestFirst(checkins) {
  return [...checkins].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
}
