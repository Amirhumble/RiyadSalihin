// One shared expo-audio player for the whole app.
// Screens talk to AudioContext; AudioContext talks to this service.

import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

let _player = null;

export function getPlayer() {
  if (!_player) {
    _player = createAudioPlayer(null);
  }
  return _player;
}

export async function configureAudioSession() {
  try {
    await setAudioModeAsync({ playsInSilentMode: true });
  } catch (err) {
    console.warn('[AudioService] configureAudioSession failed:', err);
  }
}

export function loadSource(source) {
  const player = getPlayer();
  try {
    player.replace(source);
  } catch (err) {
    console.error('[AudioService] loadSource failed:', err);
    throw err;
  }
}

export function play() {
  getPlayer().play();
}

export function pause() {
  getPlayer().pause();
}

export async function seekTo(seconds) {
  await getPlayer().seekTo(seconds);
}

export async function stop() {
  const p = getPlayer();
  p.pause();
  await p.seekTo(0);
}

export function setRate(rate) {
  // 'medium' pitch correction keeps speech natural at higher speeds
  getPlayer().setPlaybackRate(rate, 'medium');
}
