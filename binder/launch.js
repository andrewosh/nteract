import BrowserWindow from 'browser-window';

import path from 'path';

export default function launch() {
  let win = new BrowserWindow({
    width: 300,
    height: 400,
    // frame: false,
    darkTheme: true,
    title: 'Binder'
  });

  const index = path.join('./binder.html');

  win.loadURL(`file://${index}`);
  // Emitted when the window is closed.
  win.on('closed', () => {
    win = null;
  });
  return win;
}
