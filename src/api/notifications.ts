import { get, post } from './client';
export interface NotificationDTO {
  nId: number; nType: string; nTitle: string; nBody: string;
  nTargetType?: string | null; nTargetId?: number | null; nTargetKey?: string | null;
  nIsRead: boolean; nCreatedAt: string;
}
export const getNotification = (id: number): Promise<NotificationDTO> => get(`/fans/me/notifications/${id}`);
export const markNotificationRead = (id: number): Promise<void> => post(`/fans/me/notifications/${id}/read`, {});
