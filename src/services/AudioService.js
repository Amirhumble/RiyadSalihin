/**
 * AudioService — singleton expo-audio player wrapper.
 *
 * Owns one shared AudioPlayer for the entire app lifetime.
 * Navigation between screens never creates a second player.
 * All UI interacts through AudioContext, never directly here.
 *
 * expo-audio API (v57):
 *   player.play()                          start / resume
 *   player.pause()                         pause
 *   player.replace(source)                 swap source, keeps player alive
 *   player.seekTo(seconds)                 seek
 *   player.setPlaybackRate(rate, quality)  change playback speed
 *   player.playbackRate                    current rate (read)
 *   player.currentTime                     seconds (read)
 *   player.duration                        seconds (read)
 *   player.playing                         boolean (read)
 *   player.isBuffering                     boolean (read)
 *   player.isLoaded                        boolean (read)
 */

import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

let _player = null;

/** Returns the shared player, creating it on first call. */
export function getPlayer() {
  if (!_player) {
    _player = createAudioPlayer(null);
  }
  return _player;
}

/** Configure audio session — call once at app start. */
export async function configureAudioSession() {
  try {
    await setAudioModeAsync({ playsInSilentMode: true });
  } catch (err) {
    console.warn('[AudioService] configureAudioSession failed:', err);
  }
}

/**
 * Load a new source into the shared player.
 * Uses player.replace() to swap without destroying the player instance.
 */
export function loadSource(source) {
  const player = getPlayer();
  try {
    player.replace(source);
  } catch (err) {
    console.error('[AudioService] loadSource failed:', err);
    throw err;
  }
}

export function play()  { getPlayer().play();  }
export function pause() { getPlayer().pause(); }

export async function seekTo(seconds) {
  await getPlayer().seekTo(seconds);
}

export async function stop() {
  const p = getPlayer();
  p.pause();
  await p.seekTo(0);
}

/**
 * Set playback rate with automatic pitch correction.
 * @param {number} rate  0.75 | 1 | 1.25 | 1.5 | 1.75 | 2
 */
export function setRate(rate) {
  // 'medium' pitch correction preserves speech quality at higher rates.
  getPlayer().setPlaybackRate(rate, 'medium');
}
