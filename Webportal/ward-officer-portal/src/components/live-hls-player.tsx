"use client";

import { useEffect, useRef } from "react";
import Hls from "hls.js";

type LiveHlsPlayerProps = {
  src: string;
};

function resolvePlayableSrc(inputSrc: string): string {
  if (!inputSrc || typeof window === "undefined") {
    return inputSrc;
  }

  const parsed = new URL(inputSrc, window.location.href);
  if (parsed.origin === window.location.origin) {
    return parsed.toString();
  }

  // Route cross-origin HLS paths through the app rewrite proxy.
  if (parsed.pathname.startsWith("/hls/")) {
    return `${window.location.origin}${parsed.pathname}${parsed.search}`;
  }

  return parsed.toString();
}

export default function LiveHlsPlayer({ src }: LiveHlsPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canPlayNativeHls =
    typeof document !== "undefined" &&
    document.createElement("video").canPlayType("application/vnd.apple.mpegurl") !== "";

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    if (Hls.isSupported()) {
      const hls = new Hls({
        lowLatencyMode: true,
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 6,
        backBufferLength: 30,
        enableWorker: true,
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          hls.destroy();
        }
      });

      const streamUrl = new URL(resolvePlayableSrc(src), window.location.href);
      streamUrl.searchParams.set("_", Date.now().toString());

      hls.loadSource(streamUrl.toString());
      hls.attachMedia(video);

      return () => {
        hls.destroy();
      };
    }

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      const streamUrl = new URL(resolvePlayableSrc(src), window.location.href);
      streamUrl.searchParams.set("_", Date.now().toString());
      video.src = streamUrl.toString();
      return;
    }
  }, [src]);

  const error = !src
    ? "Set NEXT_PUBLIC_HLS_STREAM_URL to play live stream."
    : !Hls.isSupported() && !canPlayNativeHls
      ? "This browser does not support HLS playback."
      : "";

  return (
    <div className="space-y-2">
      <video
        ref={videoRef}
        controls
        autoPlay
        muted
        playsInline
        className="h-[340px] w-full rounded-xl border border-[var(--line)] bg-black"
      />
      {error ? <p className="text-xs text-[var(--coral)]">{error}</p> : null}
    </div>
  );
}
