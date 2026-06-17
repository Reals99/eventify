import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../utils/api';

/**
 * Polls the processing status endpoint until the framed video is ready.
 *
 * @param {string|null} videoId
 * @returns {{ processing, ready, framedUrl, socialUrls, error, startPolling, stopPolling }}
 */
export default function useProcessing(videoId) {
  const [processing, setProcessing] = useState(false);
  const [ready,      setReady]      = useState(false);
  const [framedUrl,  setFramedUrl]  = useState(null);
  const [socialUrls, setSocialUrls] = useState({});
  const [error,      setError]      = useState('');
  const pollRef = useRef(null);

  const stopPolling = useCallback(() => {
    clearInterval(pollRef.current);
    pollRef.current = null;
  }, []);

  const startPolling = useCallback(() => {
    if (!videoId) return;
    setProcessing(true);
    setReady(false);
    setError('');

    pollRef.current = setInterval(async () => {
      try {
        const { data } = await api.get(`/process/${videoId}/status`);
        if (data.ready) {
          stopPolling();
          setProcessing(false);
          setReady(true);
          setFramedUrl(data.framedUrl);
          setSocialUrls({
            tiktok:    data.tiktokUrl,
            instagram: data.instagramUrl,
            facebook:  data.facebookUrl,
            twitter:   data.twitterUrl,
            youtube:   data.youtubeUrl,
          });
        }
      } catch (err) {
        stopPolling();
        setProcessing(false);
        setError('Processing status check failed: ' + (err.response?.data?.error || err.message));
      }
    }, 3000); // poll every 3 seconds
  }, [videoId, stopPolling]);

  // Stop polling on unmount
  useEffect(() => () => stopPolling(), [stopPolling]);

  return { processing, ready, framedUrl, socialUrls, error, startPolling, stopPolling };
}
