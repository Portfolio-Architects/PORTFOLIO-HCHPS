'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { ScheduleAlert } from './useScheduleAlerts';

const NOTIFICATION_COOLDOWN_MS = 30 * 60 * 1000; // 같은 알림 30분 내 재발송 방지

interface NotificationAlertOptions {
  /** 알림 체크 주기 (ms). 기본 60초 */
  checkIntervalMs?: number;
  /** 알림을 보낼 긴급도 수준 */
  urgencyLevels?: ScheduleAlert['urgency'][];
  /** 알림 활성화 여부 */
  enabled?: boolean;
}

const URGENCY_CONFIG: Record<string, { icon: string; tag: string; priority: 'high' | 'default' | 'low' }> = {
  overdue:     { icon: '🔴', tag: '지남',    priority: 'high' },
  now:         { icon: '🟠', tag: '진행중',  priority: 'high' },
  today:       { icon: '🔵', tag: '오늘',    priority: 'default' },
  tomorrow:    { icon: '🟣', tag: '내일',    priority: 'default' },
  'this-week': { icon: '⚪', tag: '이번주',  priority: 'low' },
};

function formatAlertTime(dt: Date): string {
  const now = new Date();
  const isToday = dt.toDateString() === now.toDateString();
  const time = dt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
  
  if (isToday) return `오늘 ${time}`;
  
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (dt.toDateString() === tomorrow.toDateString()) return `내일 ${time}`;
  
  return `${dt.getMonth() + 1}/${dt.getDate()} ${time}`;
}

export function useNotificationAlerts(
  alerts: ScheduleAlert[],
  options: NotificationAlertOptions = {}
) {
  const {
    checkIntervalMs = 60_000,
    urgencyLevels = ['overdue', 'now', 'today'],
    enabled = true,
  } = options;

  const [permission, setPermission] = useState<NotificationPermission>('default');
  const sentRef = useRef<Map<string, number>>(new Map());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [appEnabled, setAppEnabled] = useState(true);

  // 권한 상태 동기화
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if ('Notification' in window) {
        setPermission(Notification.permission);
      }
      const saved = localStorage.getItem('hchps_notification_enabled');
      if (saved !== null) {
        setAppEnabled(saved === 'true');
      }
    }
  }, []);

  // 알림 권한 요청
  const requestPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'denied';
    
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === 'granted') {
      setAppEnabled(true);
      localStorage.setItem('hchps_notification_enabled', 'true');
    }
    return result;
  }, []);

  const toggleAppEnabled = useCallback(() => {
    setAppEnabled(prev => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('hchps_notification_enabled', String(next));
      }
      return next;
    });
  }, []);

  // 개별 알림 발송
  const sendNotification = useCallback((alert: ScheduleAlert) => {
    if (permission !== 'granted') return;

    const now = Date.now();
    const lastSent = sentRef.current.get(alert.id);
    if (lastSent && now - lastSent < NOTIFICATION_COOLDOWN_MS) return;

    const config = URGENCY_CONFIG[alert.urgency] || URGENCY_CONFIG['today'];
    const typeLabel = alert.type === 'task' ? '업무' : alert.type === 'meeting' ? '회의' : '상사 일정';

    const body = [
      `${config.icon} [${config.tag}] ${typeLabel}`,
      formatAlertTime(alert.datetime),
      alert.location ? `📍 ${alert.location}` : '',
    ].filter(Boolean).join('\n');

    // 서비스 워커가 있으면 SW 통해 발송 (백그라운드 지원), 없으면 직접 발송
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'SHOW_NOTIFICATION',
        payload: {
          title: alert.title,
          body,
          tag: `schedule-${alert.id}`,
          icon: '/icon-192x192.png',
          badge: '/icon-192x192.png',
          data: { alertId: alert.id, type: alert.type },
          requireInteraction: alert.urgency === 'overdue' || alert.urgency === 'now',
          silent: false,
        },
      });
    } else {
      try {
        new Notification(alert.title, {
          body,
          tag: `schedule-${alert.id}`,
          icon: '/icon-192x192.png',
          badge: '/icon-192x192.png',
          requireInteraction: alert.urgency === 'overdue' || alert.urgency === 'now',
          silent: false,
        });
      } catch {
        // Notification 생성자 실패 시 무시 (일부 모바일 브라우저)
      }
    }

    sentRef.current.set(alert.id, now);

    // 오래된 쿨다운 기록 정리
    for (const [key, time] of sentRef.current.entries()) {
      if (now - time > NOTIFICATION_COOLDOWN_MS * 2) {
        sentRef.current.delete(key);
      }
    }
  }, [permission]);

  // 주기적 알림 체크
  const checkAndNotify = useCallback(() => {
    if (!enabled || !appEnabled || permission !== 'granted') return;

    const filteredAlerts = alerts.filter(a => urgencyLevels.includes(a.urgency));
    for (const alert of filteredAlerts) {
      sendNotification(alert);
    }
  }, [alerts, urgencyLevels, enabled, appEnabled, permission, sendNotification]);

  // 인터벌 설정
  useEffect(() => {
    if (!enabled || permission !== 'granted') return;

    // 초기 체크
    checkAndNotify();

    // 주기적 체크
    intervalRef.current = setInterval(checkAndNotify, checkIntervalMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, permission, checkIntervalMs, checkAndNotify]);

  // 알림 개수 뱃지 (미확인 긴급 알림)
  const urgentCount = alerts.filter(a => a.urgency === 'overdue' || a.urgency === 'now').length;

  return {
    permission,
    requestPermission,
    urgentCount,
    sendNotification,
    /** 수동으로 즉시 알림 체크 트리거 */
    checkNow: checkAndNotify,
    appEnabled,
    toggleAppEnabled,
  };
}
