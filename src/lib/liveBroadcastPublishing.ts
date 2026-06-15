import {
  mediaDevices,
  RTCPeerConnection,
  RTCSessionDescription,
  RTCView,
  type MediaStream as NativeMediaStream,
} from 'react-native-webrtc';

import type { EventLiveBroadcastQuality } from '../types';

type WhipPublisherInput = {
  whipUrl?: string | null;
  streamKey?: string | null;
  quality?: EventLiveBroadcastQuality;
};

export type LiveBroadcastPublisherSession = {
  previewUrl: string;
  stop: () => Promise<void>;
};

const ICE_GATHERING_TIMEOUT_MS = 8000;

const qualityToVideoConstraints = (quality: EventLiveBroadcastQuality = 'auto') => {
  switch (quality) {
    case '720p':
      return {
        facingMode: 'environment',
        width: 1280,
        height: 720,
        frameRate: 30,
      };
    case '480p':
      return {
        facingMode: 'environment',
        width: 854,
        height: 480,
        frameRate: 24,
      };
    case 'auto':
    default:
      return {
        facingMode: 'environment',
        frameRate: 30,
      };
  }
};

const buildWhipHeaders = (streamKey?: string | null): Record<string, string> => {
  const headers: Record<string, string> = {
    Accept: 'application/sdp',
    'Content-Type': 'application/sdp',
  };
  const trimmedKey = streamKey?.trim();
  if (trimmedKey) {
    headers.Authorization = `Bearer ${trimmedKey}`;
  }
  return headers;
};

const waitForIceGatheringComplete = (pc: RTCPeerConnection): Promise<void> => {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();

  const startedAt = Date.now();
  return new Promise((resolve) => {
    const poll = () => {
      if (pc.iceGatheringState === 'complete' || Date.now() - startedAt >= ICE_GATHERING_TIMEOUT_MS) {
        resolve();
        return;
      }
      setTimeout(poll, 100);
    };
    poll();
  });
};

const resolveWhipResourceUrl = (location: string | null, whipUrl: string): string | null => {
  const trimmed = location?.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed, whipUrl).toString();
  } catch {
    return trimmed;
  }
};

const stopMediaStream = (stream: NativeMediaStream): void => {
  stream.getTracks().forEach((track) => {
    track.stop();
  });
  stream.release(true);
};

export async function startWhipBroadcastPublisher(
  input: WhipPublisherInput,
): Promise<LiveBroadcastPublisherSession> {
  const whipUrl = input.whipUrl?.trim();
  if (!whipUrl) {
    throw new Error('El backend no devolvió una URL WHIP para publicar video en vivo.');
  }

  let stream: NativeMediaStream | null = null;
  let pc: RTCPeerConnection | null = null;
  let resourceUrl: string | null = null;

  try {
    stream = await mediaDevices.getUserMedia({
      audio: true,
      video: qualityToVideoConstraints(input.quality),
    });
    pc = new RTCPeerConnection({ iceServers: [] });

    stream.getTracks().forEach((track) => {
      pc?.addTrack(track, stream as NativeMediaStream);
    });

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await waitForIceGatheringComplete(pc);

    const offerSdp = pc.localDescription?.sdp;
    if (!offerSdp) {
      throw new Error('No pudimos preparar la señal de video para la transmisión.');
    }

    const response = await fetch(whipUrl, {
      method: 'POST',
      headers: buildWhipHeaders(input.streamKey),
      body: offerSdp,
    });

    if (!response.ok) {
      throw new Error(`El servidor WHIP rechazó la transmisión (${response.status}).`);
    }

    const answerSdp = await response.text();
    if (!answerSdp.trim()) {
      throw new Error('El servidor WHIP respondió sin una señal de video válida.');
    }

    resourceUrl = resolveWhipResourceUrl(response.headers.get('Location'), whipUrl);
    await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: answerSdp }));

    const activeStream = stream;
    const activePc = pc;

    return {
      previewUrl: activeStream.toURL(),
      stop: async () => {
        const deleteUrl = resourceUrl;
        if (deleteUrl) {
          await fetch(deleteUrl, {
            method: 'DELETE',
            headers: buildWhipHeaders(input.streamKey),
          }).catch(() => undefined);
        }
        activePc.close();
        stopMediaStream(activeStream);
      },
    };
  } catch (error) {
    if (pc) {
      pc.close();
    }
    if (stream) {
      stopMediaStream(stream);
    }
    throw error;
  }
}

export { RTCView };
