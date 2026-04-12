import { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { API_BASE_URL } from '../config';

export const useTelegram = () => {
  const { token, refreshUser } = useAuthStore();
  const [link, setLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);

  const generateLink = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/link-telegram`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setLink(data.link);

      // Poll every 3s to detect when user connects
      setPolling(true);
      const interval = setInterval(async () => {
        await refreshUser();
        const updated = useAuthStore.getState().user;
        if (updated?.telegramConnected) {
          clearInterval(interval);
          setPolling(false);
        }
      }, 3000);

      // Stop polling after 3 minutes
      setTimeout(() => { clearInterval(interval); setPolling(false); }, 180000);

    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const copyLink = () => {
    if (!link) return;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openInTelegram = () => {
    if (link) window.open(link, '_blank');
  };

  return { link, loading, copied, error, polling, generateLink, copyLink, openInTelegram };
};