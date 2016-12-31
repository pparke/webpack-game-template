import Game from './lib/Game';
import { onHidden, createCanvas } from './lib/util';

const WIDTH = 500;
const HEIGHT = 400;

const canvas = createCanvas(WIDTH, HEIGHT);
document.getElementById('app').appendChild(canvas);

// setup the game object
const game = new Game({
  width: WIDTH,
  height: HEIGHT,
  tilesetImage: 'img/vase.png',
  ctx: canvas.getContext('2d')
});

/**
 * Game Events
 */
game.on('paused', () => {
  console.log('paused');
});

game.on('unpaused', () => {
  console.log('unpaused');
});

game.on('ready', () => {
  console.log('ready');
});

// setup behaviour for when the game window isn't visible
onHidden(() => game.emit('pause'), () => game.emit('unpause'));
