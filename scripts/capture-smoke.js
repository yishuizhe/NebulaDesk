const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

async function main() {
  const root = path.join(__dirname, '..');
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    show: false,
    backgroundColor: '#02030a',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  await win.loadFile(path.join(root, 'app', 'index.html'));
  await new Promise(resolve => setTimeout(resolve, 1600));
  const image = await win.webContents.capturePage();
  const outDir = path.join(root, 'tmp');
  fs.mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, 'nebuladesk-smoke.png');
  fs.writeFileSync(out, image.toPNG());
  console.log(out);
  app.quit();
}

app.whenReady().then(main).catch((error) => {
  console.error(error);
  app.exit(1);
});
