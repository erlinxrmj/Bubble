// Erzeugt assets/icon.png aus assets/icon.svg (läuft automatisch vor "npm start" und "npm run dist")
const fs = require('fs');
const path = require('path');

const assets = path.join(__dirname, '..', 'assets');
const out = path.join(assets, 'icon.png');
if (fs.existsSync(out)) process.exit(0);

const { Resvg } = require('@resvg/resvg-js');
const svg = fs.readFileSync(path.join(assets, 'icon.svg'));
const png = new Resvg(svg, { fitTo: { mode: 'width', value: 512 } }).render().asPng();
fs.writeFileSync(out, png);
console.log('Icon erstellt:', out);
