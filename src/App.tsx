/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Play, Info, LogIn, Loader2, Disc, Layers, Sparkles, Volume2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown';
import axios from 'axios';
import { createLLMProvider } from './lib/llm';
import { parseTrackCueHref } from './lib/spotifyCue';
import { buildPlayRequest, buildTransferRequest } from './lib/spotifyPlayback';
import { clampVolumePercent, toPlayerVolume } from './lib/volumeControl';

const llm = createLLMProvider();

interface SpotifyTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

interface ArtistInfo {
  id: string;
  name: string;
  images: { url: string }[];
  genres: string[];
}

interface Commentary {
  summary: string;
  keyTraits: {
    title: string;
    description: string;
    exampleTrack?: string;
  }[];
  deepDive: string;
}

interface SpotifyPlayerInstance {
  connect: () => Promise<boolean>;
  disconnect: () => void;
  activateElement: () => Promise<void>;
  setVolume: (volume: number) => Promise<void>;
  getVolume: () => Promise<number>;
  addListener: (event: string, callback: (...args: any[]) => void) => void;
}

interface SpotifySdkDeviceReadyEvent {
  device_id: string;
}

declare global {
  interface Window {
    Spotify?: {
      Player: new (options: {
        name: string;
        getOAuthToken: (callback: (token: string) => void) => void;
        volume?: number;
      }) => SpotifyPlayerInstance;
    };
    onSpotifyWebPlaybackSDKReady?: () => void;
  }
}

function normalizeDeepDiveMarkdown(value: unknown): string {
  if (typeof value !== 'string') return '';
  if (value.includes('\n')) return value;
  return value.replace(/\\n/g, '\n');
}

export default function App() {
  const DEFAULT_VOLUME_PERCENT = 80;
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [artist, setArtist] = useState<ArtistInfo | null>(null);
  const [commentary, setCommentary] = useState<Commentary | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [spotifyTokens, setSpotifyTokens] = useState<SpotifyTokens | null>(null);
  const [error, setError] = useState<string | null>(null);
  const autoSearchQueryRef = useRef<string | null>(null);

  const getSearchQueryFromUrl = useCallback(() => {
    const query = new URLSearchParams(window.location.search).get('q');
    return query?.trim() || '';
  }, []);

  const updateSearchQueryInUrl = useCallback((query: string) => {
    const params = new URLSearchParams(window.location.search);
    const trimmedQuery = query.trim();

    if (trimmedQuery) {
      params.set('q', trimmedQuery);
    } else {
      params.delete('q');
    }

    const nextSearch = params.toString();
    const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`;
    window.history.pushState(null, '', nextUrl);
  }, []);

  useEffect(() => {
    const initialQuery = getSearchQueryFromUrl();
    setSearchQuery(initialQuery);
    autoSearchQueryRef.current = initialQuery || null;
  }, [getSearchQueryFromUrl]);

  useEffect(() => {
    const handlePopState = () => {
      const queryFromUrl = getSearchQueryFromUrl();
      setSearchQuery(queryFromUrl);
      autoSearchQueryRef.current = queryFromUrl || null;
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [getSearchQueryFromUrl]);

  // Load tokens from localStorage
  useEffect(() => {
    const savedTokens = localStorage.getItem('spotify_tokens');
    if (savedTokens) {
      setSpotifyTokens(JSON.parse(savedTokens));
    }
  }, []);

  // Listen for OAuth success message
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SPOTIFY_AUTH_SUCCESS') {
        const tokens = event.data.tokens;
        setSpotifyTokens(tokens);
        localStorage.setItem('spotify_tokens', JSON.stringify(tokens));
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleSpotifyLogin = async () => {
    try {
      const response = await fetch('/api/auth/spotify/url');
      const { url } = await response.json();
      window.open(url, 'spotify_login', 'width=600,height=700');
    } catch (err) {
      setError('Spotifyログインの開始に失敗しました');
    }
  };

  const performArtistSearch = useCallback(
    async (query: string, options?: { updateUrl?: boolean }) => {
      const trimmedQuery = query.trim();
      if (!trimmedQuery || !spotifyTokens) return;

      if (options?.updateUrl !== false) {
        updateSearchQueryInUrl(trimmedQuery);
      }

      setIsSearching(true);
      setError(null);
      setArtist(null);
      setCommentary(null);

      try {
        const response = await axios.get(`https://api.spotify.com/v1/search`, {
          params: { q: trimmedQuery, type: 'artist', limit: 1 },
          headers: { Authorization: `Bearer ${spotifyTokens.access_token}` },
        });

        const artistData = response.data.artists.items[0];
        if (artistData) {
          setArtist(artistData);
          generateCommentary(artistData);
        } else {
          setError('アーティストが見つかりませんでした');
        }
      } catch (err: any) {
        if (err.response?.status === 401) {
          setError('Spotifyのセッションが切れました。再度ログインしてください。');
          setSpotifyTokens(null);
          localStorage.removeItem('spotify_tokens');
        } else {
          setError('アーティストの検索に失敗しました');
        }
      } finally {
        setIsSearching(false);
      }
    },
    [spotifyTokens, updateSearchQueryInUrl]
  );

  useEffect(() => {
    const queryFromUrl = autoSearchQueryRef.current;
    if (!queryFromUrl || !spotifyTokens) return;

    autoSearchQueryRef.current = null;
    void performArtistSearch(queryFromUrl, { updateUrl: false });
  }, [spotifyTokens, performArtistSearch]);

  const searchArtist = async (e: React.FormEvent) => {
    e.preventDefault();
    await performArtistSearch(searchQuery);
  };

  const [currentTrackName, setCurrentTrackName] = useState<string | null>(null);
  const [spotifyDeviceId, setSpotifyDeviceId] = useState<string | null>(null);
  const [isSdkReady, setIsSdkReady] = useState(false);
  const [volumePercent, setVolumePercent] = useState<number>(DEFAULT_VOLUME_PERCENT);
  const playerRef = useRef<SpotifyPlayerInstance | null>(null);
  const tokenRef = useRef<string>('');
  const stopPlaybackTimeoutRef = useRef<number | null>(null);

  const clearStopPlaybackTimeout = useCallback(() => {
    if (stopPlaybackTimeoutRef.current !== null) {
      window.clearTimeout(stopPlaybackTimeoutRef.current);
      stopPlaybackTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    tokenRef.current = spotifyTokens?.access_token ?? '';
  }, [spotifyTokens]);

  useEffect(() => {
    if (!spotifyTokens) {
      clearStopPlaybackTimeout();
      playerRef.current?.disconnect();
      playerRef.current = null;
      setSpotifyDeviceId(null);
      setIsSdkReady(false);
      return;
    }

    let cancelled = false;

    const initializePlayer = () => {
      if (cancelled || playerRef.current || !window.Spotify) return;

      const player = new window.Spotify.Player({
        name: 'Sonic Analyst Web Player',
        getOAuthToken: (callback) => callback(tokenRef.current),
        volume: toPlayerVolume(volumePercent),
      });

      player.addListener('ready', ({ device_id }: SpotifySdkDeviceReadyEvent) => {
        if (cancelled) return;
        setSpotifyDeviceId(device_id);
        setIsSdkReady(true);
      });

      player.addListener('not_ready', () => {
        if (cancelled) return;
        setIsSdkReady(false);
      });

      player.addListener('initialization_error', ({ message }: { message: string }) => {
        if (cancelled) return;
        setError(`Spotify SDK 初期化エラー: ${message}`);
      });

      player.addListener('authentication_error', ({ message }: { message: string }) => {
        if (cancelled) return;
        setError(`Spotify認証エラー: ${message}`);
      });

      player.addListener('account_error', () => {
        if (cancelled) return;
        setError('Spotify Premiumアカウントが必要です。');
      });

      player
        .connect()
        .then((connected) => {
          if (!connected && !cancelled) {
            setError('Spotifyプレイヤーへの接続に失敗しました');
          }
        })
        .catch(() => {
          if (!cancelled) {
            setError('Spotifyプレイヤーへの接続に失敗しました');
          }
        });

      playerRef.current = player;
    };

    if (window.Spotify) {
      initializePlayer();
    } else {
      const script = document.createElement('script');
      script.src = 'https://sdk.scdn.co/spotify-player.js';
      script.async = true;
      document.body.appendChild(script);
      window.onSpotifyWebPlaybackSDKReady = initializePlayer;
    }

    return () => {
      cancelled = true;
      window.onSpotifyWebPlaybackSDKReady = undefined;
    };
  }, [spotifyTokens, clearStopPlaybackTimeout]);

  useEffect(() => {
    return () => {
      clearStopPlaybackTimeout();
    };
  }, [clearStopPlaybackTimeout]);

  useEffect(() => {
    if (!isSdkReady || !playerRef.current) return;

    playerRef.current
      .getVolume()
      .then((volume) => {
        setVolumePercent(clampVolumePercent(volume * 100));
      })
      .catch(() => undefined);
  }, [isSdkReady]);

  const handleVolumeChange = async (nextValue: number) => {
    const nextPercent = clampVolumePercent(nextValue);
    setVolumePercent(nextPercent);

    if (!playerRef.current) {
      return;
    }

    try {
      await playerRef.current.setVolume(toPlayerVolume(nextPercent));
    } catch {
      setError('音量の変更に失敗しました');
    }
  };

  const playTrack = async (trackName: string, startSeconds?: number, durationSeconds?: number) => {
    if (!spotifyTokens || !artist || !spotifyDeviceId || !playerRef.current) {
      setError('Spotifyプレイヤーの準備中です。数秒後にもう一度お試しください。');
      return;
    }

    clearStopPlaybackTimeout();

    try {
      // Must run in direct response to the click to satisfy autoplay policy.
      await playerRef.current.activateElement();

      const headers = { Authorization: `Bearer ${spotifyTokens.access_token}` };
      const artistScopedResponse = await axios.get(`https://api.spotify.com/v1/search`, {
        params: { q: `track:${trackName} artist:${artist.name}`, type: 'track', limit: 1 },
        headers,
      });

      let track = artistScopedResponse.data.tracks.items[0];
      if (!track) {
        const fallbackResponse = await axios.get(`https://api.spotify.com/v1/search`, {
          params: { q: `track:${trackName}`, type: 'track', limit: 1 },
          headers,
        });
        track = fallbackResponse.data.tracks.items[0];
      }
      if (!track) {
        setError('曲が見つかりませんでした');
        return;
      }

      await axios.put(
        'https://api.spotify.com/v1/me/player',
        buildTransferRequest(spotifyDeviceId),
        {
          headers,
        }
      );

      await axios.put(
        'https://api.spotify.com/v1/me/player/play',
        buildPlayRequest(track.uri, startSeconds),
        {
          params: { device_id: spotifyDeviceId },
          headers,
        }
      );

      setCurrentTrackName(track.name);

      if (durationSeconds && durationSeconds > 0) {
        stopPlaybackTimeoutRef.current = window.setTimeout(() => {
          void axios
            .put(
              'https://api.spotify.com/v1/me/player/pause',
              {},
              {
                params: { device_id: spotifyDeviceId },
                headers,
              }
            )
            .catch(() => undefined);
          stopPlaybackTimeoutRef.current = null;
        }, durationSeconds * 1000);
      }
    } catch (err: any) {
      if (err.response?.status === 403) {
        setError('Spotify Premiumアカウントが必要です。');
        return;
      }
      setError('再生に失敗しました。Spotifyアプリが再生可能か確認してください。');
    }
  };

  const generateCommentary = async (artistData: ArtistInfo) => {
    setIsAnalyzing(true);
    setCurrentTrackName(null);
    try {
      const prompt = `
        You are a world-class music analyst and YouTuber known for deep dives into musicality.
        Analyze the artist "${artistData.name}" (Genres: ${(artistData.genres || []).join(', ')}).
        
        Provide a structured analysis in Japanese.
        
        Provide a structured analysis in JSON format:
        {
          "summary": "A brief, punchy editorial summary of their musical impact in Japanese.",
          "keyTraits": [
            {
              "title": "Name of a specific musical trait in Japanese (e.g., '幽玄なリバーブ', 'ポリリズムの基礎')",
              "description": "Explanation of how this sound is achieved and why it's important in Japanese.",
              "exampleTrack": "A specific track name that exemplifies this trait."
            }
          ],
          "deepDive": "A longer markdown-formatted explanation of their evolution and technical mastery in Japanese.
          For references to musicality details, wrap the exact phrase the listener should focus on in this link format:
          [phrase in Japanese](cue:Track%20Name?t=MM:SS)
          Example: [ハイハットの跳ね返り](cue:Track%20Name?t=01:15&d=10)
          IMPORTANT: URL-encode track names (spaces must be %20) so markdown links stay clickable.
          Use 2-4 cue links in total. Keep all cue times realistic and track names specific."
        }
        
        Focus on the "actual sound" - what should the listener listen for? Be specific about instruments, production techniques, and vocal styles.
      `;

      const text = await llm.generateText(prompt, { jsonMode: true });

      const data = JSON.parse(text || '{}');
      setCommentary({
        ...data,
        deepDive: normalizeDeepDiveMarkdown(data.deepDive),
      });
    } catch (err) {
      console.error(err);
      setError('AI解説の生成に失敗しました');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-orange-500 selection:text-black">
      {/* Navigation / Header */}
      <header className="fixed top-0 left-0 right-0 z-50 px-6 py-4 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center">
            <Disc className="w-5 h-5 text-black animate-spin-slow" />
          </div>
          <span className="font-bold tracking-tighter text-xl uppercase">Sonic Analyst</span>
          <div className="flex items-center gap-2 px-3 py-2 rounded-full border border-orange-500/40 bg-black/70">
            <Volume2 className="w-4 h-4 text-orange-400" />
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={volumePercent}
              onChange={(e) => void handleVolumeChange(Number(e.target.value))}
              disabled={!spotifyTokens || !isSdkReady}
              className="w-20 md:w-28 accent-orange-500 disabled:opacity-40"
              aria-label="Playback volume"
            />
            <span className="text-[10px] font-bold tracking-widest text-orange-300 w-8 text-right">
              {volumePercent}
            </span>
          </div>
        </div>
        
        {!spotifyTokens ? (
          <button 
            onClick={handleSpotifyLogin}
            className="flex items-center gap-2 px-4 py-2 bg-green-500 text-black rounded-full font-bold text-sm hover:scale-105 transition-transform"
          >
            <LogIn className="w-4 h-4" />
            Spotifyと連携
          </button>
        ) : (
          <div className="flex items-center gap-4">
            <form onSubmit={searchArtist} className="relative group">
              <input 
                type="text" 
                placeholder="アーティストを検索..." 
                value={searchQuery}
                onChange={(e) => {
                  autoSearchQueryRef.current = null;
                  setSearchQuery(e.target.value);
                }}
                className="bg-white/10 border border-white/20 rounded-full py-2 px-4 pl-10 focus:outline-none focus:ring-2 focus:ring-orange-500 w-48 md:w-64 transition-all group-hover:w-80"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
            </form>
          </div>
        )}
      </header>

      <main className="pt-24 pb-12 px-6 max-w-7xl mx-auto">
        <AnimatePresence mode="wait">
          {!artist ? (
            <motion.div 
              key="landing"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center justify-center min-h-[70vh] text-center"
            >
              <h1 className="text-6xl md:text-8xl font-black tracking-tighter mb-6 uppercase leading-none">
                音を、<br />
                <span className="text-orange-500">理解する。</span>
              </h1>
              <p className="text-xl text-white/60 max-w-2xl mb-12">
                お気に入りのアーティストの背後にある技術的な熟練度を解説する、AI搭載の音楽アナライザー。
                Spotifyと同期して、解説されている「その音」を実際に体験しましょう。
              </p>
              
              {!spotifyTokens && (
                <button 
                  onClick={handleSpotifyLogin}
                  className="px-8 py-4 bg-orange-500 text-black rounded-full font-black text-lg hover:scale-110 transition-transform shadow-[0_0_30px_rgba(249,115,22,0.3)]"
                >
                  Spotifyで始める
                </button>
              )}
            </motion.div>
          ) : (
            <motion.div 
              key="artist-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-12"
            >
              {/* Left Column: Artist Info & Summary */}
              <div className="lg:col-span-5 space-y-8">
                <div className="relative aspect-square rounded-2xl overflow-hidden group">
                  <img 
                    src={artist.images[0]?.url} 
                    alt={artist.name}
                    className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
                  <div className="absolute bottom-6 left-6">
                    <h2 className="text-5xl font-black uppercase tracking-tighter leading-none">{artist.name}</h2>
                    <div className="flex gap-2 mt-2">
                      {(artist.genres || []).slice(0, 3).map(genre => (
                        <span key={genre} className="text-[10px] uppercase tracking-widest bg-white/20 px-2 py-1 rounded-full backdrop-blur-md">
                          {genre}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {isAnalyzing ? (
                  <div className="flex flex-col items-center justify-center p-12 bg-white/5 rounded-2xl border border-white/10">
                    <Loader2 className="w-8 h-8 text-orange-500 animate-spin mb-4" />
                    <p className="text-sm uppercase tracking-widest text-white/50">音楽性を分析中...</p>
                  </div>
                ) : commentary && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                  >
                    <div className="p-6 bg-white/5 rounded-2xl border border-white/10 relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Layers className="w-24 h-24" />
                      </div>
                      <h3 className="text-xs uppercase tracking-[0.3em] text-orange-500 font-bold mb-4">エディトリアル・サマリー</h3>
                      <p className="text-xl font-medium leading-relaxed italic text-white/90">
                        "{commentary.summary}"
                      </p>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-xs uppercase tracking-[0.3em] text-white/40 font-bold">サウンドの特徴</h3>
                      {commentary.keyTraits.map((trait, i) => (
                        <div 
                          key={i} 
                          className="p-4 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 transition-colors group/trait"
                        >
                          <h4 className="font-bold text-lg flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-orange-500" />
                            {trait.title}
                          </h4>
                          <p className="text-sm text-white/60 mt-1 leading-relaxed">{trait.description}</p>
                          {trait.exampleTrack && (
                            <button 
                              onClick={() => playTrack(trait.exampleTrack!)}
                              className="mt-3 flex items-center gap-2 text-[10px] uppercase tracking-widest text-orange-500 font-bold hover:underline"
                            >
                              <Play className="w-3 h-3 fill-orange-500" />
                              例: {trait.exampleTrack}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Right Column: Deep Dive & Player */}
              <div className="lg:col-span-7 space-y-8">
                {commentary && !isAnalyzing && (
                  <motion.div 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="prose prose-invert max-w-none"
                  >
                    <div className="p-8 bg-white/5 rounded-3xl border border-white/10 backdrop-blur-xl relative">
                      <div className="absolute -top-4 -left-4 w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center text-black font-black italic text-xl">
                        ?
                      </div>
                      <h3 className="text-2xl font-black uppercase tracking-tighter mb-6">ディープ・ダイブ</h3>
                      <div className="text-white/80 leading-relaxed text-lg space-y-4">
                        <ReactMarkdown
                          urlTransform={(url) => {
                            if (url.startsWith('cue:') || url.startsWith('track:')) {
                              return url;
                            }
                            return defaultUrlTransform(url);
                          }}
                          components={{
                            a: ({ node, ...props }) => {
                              const cue = props.href ? parseTrackCueHref(props.href) : null;
                              if (cue) {
                                return (
                                  <button 
                                    onClick={() => playTrack(cue.trackName, cue.startSeconds, cue.durationSeconds)}
                                    className="text-orange-500 font-bold hover:underline inline-flex items-center gap-1"
                                  >
                                    <Play className="w-3 h-3 fill-orange-500" />
                                    {props.children}
                                  </button>
                                );
                              }
                              return <a {...props} />;
                            }
                          }}
                        >
                          {commentary.deepDive}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </motion.div>
                )}

                <div className="space-y-4" id="spotify-player">
                  <h3 className="text-xs uppercase tracking-[0.3em] text-white/40 font-bold">聴いて、確かめる</h3>
                  <div className="rounded-3xl overflow-hidden border border-white/10 bg-black/60 shadow-2xl p-6 space-y-3">
                    <p className="text-sm text-white/70">
                      Web Playback SDK: {isSdkReady ? '接続済み' : '接続中'}
                    </p>
                    <p className="text-xs uppercase tracking-[0.2em] text-white/40">
                      Device ID: {spotifyDeviceId ?? '準備中'}
                    </p>
                    <p className="text-base text-white/90">
                      {currentTrackName ? `再生中: ${currentTrackName}` : 'リンクをクリックするとこのブラウザで即再生します'}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Error Toast */}
      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 bg-red-500 text-white rounded-full font-bold shadow-2xl z-[100] flex items-center gap-3"
          >
            <Info className="w-5 h-5" />
            {error}
            <button onClick={() => setError(null)} className="ml-2 hover:opacity-50">×</button>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 8s linear infinite;
        }
      `}</style>
    </div>
  );
}
