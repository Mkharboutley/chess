export class AudioManager {
  constructor() {
    this.sounds = {
      move: new Audio('https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/move-self.mp3'),
      capture: new Audio('https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/capture.mp3'),
      check: new Audio('https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/move-check.mp3'),
      castle: new Audio('https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/castle.mp3'),
      promote: new Audio('https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/promote.mp3'),
      gameStart: new Audio('https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/game-start.mp3'),
    };

    // Preload sounds for better performance
    for (const key in this.sounds) {
      this.sounds[key].preload = 'auto';
    }
  }

  playSound(soundName) {
    const sound = this.sounds[soundName];
    if (sound) {
      sound.currentTime = 0; // Rewind to start
      // User interaction is required to play audio, so we catch potential errors
      sound.play().catch(e => { 
        // This error is common if the user hasn't interacted with the page yet.
        // We can safely ignore it.
      });
    }
  }
}