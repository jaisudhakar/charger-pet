// Draws the current sprite frame. The main process decides which one.
const canvas = document.getElementById('cat');
const g = canvas.getContext('2d');
let frames = {};
let current = null; // [sprite, frame]

function draw() {
  g.clearRect(0, 0, canvas.width, canvas.height);
  const img = current && frames[current[0]]?.[current[1]];
  if (img?.complete && img.naturalWidth) {
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, 0, 0, canvas.width, canvas.height);
  }
}

function resize() {
  canvas.width = Math.round(window.innerWidth * devicePixelRatio);
  canvas.height = Math.round(window.innerHeight * devicePixelRatio);
  draw();
}

window.cat.onCoat((coat, sprites) => {
  frames = {};
  for (const [name, count] of Object.entries(sprites)) {
    frames[name] = [];
    for (let i = 0; i < count; i++) {
      const img = new Image();
      img.onload = () => {
        if (current && current[0] === name && current[1] === i) draw();
      };
      img.src = `../sprites/${coat}/${name}-${i}.png`;
      frames[name].push(img);
    }
  }
  draw();
});

window.cat.onFrame((sprite, frame) => {
  current = [sprite, frame];
  draw();
});

window.addEventListener('resize', resize);
resize();
