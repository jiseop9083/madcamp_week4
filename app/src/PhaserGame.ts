import { GameScene } from "./Page/Game";


const MAP_WIDTH = 1000;
const MAP_HEIGHT = 600;

let phaserGame: Phaser.Game;

// game config
const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    backgroundColor: '#b6d53c',
    parent: 'gameContainer',
    physics: { default: "arcade" },
    pixelArt: true,
    scene: [ GameScene ],
};

// instantiate the game
//const game = new Phaser.Game(config);

export const getScene =  () => {
  return config.scene[0]
}

export function createGame() {

  try{
    phaserGame = new Phaser.Game(config)
    ;(window as any).game = phaserGame
   
  } catch(e){
    throw new Error('Function not implemented.');
  }
}

export function pauseGame() {
  if (phaserGame) {
    phaserGame.scene.pause('GameScene');
  } else {
    throw new Error('Game instance not defined.');
  }
}

export function resumeGame() {
  if (phaserGame) {
    phaserGame.scene.resume('GameScene');
  } else {
    throw new Error('Game instance not defined.');
  }
}



export default phaserGame;