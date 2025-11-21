"use client";

import { useState, useEffect } from "react";
import { useUser, SignedIn, SignedOut, SignInButton, SignOutButton } from "@clerk/nextjs";

export default function Page() {
  const { user } = useUser();
  const [url, setUrl] = useState("");
  const [formats, setFormats] = useState<any[]>([]);
  const [selected, setSelected] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [cookieFile, setCookieFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [totalSize, setTotalSize] = useState<number | null>(null);
  const [aborter, setAborter] = useState<AbortController | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [videoMetadata, setVideoMetadata] = useState<any>(null);
  const [downloadSpeed, setDownloadSpeed] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [eta, setEta] = useState<number | null>(null);

  // Load theme preference
  useEffect(() => {
    const saved = localStorage.getItem('theme');
    if (saved) {
      setDarkMode(saved === 'dark');
    }
  }, []);

  // Save theme preference
  useEffect(() => {
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  const colors = darkMode ? {
    bg: '#2A2A2A',
    surface: '#353535',
    text: '#E8E6E1',
    textSecondary: '#B8B6B1',
    border: '#E8E6E1',
    buttonBg: '#E8E6E1',
    buttonText: '#2A2A2A',
    dotOpacity: 0.12
  } : {
    bg: '#F8F7F4',
    surface: '#FFFFFF',
    text: '#000000',
    textSecondary: 'rgba(0,0,0,0.6)',
    border: '#000000',
    buttonBg: '#000000',
    buttonText: '#FFFFFF',
    dotOpacity: 0.08
  };

  async function uploadCookies() {
    if (!cookieFile) return setMsg("SELECT COOKIES.TXT FIRST");
    const fd = new FormData();
    fd.append("file", cookieFile);
    setMsg("UPLOADING COOKIES...");
    const res = await fetch("/api/uploadCookies", { method: "POST", body: fd });
    const j = await res.json();
    setMsg(j.error ? "UPLOAD FAILED: " + j.error : "COOKIES UPLOADED ✓");
  }

  async function fetchFormats() {
    setMsg(""); setFormats([]); setSelected(""); setVideoMetadata(null); setLoading(true);
    
    try {
      const res = await fetch("/api/getFormats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url })
      });
      const j = await res.json();
      setLoading(false);
      
      if (!res.ok) {
        setMsg("ERROR: " + (j.error || "FAILED"));
        return;
      }
      
      // Store video metadata
      if (j.metadata) {
        setVideoMetadata(j.metadata);
      }
      
      // Sort formats by filesize (descending) - largest first
      const sortedFormats = (j.formats || []).sort((a: any, b: any) => {
        const sizeA = a.filesize || 0;
        const sizeB = b.filesize || 0;
        return sizeB - sizeA;
      });
      
      setFormats(sortedFormats);
      
      // Auto-select the largest file as "best"
      if (sortedFormats.length > 0 && sortedFormats[0].filesize) {
        setSelected(sortedFormats[0].format_id);
        setMsg(`BEST QUALITY AUTO-SELECTED: ${sortedFormats[0].format_note || 'Highest'} (${Math.round(sortedFormats[0].filesize / 1024 / 1024)} MB)`);
      } else {
        setMsg("SELECT QUALITY BELOW");
      }
    } catch (err: any) {
      setLoading(false);
      setMsg("ERROR: " + err.message);
    }
  }

  // Format bytes to human readable
  function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  // Format seconds to readable time
  function formatTime(seconds: number): string {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  }

  // Build proper format string for video+audio merging
  function buildFormatString(formatObj: any): string {
    if (!formatObj) return "bestvideo+bestaudio/best";
    
    const isVideoOnly = formatObj.acodec === "none";
    const hasVideo = formatObj.vcodec && formatObj.vcodec !== "none";
    const hasAudio = formatObj.acodec && formatObj.acodec !== "none";

    // If format has both video and audio, use it directly
    if (hasVideo && hasAudio) {
      return formatObj.format_id;
    }

    // If video-only format, merge with best audio
    if (hasVideo && !hasAudio) {
      // Try specific format first, then fallback to best video+audio
      return `${formatObj.format_id}+bestaudio/bestvideo[height=${formatObj.height}]+bestaudio/bestvideo+bestaudio/best`;
    }

    // Fallback for any other case
    return "bestvideo+bestaudio/best";
  }

  async function streamDownload(
    url: string,
    onProgress: (bytes: number, total: number | null, speed: number, eta: number | null) => void,
    abortController: AbortController
  ) {
    // Find the selected format object and build proper format string
    const selectedFormatObj = formats.find(f => f.format_id === selected);
    const finalFormat = buildFormatString(selectedFormatObj);
    
    // Debug log
    console.log('Selected format:', selectedFormatObj);
    console.log('Final format string:', finalFormat);
    
    const res = await fetch("/api/download", {
      method: "POST",
      signal: abortController.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, format: finalFormat }),
    });

    if (!res.ok) {
      const t = await res.text();
      throw new Error(t || "Download failed");
    }

    const contentDisposition = res.headers.get("content-disposition") || "";
    const match = contentDisposition.match(/filename="(.+)"/);
    const filename = match ? match[1] : `video_${Date.now()}.mp4`;

    // Get total size if available
    const contentLength = res.headers.get("content-length");
    const totalBytes = contentLength ? parseInt(contentLength) : null;

    // Stream download with progress tracking
    const reader = res.body!.getReader();
    const chunks: BlobPart[] = [];
    let received = 0;
    let lastUpdate = Date.now();
    let lastReceived = 0;
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      chunks.push(value as BlobPart);
      received += value?.length || 0;
      
      // Calculate speed and ETA
      const now = Date.now();
      const timeDiff = (now - lastUpdate) / 1000;
      if (timeDiff >= 0.5) {
        const bytesDiff = received - lastReceived;
        const speed = bytesDiff / timeDiff;
        const remaining = totalBytes ? totalBytes - received : 0;
        const eta = speed > 0 && totalBytes ? remaining / speed : null;
        
        onProgress(received, totalBytes, speed, eta);
        lastUpdate = now;
        lastReceived = received;
      }
    }

    // Final progress update - 100%
    onProgress(received, received, 0, 0);
    
    // Create blob and trigger download
    const blob = new Blob(chunks, { type: "video/mp4" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    
    // Cleanup
    setTimeout(() => {
      link.remove();
      URL.revokeObjectURL(link.href);
    }, 100);
  }

  async function download() {
    if (!selected) return setMsg("SELECT FORMAT FIRST");
    
    setMsg("INITIALIZING DOWNLOAD...");
    setLoading(true);
    setProgress(0);
    setTotalSize(null);
    setDownloadSpeed(0);
    setEta(null);
    setStartTime(Date.now());

    const abortController = new AbortController();
    setAborter(abortController);

    try {
      await streamDownload(url, (bytes, total, speed, estimatedEta) => {
        setProgress(bytes);
        if (total && !totalSize) setTotalSize(total);
        setDownloadSpeed(speed);
        setEta(estimatedEta);
      }, abortController);

      const duration = Date.now() - (startTime || Date.now());
      setMsg(`DOWNLOAD COMPLETE ✓ (${formatTime(duration / 1000)})`);
    } catch (err: any) {
      if (err.name === "AbortError") {
        setMsg("DOWNLOAD CANCELLED");
      } else {
        setMsg("ERROR: " + err.message);
      }
    }

    setLoading(false);
    setAborter(null);
    setDownloadSpeed(0);
    setEta(null);
  }

  return (
    <div className="min-h-screen relative transition-colors duration-300" style={{ backgroundColor: colors.bg }}>
      {/* Dot Pattern Background */}
      <div 
        className="fixed inset-0 pointer-events-none transition-opacity duration-300"
        style={{
          backgroundImage: `radial-gradient(circle, ${colors.border} 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
          opacity: colors.dotOpacity
        }}
      />

      {/* NAVIGATION BAR */}
      <nav className="sticky top-0 z-50 border-b-3 px-4 sm:px-8 py-4 transition-colors duration-300" style={{ backgroundColor: colors.bg, borderColor: colors.border }}>
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-xl sm:text-2xl font-serif font-semibold tracking-tight" style={{ color: colors.text }}>
            YT Downloader
          </h1>
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Theme Toggle */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="border-2 px-3 sm:px-4 py-2 font-sans font-medium text-sm hover:translate-x-1 hover:translate-y-1 transition-transform"
              style={{ 
                borderColor: colors.border,
                backgroundColor: colors.surface,
                color: colors.text,
                boxShadow: `3px 3px 0 0 ${colors.border}`
              }}
            >
              {darkMode ? '☀' : '☾'}
            </button>
            
            <SignedOut>
              <SignInButton>
                <button 
                  className="border-2 px-4 sm:px-6 py-2 font-sans font-medium text-sm hover:translate-x-1 hover:translate-y-1 transition-transform"
                  style={{ 
                    borderColor: colors.border,
                    backgroundColor: colors.surface,
                    color: colors.text,
                    boxShadow: `4px 4px 0 0 ${colors.border}`
                  }}
                >
                  Sign In
                </button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <span className="hidden sm:inline text-sm font-sans px-3" style={{ color: colors.textSecondary }}>
                {user?.primaryEmailAddress?.emailAddress || user?.emailAddresses?.[0]?.emailAddress}
              </span>
              <SignOutButton>
                <button 
                  className="border-2 px-4 py-2 font-sans font-medium text-sm hover:translate-x-1 hover:translate-y-1 transition-transform"
                  style={{ 
                    borderColor: colors.border,
                    backgroundColor: colors.surface,
                    color: colors.text,
                    boxShadow: `3px 3px 0 0 ${colors.border}`
                  }}
                >
                  Logout
                </button>
              </SignOutButton>
            </SignedIn>
          </div>
        </div>
      </nav>

      <SignedOut>
        <div className="relative flex flex-col items-center justify-center min-h-[80vh] px-4">
          <div 
            className="border-3 p-16 text-center max-w-lg"
            style={{ 
              backgroundColor: colors.surface,
              borderColor: colors.border,
              boxShadow: `12px 12px 0 0 ${colors.border}`
            }}
          >
            <h2 className="text-4xl font-serif font-semibold mb-4" style={{ color: colors.text }}>
              Access Denied
            </h2>
            <p className="text-lg font-sans mb-8" style={{ color: colors.textSecondary }}>
              Please authenticate to continue
            </p>
            <SignInButton>
              <button 
                className="border-2 px-8 py-3 text-lg font-sans font-medium hover:translate-x-1 hover:translate-y-1 transition-transform"
                style={{ 
                  borderColor: colors.border,
                  backgroundColor: colors.buttonBg,
                  color: colors.buttonText,
                  boxShadow: `6px 6px 0 0 ${colors.border}`
                }}
              >
                Sign In →
              </button>
            </SignInButton>
          </div>
        </div>
      </SignedOut>

      <SignedIn>
        <main className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-12">
          {/* HEADER */}
          <div className="mb-8 sm:mb-12">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-semibold mb-3 leading-tight" style={{ color: colors.text }}>
              Video Downloader
            </h1>
            <p className="text-base sm:text-lg font-sans border-l-4 pl-4" style={{ color: colors.textSecondary, borderColor: colors.border }}>
              Extract, download, and archive video content
            </p>
          </div>

          {/* COOKIES UPLOAD */}
          <section 
            className="border-2 p-4 sm:p-6 lg:p-8 mb-6 sm:mb-8 hover:translate-x-1 hover:translate-y-1 transition-transform"
            style={{ 
              backgroundColor: colors.surface,
              borderColor: colors.border,
              boxShadow: `6px 6px 0 0 ${colors.border}`
            }}
          >
            <h2 className="text-xl sm:text-2xl font-serif font-semibold mb-3 pb-3 border-b-2" style={{ color: colors.text, borderColor: colors.border }}>
              01. Cookie Authentication (Optional)
            </h2>
            <p className="text-sm font-sans mb-4" style={{ color: colors.textSecondary }}>
              Only required for private, unlisted, or member-only videos. Public videos work without cookies.
            </p>
            <div className="space-y-4">
              <input
                type="file"
                accept=".txt"
                onChange={(e) => setCookieFile(e.target.files?.[0] ?? null)}
                className="w-full border-2 p-3 font-sans text-sm file:border-2 file:px-4 file:py-2 file:mr-4 file:font-medium file:cursor-pointer"
                style={{ 
                  borderColor: colors.border,
                  backgroundColor: colors.bg,
                  color: colors.text
                }}
              />
              <button
                onClick={uploadCookies}
                className="w-full border-2 px-6 py-3 font-sans font-medium hover:translate-x-1 hover:translate-y-1 transition-transform"
                style={{ 
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                  color: colors.text,
                  boxShadow: `4px 4px 0 0 ${colors.border}`
                }}
              >
                Upload cookies.txt →
              </button>
            </div>
          </section>

          {/* URL INPUT */}
          <section 
            className="border-2 p-4 sm:p-6 lg:p-8 mb-6 sm:mb-8 hover:translate-x-1 hover:translate-y-1 transition-transform"
            style={{ 
              backgroundColor: colors.surface,
              borderColor: colors.border,
              boxShadow: `6px 6px 0 0 ${colors.border}`
            }}
          >
            <h2 className="text-xl sm:text-2xl font-serif font-semibold mb-3 pb-3 border-b-2" style={{ color: colors.text, borderColor: colors.border }}>
              02. Video URL
            </h2>
            <div className="space-y-4">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=..."
                className="w-full border-2 p-4 font-sans text-base focus:outline-none focus:ring-4"
                style={{ 
                  borderColor: colors.border,
                  backgroundColor: colors.bg,
                  color: colors.text
                }}
              />
              <button
                onClick={fetchFormats}
                disabled={loading}
                className="w-full border-2 px-4 sm:px-6 py-3 sm:py-4 font-sans font-medium text-base sm:text-lg hover:translate-x-1 hover:translate-y-1 transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-x-0 disabled:hover:translate-y-0"
                style={{ 
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                  color: colors.text,
                  boxShadow: `4px 4px 0 0 ${colors.border}`
                }}
              >
                {loading ? "Processing..." : "Fetch Available Qualities →"}
              </button>
            </div>
          </section>

          {/* VIDEO METADATA */}
          {videoMetadata && (
            <section 
              className="border-2 p-4 sm:p-6 lg:p-8 mb-6 sm:mb-8 hover:translate-x-1 hover:translate-y-1 transition-transform"
              style={{ 
                backgroundColor: colors.surface,
                borderColor: colors.border,
                boxShadow: `6px 6px 0 0 ${colors.border}`
              }}
            >
              <h2 className="text-xl sm:text-2xl font-serif font-semibold mb-3 pb-3 border-b-2" style={{ color: colors.text, borderColor: colors.border }}>
                Video Information
              </h2>
              <div className="space-y-3">
                <div>
                  <span className="font-sans font-semibold text-sm" style={{ color: colors.textSecondary }}>Title:</span>
                  <p className="font-sans text-base mt-1" style={{ color: colors.text }}>{videoMetadata.title}</p>
                </div>
                <div className="flex gap-6">
                  <div>
                    <span className="font-sans font-semibold text-sm" style={{ color: colors.textSecondary }}>Uploader:</span>
                    <p className="font-sans text-base mt-1" style={{ color: colors.text }}>{videoMetadata.uploader}</p>
                  </div>
                  {videoMetadata.duration > 0 && (
                    <div>
                      <span className="font-sans font-semibold text-sm" style={{ color: colors.textSecondary }}>Duration:</span>
                      <p className="font-sans text-base mt-1" style={{ color: colors.text }}>{formatTime(videoMetadata.duration)}</p>
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* FORMATS SELECTION */}
          {formats.length > 0 && (
            <section 
              className="border-2 p-4 sm:p-6 lg:p-8 mb-6 sm:mb-8 hover:translate-x-1 hover:translate-y-1 transition-transform"
              style={{ 
                backgroundColor: colors.surface,
                borderColor: colors.border,
                boxShadow: `6px 6px 0 0 ${colors.border}`
              }}
            >
              <h2 className="text-xl sm:text-2xl font-serif font-semibold mb-3 pb-3 border-b-2" style={{ color: colors.text, borderColor: colors.border }}>
                03. Quality Selection
              </h2>
              
              {/* BEST QUALITY - HIGHLIGHTED */}
              <div 
                onClick={() => setSelected(formats[0]?.format_id)}
                className="border-3 p-4 mb-4 cursor-pointer transition-all"
                style={{ 
                  backgroundColor: selected === formats[0]?.format_id ? colors.buttonBg : colors.bg,
                  borderColor: colors.border,
                  boxShadow: selected === formats[0]?.format_id 
                    ? `6px 6px 0 0 ${colors.border}` 
                    : `3px 3px 0 0 ${colors.border}`,
                  transform: selected === formats[0]?.format_id ? 'translateX(2px) translateY(2px)' : 'none'
                }}
              >
                <label className="flex items-start cursor-pointer w-full">
                  <input
                    type="radio"
                    name="fmt"
                    value={formats[0]?.format_id}
                    checked={selected === formats[0]?.format_id}
                    onChange={() => setSelected(formats[0]?.format_id)}
                    className="mt-1 mr-4 w-5 h-5 shrink-0"
                    style={{ accentColor: colors.border }}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-sans font-bold text-base" style={{ color: selected === formats[0]?.format_id ? colors.buttonText : colors.text }}>
                        ⭐ Best Available (Largest File)
                      </span>
                    </div>
                    <span className="block text-sm font-sans" style={{ color: selected === formats[0]?.format_id ? colors.buttonText : colors.textSecondary }}>
                      {formats[0]?.format_note || 'Highest quality'} • {formats[0]?.height}p
                      {formats[0]?.filesize && ` • ${Math.round(formats[0].filesize / 1024 / 1024)} MB`}
                    </span>
                  </div>
                </label>
              </div>

              {/* AUTO-SELECTED INDICATOR */}
              {selected === formats[0]?.format_id && (
                <div 
                  className="border-2 p-3 mb-4"
                  style={{ 
                    backgroundColor: colors.buttonBg,
                    borderColor: colors.border,
                    color: colors.buttonText
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">✓</span>
                    <span className="font-sans font-semibold text-sm">
                      BEST QUALITY AUTO-SELECTED: {formats[0]?.format_note || 'Highest'} ({Math.round(formats[0]?.filesize / 1024 / 1024)} MB)
                    </span>
                  </div>
                </div>
              )}

              {/* FORMAT LIST */}
              <div className="space-y-2 mb-6">
                {formats.map((f, idx) => {
                  const isSelected = selected === f.format_id;
                  const isBest = idx === 0;
                  
                  return (
                    <div
                      key={f.format_id}
                      onClick={() => setSelected(f.format_id)}
                      className="border-2 p-4 cursor-pointer transition-all"
                      style={{ 
                        backgroundColor: isSelected ? colors.buttonBg : colors.bg,
                        borderColor: colors.border,
                        boxShadow: isSelected 
                          ? `5px 5px 0 0 ${colors.border}` 
                          : `2px 2px 0 0 ${colors.border}`,
                        transform: isSelected ? 'translateX(2px) translateY(2px)' : 'none',
                        opacity: isSelected ? 1 : 0.85
                      }}
                    >
                      <label className="flex items-start cursor-pointer w-full">
                        <input
                          type="radio"
                          name="fmt"
                          value={f.format_id}
                          checked={isSelected}
                          onChange={() => setSelected(f.format_id)}
                          className="mt-1 mr-4 w-5 h-5 shrink-0"
                          style={{ accentColor: colors.border }}
                        />
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-1">
                            <span className="font-sans font-medium text-xs" style={{ color: isSelected ? colors.buttonText : colors.textSecondary }}>
                              {String(idx + 1).padStart(2, '0')}
                            </span>
                            <span className="font-sans font-semibold text-sm sm:text-base" style={{ color: isSelected ? colors.buttonText : colors.text }}>
                              {isBest && '⭐ '}{f.format_note || f.ext?.toUpperCase()}
                            </span>
                            {f.height && (
                              <span className="border px-2 py-1 text-xs font-sans font-medium" style={{ 
                                borderColor: colors.border, 
                                backgroundColor: isSelected ? colors.buttonText : colors.surface, 
                                color: isSelected ? colors.buttonBg : colors.text 
                              }}>
                                {f.height}p
                              </span>
                            )}
                            {f.abr && (
                              <span className="border px-2 py-1 text-xs font-sans font-medium" style={{ 
                                borderColor: colors.border, 
                                backgroundColor: isSelected ? colors.buttonText : colors.surface, 
                                color: isSelected ? colors.buttonBg : colors.text 
                              }}>
                                {f.abr} kbps
                              </span>
                            )}
                            {f.filesize && (
                              <span className="border px-2 py-1 text-xs font-sans font-bold" style={{ 
                                borderColor: colors.border, 
                                backgroundColor: isSelected ? colors.buttonText : colors.surface, 
                                color: isSelected ? colors.buttonBg : colors.text 
                              }}>
                                📦 {Math.round(f.filesize / 1024 / 1024)} MB
                              </span>
                            )}
                            {f.acodec === 'none' && (
                              <span className="border px-2 py-1 text-xs font-sans font-medium" style={{ 
                                borderColor: colors.border, 
                                backgroundColor: isSelected ? colors.buttonText : colors.surface, 
                                color: isSelected ? colors.buttonBg : colors.text 
                              }}>
                                🔊 Audio will be merged
                              </span>
                            )}
                          </div>
                          {(f.vcodec !== 'none' || f.acodec !== 'none') && (
                            <div className="text-xs font-sans mt-1" style={{ color: isSelected ? colors.buttonText : colors.textSecondary }}>
                              {f.vcodec !== 'none' ? `Video: ${f.vcodec?.split('.')[0]}` : ''}
                              {f.vcodec !== 'none' && f.acodec !== 'none' ? ' • ' : ''}
                              {f.acodec !== 'none' ? `Audio: ${f.acodec?.split('.')[0]}` : ''}
                            </div>
                          )}
                        </div>
                      </label>
                    </div>
                  );
                })}
              </div>

              {/* DOWNLOAD BUTTON */}
              <button
                onClick={download}
                disabled={!selected || loading}
                className="w-full border-3 px-4 sm:px-6 py-3 sm:py-4 font-sans font-semibold text-lg sm:text-xl hover:translate-x-1 hover:translate-y-1 transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-x-0 disabled:hover:translate-y-0"
                style={{ 
                  borderColor: colors.border,
                  backgroundColor: colors.buttonBg,
                  color: colors.buttonText,
                  boxShadow: `6px 6px 0 0 ${colors.border}`
                }}
              >
                {loading ? "Downloading..." : "Download Selected Format →"}
              </button>

              {/* PROGRESS & CANCEL */}
              {loading && (
                <div 
                  className="mt-6 border-2 p-6"
                  style={{ 
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    boxShadow: `4px 4px 0 0 ${colors.border}`
                  }}
                >
                  <div className="mb-4 space-y-2">
                    <div className="flex justify-between items-center font-sans text-sm">
                      <span className="font-medium" style={{ color: colors.text }}>Transfer Progress</span>
                      <span className="font-semibold" style={{ color: colors.text }}>
                        {formatBytes(progress)}
                        {totalSize && ` / ${formatBytes(totalSize)}`}
                      </span>
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="w-full border-2 h-8 relative overflow-hidden" style={{ backgroundColor: colors.bg, borderColor: colors.border }}>
                      <div
                        className="h-full transition-all duration-300 flex items-center justify-center"
                        style={{ 
                          width: totalSize 
                            ? `${Math.min((progress / totalSize) * 100, 100)}%`
                            : '20%',
                          backgroundColor: colors.border
                        }}
                      >
                        {totalSize && (
                          <span className="text-xs font-sans font-bold" style={{ color: colors.buttonText }}>
                            {((progress / totalSize) * 100).toFixed(1)}%
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {/* Speed and ETA */}
                    <div className="flex justify-between items-center font-sans text-xs" style={{ color: colors.textSecondary }}>
                      <span>
                        Speed: <span className="font-semibold" style={{ color: colors.text }}>{formatBytes(downloadSpeed)}/s</span>
                      </span>
                      {eta !== null && (
                        <span>
                          ETA: <span className="font-semibold" style={{ color: colors.text }}>{formatTime(eta)}</span>
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <button
                    onClick={() => aborter?.abort()}
                    className="w-full border-2 px-6 py-3 font-sans font-medium hover:translate-x-1 hover:translate-y-1 transition-all"
                    style={{ 
                      borderColor: colors.border,
                      backgroundColor: colors.surface,
                      color: colors.text,
                      boxShadow: `4px 4px 0 0 ${colors.border}`
                    }}
                  >
                    Cancel Download ✕
                  </button>
                </div>
              )}
            </section>
          )}

          {/* STATUS MESSAGE */}
          {msg && (
            <div 
              className="border-2 p-6"
              style={{ 
                backgroundColor: colors.buttonBg,
                borderColor: colors.border,
                color: colors.buttonText,
                boxShadow: `6px 6px 0 0 ${colors.border}`
              }}
            >
              <div className="flex items-center gap-4">
                <span className="text-2xl">●</span>
                <span className="font-sans font-semibold text-base">{msg}</span>
              </div>
            </div>
          )}
        </main>

        {/* FOOTER */}
        <footer className="relative border-t-2 py-8 mt-16 text-center" style={{ borderColor: colors.border, backgroundColor: colors.bg }}>
          <p className="font-sans text-sm" style={{ color: colors.textSecondary }}>
            System Status: Operational • Build 2025.11 • Auth: Clerk
          </p>
        </footer>
      </SignedIn>
    </div>
  );
}