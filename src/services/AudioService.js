/**
 * AudioService — low-level wrapper around expo-audio's createAudioPlayer.
 *
 * This module is intentionally NOT a React hook.  It manages a single
 * shared AudioPlayer instance that lives in AudioContext and persists
 * across screen navigation.  UI components interact with it only through
 * AudioContext / useAudio hook, never directly.
 *
 * expo-audio reference:
 *   player.play()           – start / resume
 *   player.pause()          – pause
 *   player.seekTo(seconds)  – seek
 *   player.replace(source)  – swap source without creating a new player
 *   player.currentTime      – seconds (read)
 *   player.duration         – seconds (read)
 *   player.isLoaded         – boolean
 *   player.isBuffering      – boolean
 *   player.playing          – boolean
 */

import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

// One player for the entire application lifetime.
let _player = null;

/**
 * Returns the shared AudioPlayer, creating it if necessary.
 * The player starts with no source — call loadSource() to set one.
 *
 * @returns {import('expo-audio').AudioPlayer}
 */
export function getPlayer() {
  if (!_player) {
    _player = createAudioPlayer(null);
  }
  return _player;
}

/**
 * Configures the audio session for foreground playback.
 * Call once during app initialisation.
 */
export async function configureAudioSession() {
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      // Background audio and lock-screen controls are out-of-scope
      // for the first release.  Set shouldPlayInBackground = false
      // (the default) intentionally.
    });
  } catch (err) {
    console.warn('[AudioService] configureAudioSession failed:', err);
  }
}

/**
 * Loads a new audio source into the shared player.
 * Stops the current playback first.
 *
 * @param {number|string|object} source  – A require() asset or URI string.
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

/** Play or resume. */
export function play() {
  getPlayer().play();
}

/** Pause. */
export function pause() {
  getPlayer().pause();
}

/**
 * Seek to a position.
 * @param {number} seconds
 */
export async function seekTo(seconds) {
  await getPlayer().seekTo(seconds);
}

/**
 * Stop and reset to the beginning without unloading.
 */
export async function stop() {
  const player = getPlayer();
  player.pause();
  await player.seekTo(0);
}
