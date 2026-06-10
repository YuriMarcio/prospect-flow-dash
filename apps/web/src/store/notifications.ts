import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Notification {
  id: string;
  leadId: string;
  leadName: string;
  type: "follow_up";
  message: string;
  createdAt: string;
  dueAt: string;
  read: boolean;
  snoozedUntil?: string;
}

interface NotificationsState {
  notifications: Notification[];
  scheduleFollowUp: (leadId: string, leadName: string, delayHours?: number) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  dismiss: (id: string) => void;
  snooze: (id: string, hours: number) => void;
  cancelFollowUp: (leadId: string) => void;
}

export const useNotificationsStore = create<NotificationsState>()(
  persist(
    (set, get) => ({
      notifications: [],

      scheduleFollowUp: (leadId, leadName, delayHours = 48) => {
        // Cancel any existing follow-up for this lead first
        get().cancelFollowUp(leadId);

        const dueAt = new Date();
        dueAt.setHours(dueAt.getHours() + delayHours);

        const notification: Notification = {
          id: `fu-${leadId}-${Date.now()}`,
          leadId,
          leadName,
          type: "follow_up",
          message: `Tentar contato novamente com ${leadName}`,
          createdAt: new Date().toISOString(),
          dueAt: dueAt.toISOString(),
          read: false,
        };

        set((s) => ({ notifications: [notification, ...s.notifications] }));
      },

      markRead: (id) =>
        set((s) => ({
          notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
        })),

      markAllRead: () =>
        set((s) => ({
          notifications: s.notifications.map((n) => ({ ...n, read: true })),
        })),

      dismiss: (id) =>
        set((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) })),

      snooze: (id, hours) => {
        const snoozedUntil = new Date();
        snoozedUntil.setHours(snoozedUntil.getHours() + hours);
        set((s) => ({
          notifications: s.notifications.map((n) =>
            n.id === id ? { ...n, read: true, snoozedUntil: snoozedUntil.toISOString() } : n,
          ),
        }));
      },

      cancelFollowUp: (leadId) =>
        set((s) => ({
          notifications: s.notifications.filter(
            (n) => !(n.leadId === leadId && n.type === "follow_up"),
          ),
        })),
    }),
    { name: "crm-notifications" },
  ),
);

export function isDue(n: Notification): boolean {
  const now = new Date();
  if (n.snoozedUntil && new Date(n.snoozedUntil) > now) return false;
  return new Date(n.dueAt) <= now;
}

export function formatRelativeTime(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "agora";
  if (mins < 60) return `há ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  return `há ${days} dia${days > 1 ? "s" : ""}`;
}

export function formatDueTime(isoDate: string): string {
  const diff = new Date(isoDate).getTime() - Date.now();
  if (diff <= 0) return "agora";
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `em ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `em ${hours}h`;
  const days = Math.floor(hours / 24);
  return `em ${days} dia${days > 1 ? "s" : ""}`;
}
