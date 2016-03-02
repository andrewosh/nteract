import BrowserWindow from 'browser-window';

import path from 'path';

export default function launch(notebook, endpoint) {
  let win = new BrowserWindow({
    width: 800,
    height: 1000,
    // frame: false,
    darkTheme: true,
    title: path.relative('.', notebook.replace(/.ipynb$/, '')),
  });

  const index = path.join(__dirname, '..', 'index.html');

  const params = JSON.stringify({ 
    fileName: notebook, 
    endpoint: endpoint 
  })
  console.log(params)
  win.loadURL(`file://${index}#${encodeURIComponent(params)}`);
  // Emitted when the window is closed.
  win.on('closed', () => {
    win = null;
  });
  return win;
}
