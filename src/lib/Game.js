import mousetrap from './mousetrap';
import Atlas from './Atlas';
import EventEmitter from 'events';
import Audio from './Audio';

export default class Game extends EventEmitter {
  constructor({ width, height, ctx, tilesetImage } = {}) {
    super();

    this.width = width;
    this.height = height;
    this.ctx = ctx;

    // keys
    this.leftDown = false;
    this.rightDown = false;
    this.upDown = false;
    this.downDown = false;
    this.setupControls();


    this.time = 0;
    this.fps = 30;
    this.paused = false;

    this.sound = new Audio();

    this.imagesLoaded = false;
    this.tileatlas = new Atlas();
    this.tileatlas.loadImage(tilesetImage)
    .then(() => this.loadImages())
    .then(() => this.imagesLoaded = true)
    .then(() => this.emit('loading:complete'))
    .catch((err) => {
      console.log('Error loading image', tilesetImage);
      console.log(err);
    });

    this.vase = {
      x: (width/2) - 16,
      y: (height/2) - 16,
      tileset: this.tileatlas,
      key: 'vase'
    };

    // listen for events
    this.on('togglePause', this.togglePause.bind(this));
    this.on('pause', this.pause.bind(this));
    this.on('unpause', this.unpause.bind(this));
    this.on('loading:complete', this.tick);

    this.emit('init:complete');
  }

  setupControls() {
    mousetrap.bind('left', () => { this.leftDown = true; this.rightDown = false; }, 'keydown');
    mousetrap.bind('left', () => { this.leftDown = false }, 'keyup');
    mousetrap.bind('right', () => { this.rightDown = true; this.leftDown = false; }, 'keydown');
    mousetrap.bind('right', () => { this.rightDown = false }, 'keyup');
    mousetrap.bind('up', () => { this.upDown = true; this.downDown = false; }, 'keydown');
    mousetrap.bind('up', () => { this.upDown = false }, 'keyup');
    mousetrap.bind('down', () => { this.downDown = true; this.upDown = false; }, 'keydown');
    mousetrap.bind('down', () => { this.downDown = false }, 'keyup');
    mousetrap.bind('p', this.togglePause.bind(this) );
    const canvas = this.ctx.canvas;
    canvas.addEventListener('touchstart', this.onTouchStart.bind(this), false);
    canvas.addEventListener('touchmove', this.onTouchMove.bind(this), false);
    canvas.addEventListener('touchend', this.onTouchEnd.bind(this), false);
  }

  onTouchStart(e) {
    e.preventDefault();
    this.touch = e.changedTouches[0];
    // handle double tap
    if (!this.tapped) {
      this.tapped = setTimeout(() => this.tapped = null, 300);
    }
    else {
      clearTimeout(this.tapped);
      this.tapped = null;
      // double tap detected
      this.onDoubleTap(e);
    }
  }

  onTouchMove(e) {
    e.preventDefault();
    const touch = e.changedTouches[0];
    if (touch.screenX > this.touch.screenX) {
      this.rightDown = true;
      this.leftDown = false;
    }
    else if (touch.screenX < this.touch.screenX) {
      this.leftDown = true;
      this.rightDown = false;
    }
    if (touch.screenY > this.touch.screenY) {
      this.downDown = true;
      this.upDown = false;
    }
    else if (touch.screenY < this.touch.screenY) {
      this.upDown = true;
      this.downDown = false;
    }
  }

  onTouchEnd(e) {
    e.preventDefault();
    this.rightDown = false;
    this.leftDown = false;
    this.upDown = false;
    this.downDown = false;
  }

  onDoubleTap(e) {
    this.togglePause();
  }

  loadImages() {
    this.tileatlas.add('vase', { x: 0, y: 0, w: 32, h: 32 });
  }

  /**
   * Pause the game, this stops the tick method from scheduling
   * itself to be called again by requestAnimationFrame. Calling
   * while paused will toggle the paused property and call tick
   * @event Game#paused
   * @event Game#unpaused
   */
  togglePause() {
    this.sound.playNote(440);
    this.paused = !this.paused;
    if (this.paused) {
      this.emit('paused');
    }
    else {
      this.emit('unpaused');
    }
    this.tick();
  }

  pause() {
    this.paused = true;
  }

  unpause() {
    this.paused = false;
    this.tick();
  }

  /**
   * Draw an image to the canvas context
   * @param {Tileset} tileset - the tilset instance to get the image and tile from
   * @param {string} tileKey  - the name of the tile to draw
   * @param {number} x - the x coordinate (in screen space) to draw the tile
   * @param {number} y - the y coordinate (in screen space) to draw the tile
   */
  drawImage(tileset, tileKey, x, y) {
    const tile = tileset.tiles.get(tileKey);
    if (tile === undefined) {
      throw new Error(`Tile not found for key: ${tileKey}`);
    }
    // Nine arguments: the element, source (x,y) coordinates, source width and
    // height (for cropping), destination (x,y) coordinates, and destination width
    // and height (resize).
    this.ctx.drawImage( tileset.img,
                        tile.x,
                        tile.y,
                        tile.w,
                        tile.h,
                        x,
                        y,
                        tile.w,
                        tile.h
                      );
  }

  collides(source, target) {
    return !(
  		( ( source.y + source.height ) < ( target.y ) ) ||
  		( source.y > ( target.y + target.height ) ) ||
  		( ( source.x + source.width ) < target.x ) ||
  		( source.x > ( target.x + target.width ) )
  	);
  }

  checkCollision(source, target, cb) {
    if (this.collides(source, target)) {
      cb(source, target);
    }
  }

  elasticCollision (a, b) {
    return {
      x1: (a.velocity.x * (a.mass - b.mass) + (2 * b.mass * b.velocity.x)) / (a.mass + b.mass),
      y1: (a.velocity.y * (a.mass - b.mass) + (2 * b.mass * b.velocity.y)) / (a.mass + b.mass),
      x2: (b.velocity.x * (b.mass - a.mass) + (2 * a.mass * a.velocity.x)) / (b.mass + a.mass),
      y2: (b.velocity.y * (b.mass - a.mass) + (2 * a.mass * a.velocity.y)) / (b.mass + a.mass)
    }
  }

  updateVase() {
    const speed = 5;
    if (this.leftDown) {
      this.vase.x -= speed;
    }
    else if (this.rightDown) {
      this.vase.x += speed;
    }
    if (this.upDown) {
      this.vase.y -= speed;
    }
    else if(this.downDown) {
      this.vase.y += speed;
    }
    if (this.vase.x < 0) {
      this.vase.x = this.width;
    }
    else if (this.vase.x > this.width) {
      this.vase.x = 0;
    }
    if (this.vase.y < 0) {
      this.vase.y = this.height;
    }
    else if (this.vase.y > this.height) {
      this.vase.y = 0;
    }
  }

  /**
   * The main update function, most game logic or system calls will go here
   */
  update() {
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.updateVase();
    this.drawImage(this.vase.tileset, this.vase.key, this.vase.x, this.vase.y);
  }

  /**
   * Calls the update function at a constant rate.
   */
  tick() {
    if (this.paused) {
      return;
    }

    const now = new Date().getTime();
    const dt = now - this.time;
    const rate = 1000/this.fps;

    if (dt > rate) {
      this.time = now - (this.time % rate);
      this.update();
    }
    window.requestAnimationFrame(this.tick.bind(this));
  }
}
