import { Scene } from "phaser";
import { Client, Room } from "colyseus.js";

import { createCharacterAnims } from "./anims/CharacterAnims";
import { Player } from "./characters/Player";
import { PlayerState } from "./types/PlayerState";
import { startVideoConference } from "./video/WebRTC";
import { TagManager } from "./util/TagManager";
const dotenv = require('dotenv');
dotenv.config();

const HTTP_SERVER_URI = process.env.MOCK_HTTP_SERVER_URI;
const SERVER_URI = process.env.MOCK_SERVER_URI;
let game: Phaser.Game;

declare var currentIndex: number;

// custom scene class
export class GameScene extends Scene {
  constructor() {
    super({ key: 'GameScene' }); // 여기서 'GameScene'이 키(key)입니다.
  }


  playerGroup: Phaser.Physics.Arcade.Group;
  preload() {
    console.log("ddd");
    // DOTO: merge spritesheet with similar thing to reduce loading time

    this.load.image('santa', `${HTTP_SERVER_URI}/image/player-mountainUp.png`);
    this.load.image('tiles', `${HTTP_SERVER_URI}/image/tiles-tile_map.png`);
    this.load.spritesheet('avatar_idle', `${HTTP_SERVER_URI}/image/player-character${currentIndex + 1}_idle.png`, { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet('avatar_front', `${HTTP_SERVER_URI}/image/player-character1_front.png`, { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet('avatar_back', `${HTTP_SERVER_URI}/image/player-character1_back.png`, { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet('avatar_right', `${HTTP_SERVER_URI}/image/player-character1_right.png`, { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet('avatar_left', `${HTTP_SERVER_URI}/image/player-character1_left.png`, { frameWidth: 32, frameHeight: 32 });
    this.load.tilemapTiledJSON('classroom', `${HTTP_SERVER_URI}/json/tiles-classroom.json`);
    this.cursorKeys = this.input.keyboard.createCursorKeys();
    
  }

  client = new Client(`${SERVER_URI}`);

  // process.env.SERVER_URI
  room: Room;

  playerEntities: {[sessionId: string]: any} = {};
  
  inputPayload = {
      left: false,
      right: false,
      up: false,
      down: false,
  };

  currentPlayer: Player
  // currentPlayer: Phaser.Types.Physics.Arcade.ImageWithDynamicBody;
  remoteRef: Phaser.GameObjects.Rectangle;

  cursorKeys: Phaser.Types.Input.Keyboard.CursorKeys;
  chatText: Phaser.GameObjects.Text;

  videoButton: Phaser.GameObjects.Text;

  

  async create() {
    console.log("Joining room...");

    try {
      this.room = await this.client.joinOrCreate("my_room");

      createCharacterAnims(this.anims);

      this.input.keyboard.on('keydown-ENTER', () => {
        const message = prompt("Enter your message:");
        if (message) {
          // Send chat message to the server with the player's position
          this.room.send("chat", {"chat": {
            message,
            position: { x: this.currentPlayer.x, y: this.currentPlayer.y }
          }});
        }
      });

      const map = this.make.tilemap({ key: 'classroom' });
      const tileset = map.addTilesetImage('tile_map', 'tiles');
      const backgroundLayer = map.createLayer("background", tileset, 0,0);
      const groundLayer = map.createLayer("ground", tileset, 0,0);
     
      // groundLayer.setCollisionBetween(0, 4);
      // this.physics.world.enable(groundLayer);
      this.chatText = this.add.text(0, 0, '', {
        fontSize: '16px',
        color: '#ffffff',
      });

      this.videoButton = this.add.text(10, 80, 'Start Video', {
        fontSize: '16px',
        color: '#000000',
        backgroundColor: '#3498db',
        padding: { x: 10, y: 5 },
      });

      this.videoButton.setInteractive();
      this.videoButton.on('pointerdown', () => {
        startVideoConference(this, this.currentPlayer);
      });


      // 맵의 크기를 이미지의 크기로 조절
      this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    
      


      // Handle incoming chat messages from the server
      this.room.onMessage("chat", (messageData) => {
        const { playerId, message, position } = messageData;
    
        // Check if the player is nearby before displaying the message
        const distance = Phaser.Math.Distance.Between(
          this.currentPlayer.x,
          this.currentPlayer.y,
          position.x,
          position.y
        );
        if (distance < 100) {
          this.chatText.setText(this.chatText.text +  `Player ${playerId}: ${message}\n`);
          // Scroll to the bottom if there is a scroll
          this.chatText.setScrollFactor(0, 0);
        }
      });

      this.playerGroup = this.physics.add.group();
      this.physics.world.enable(this.playerGroup);

      this.physics.add.collider(this.playerGroup, this.playerGroup, (player1 : Player, player2 : Player) => {
        const overlapX = player1.x - player2.x;
        const overlapY = player1.y - player2.y;
    
        // 겹침을 방지하기 위한 이동값 설정
        const moveDistance = 0.1;
    
        if (overlapX > 0) {
            player1.x += moveDistance;
        } else {
            player1.x -= moveDistance;
        }
    
        if (overlapY > 0) {
            player1.y += moveDistance;
        } else {
            player1.y -= moveDistance;
        }
    });
    
      this.room.state.players.onAdd((player, sessionId) => {
        const entity = new Player(this, player.x, player.y, 'avatar', sessionId, 1);
        this.playerGroup.add(entity);
        this.playerEntities[sessionId] = entity;
        entity.setCollideWorldBounds(true);

        if (sessionId === this.room.sessionId) {
          this.currentPlayer = entity;
          // this is being used for debug only
          entity.debugMode(true);

          player.onChange(() => {
              this.remoteRef.x = player.x;
              this.remoteRef.y = player.y;
              entity.setData('serverX', player.x);
              entity.setData('serverY', player.y);
          });
        } else {
            // all remote players are here!
            // (same as before, we are going to interpolate remote players)
           
            player.onChange(() => {
                entity.setData('serverX', player.x);
                entity.setData('serverY', player.y)
            });
        }

      });
      
    } catch (e) {
      console.error(e);
    }
  }
  

 

  onLeave(player){
      this.room.state.players.onRemove((player, sessionId) => {
          const entity = this.playerEntities[sessionId];
          if (entity) {
              // destroy entity
              entity.destroy();
      
              // clear local reference
              delete this.playerEntities[sessionId];
          }
      });
  }

 

  elapsedTime = 0;
  fixedTimeStep = 1000 / 60;

  // game loop
  update(time: number, delta: number): void {
    // skip loop if not connected with room yet.
    if (!this.currentPlayer) { return; }

    this.elapsedTime += delta;
    while (this.elapsedTime >= this.fixedTimeStep) {
        this.elapsedTime -= this.fixedTimeStep;
        this.fixedTick(time, this.fixedTimeStep);

        this.physics.world.collide(this.playerGroup);
    }
  }

  fixedTick(time, timeStep) {
    //
    // paste the previous `update()` implementation here!
    // skip loop if not connected with room yet.
    if (!this.room) { return; }
    // send input to the server
    const velocity = 2;
    this.inputPayload.left = this.cursorKeys.left.isDown;
    this.inputPayload.right = this.cursorKeys.right.isDown;
    this.inputPayload.up = this.cursorKeys.up.isDown;
    this.inputPayload.down = this.cursorKeys.down.isDown;
    let isTap = false;
    if (this.inputPayload.left) {
      this.currentPlayer.changeAnims(PlayerState.LEFT);
      this.currentPlayer.x -= velocity;
      isTap = true;
    } else if (this.inputPayload.right) {
      this.currentPlayer.changeAnims(PlayerState.RIGHT);
        this.currentPlayer.x += velocity;
        isTap = true;
    }
    if (this.inputPayload.up) {
        this.currentPlayer.changeAnims(PlayerState.UP);
        this.currentPlayer.y -= velocity;
        isTap = true;
    } else if (this.inputPayload.down) {
        this.currentPlayer.changeAnims(PlayerState.DOWN);
        this.currentPlayer.y += velocity;
        isTap = true;
    }
    if(!isTap)
      this.currentPlayer.changeAnims(PlayerState.IDLE);
    // type, data
    // TODO: 0 -> input
    this.room.send("input", {
      "input": this.inputPayload
    });
    for (let sessionId in this.playerEntities) {
      // do not interpolate the current player
      if (sessionId === this.room.sessionId) {
        continue;
      }
      // interpolate all player entities
      const entity = this.playerEntities[sessionId];
      const { serverX, serverY } = entity.data.values;
      const dx = serverX - entity.x;
      const dy = serverY - entity.y;
      console.log(dx, dy);
      if(dx > 0){
        entity.changeAnims(PlayerState.RIGHT);
      } else if(dx < 0){
        entity.changeAnims(PlayerState.LEFT);
      } else if(dy > 0){
        entity.changeAnims(PlayerState.DOWN);
      } else if(dy < 0){
        entity.changeAnims(PlayerState.UP);
      } else{
        entity.changeAnims(PlayerState.IDLE);
      }
      entity.x = Phaser.Math.Linear(entity.x, serverX, 0.8);
      entity.y = Phaser.Math.Linear(entity.y, serverY, 0.8);
    }
    //
  }
}

// game config
const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: 576,
    height: 640,
    backgroundColor: '#b6d53c',
    parent: 'phaser-example',
    physics: { default: "arcade" },
    pixelArt: true,
    scene: [ GameScene ],
};

// instantiate the game
//const game = new Phaser.Game(config);


export function createGame() {
  try{
    game = new Phaser.Game(config);
  } catch(e){
    throw new Error('Function not implemented.');
  }
}

export function pauseGame() {
  if (game) {
    game.scene.pause('GameScene');
  } else {
    throw new Error('Game instance not defined.');
  }
}

export function resumeGame() {
  if (game) {
    game.scene.resume('GameScene');
  } else {
    throw new Error('Game instance not defined.');
  }
}
