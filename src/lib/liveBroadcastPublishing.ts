import { createElement, type ComponentType } from 'react';
import { View, type ViewProps } from 'react-native';

import type { EventLiveBroadcastQuality } from '../types';

type NativeMediaStream = {
  getTracks: () => Array<{ stop: () => void }>;
  release: (deep?: boolean) => void;
  toURL: () => string;
};

type NativePeerConnection = {
  iceGatheringState: string;
  addTrack: (track: { stop: () => void }, stream: NativeMediaStream) => void;
  createOffer: () => Promise<{ sdp?: string | null }>;
  setLocalDescription: (offer: { sdp?: string | null }) => Promise<void>;
  localDescription?: { sdp?: string | null } | null;
  setRemoteDescription: (description: unknown) => Promise<void>;
  close: () => void;
};

type WebRtcModule = {
  mediaDevices: {
    getUserMedia: (constraints: {
      audio: boolean;
      video: ReturnType<typeof qualityToVideoConstraints>;
    }) => Promise<NativeMediaStream>;
  };
  RTCPeerConnection: new (configuration: { iceServers: never[] }) => NativePeerConnection;
  RTCSessionDescription: new (description: { type: 'answer'; sdp: string }) => unknown;
  RTCView: ComponentType<NativeRTCViewProps>;
};

type NativeRTCViewProps = ViewProps & {
  streamURL: string;
  objectFit?: 'contain' | 'cover';
  mirror?: boolean;
};

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
let cachedWebRtcModule: WebRtcModule | null | undefined;

async function loadWebRtcModule(): Promise<WebRtcModule | null> {
  if (cachedWebRtcModule !== undefined) return cachedWebRtcModule;

  try {
    cachedWebRtcModule = (await import('react-native-webrtc')) as unknown as WebRtcModule;
  } catch {
    cachedWebRtcModule = null;
  }

  return cachedWebRtcModule;
}

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

const waitForIceGatheringComplete = (pc: NativePeerConnection): Promise<void> => {
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
  const webRtcModule = await loadWebRtcModule();
  if (!webRtcModule) {
    throw new Error('Transmitir en vivo requiere la build instalada de TDF Records; Expo Go no incluye WebRTC nativo.');
  }

  const whipUrl = input.whipUrl?.trim();
  if (!whipUrl) {
    throw new Error('El backend no devolvió una URL WHIP para publicar video en vivo.');
  }

  let stream: NativeMediaStream | null = null;
  let pc: NativePeerConnection | null = null;
  let resourceUrl: string | null = null;

  try {
    stream = await webRtcModule.mediaDevices.getUserMedia({
      audio: true,
      video: qualityToVideoConstraints(input.quality),
    });
    pc = new webRtcModule.RTCPeerConnection({ iceServers: [] });

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
    await pc.setRemoteDescription(new webRtcModule.RTCSessionDescription({ type: 'answer', sdp: answerSdp }));

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

export function RTCView(props: NativeRTCViewProps) {
  const NativeRTCView = cachedWebRtcModule?.RTCView;
  if (NativeRTCView) {
    return createElement(NativeRTCView, props);
  }

  const { streamURL: _streamURL, objectFit: _objectFit, mirror: _mirror, ...viewProps } = props;
  return createElement(View, viewProps);
}
