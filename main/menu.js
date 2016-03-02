import { dialog, app, Menu } from 'electron';

import { listKernelSpecs as listZmqKernelSpecs } from '../src/api/kernel-zmq';
import { listKernelSpecs as listSocketIoKernelSpecs } from '../src/api/kernel-socketio';

import launch from './launch';

import * as path from 'path';

function send(focusedWindow, eventName, obj) {
  if(!focusedWindow) {
    console.error('renderer window not in focus (are your devtools open?)');
    return;
  }
  focusedWindow.webContents.send(eventName, obj);
}

function createSender(eventName, obj) {
  return (item, focusedWindow) => {
    send(focusedWindow, eventName, obj);
  };
}

export const file = {
  label: '&File',
  submenu: [
    {
      label: '&Open',
      click: () => {
        const opts = {
          title: 'Open a notebook',
          filters: [
            { name: 'Notebooks', extensions: ['ipynb'] },
          ],
          properties: [
            'openFile',
          ],
          defaultPath: process.cwd(),
        };
        dialog.showOpenDialog(opts, (fname) => {
          if(fname) {
            launch(fname[0]);
          }
        });
      },
      accelerator: 'CmdOrCtrl+O',
    },
    {
      label: '&Save',
      click: createSender('menu:save'),
      accelerator: 'CmdOrCtrl+S',
    },
    {
      label: 'Save &As',
      click: (item, focusedWindow) => {
        const opts = {
          title: 'Save Notebook As',
          filters: [{ name: 'Notebooks', extensions: ['ipynb'] }],
        };
        dialog.showSaveDialog(opts, (filename) => {
          if(!filename) {
            return;
          }

          if (path.extname(filename) === '') {
            filename = filename + '.ipynb';
          }
          send(focusedWindow, 'menu:save-as', filename);
        });
      },
      accelerator: 'CmdOrCtrl+Shift+S',
    },
  ],
};

export const edit = {
  label: 'Edit',
  submenu: [
    {
      label: 'Undo',
      accelerator: 'CmdOrCtrl+Z',
      role: 'undo',
    },
    {
      label: 'Redo',
      accelerator: 'Shift+CmdOrCtrl+Z',
      role: 'redo',
    },
    {
      type: 'separator',
    },
    {
      label: 'Cut',
      accelerator: 'CmdOrCtrl+X',
      role: 'cut',
    },
    {
      label: 'Copy',
      accelerator: 'CmdOrCtrl+C',
      role: 'copy',
    },
    {
      label: 'Paste',
      accelerator: 'CmdOrCtrl+V',
      role: 'paste',
    },
    {
      label: 'Select All',
      accelerator: 'CmdOrCtrl+A',
      role: 'selectall',
    },
  ],
};

export const view = {
  label: 'View',
  submenu: [
    {
      label: 'Reload',
      accelerator: 'CmdOrCtrl+R',
      click: (item, focusedWindow) => {
        if (focusedWindow) {
          focusedWindow.reload();
        }
      },
    },
    {
      label: 'Toggle Full Screen',
      accelerator: (() => {
        if (process.platform === 'darwin') {
          return 'Ctrl+Command+F';
        }
        return 'F11';
      })(),
      click: (item, focusedWindow) => {
        if (focusedWindow) {
          focusedWindow.setFullScreen(!focusedWindow.isFullScreen());
        }
      },
    },
    {
      label: 'Toggle Developer Tools',
      accelerator: (() => {
        if (process.platform === 'darwin') {
          return 'Alt+Command+I';
        }
        return 'Ctrl+Shift+I';
      })(),
      click: (item, focusedWindow) => {
        if (focusedWindow) {
          focusedWindow.toggleDevTools();
        }
      },
    },
  ],
};

const windowDraft = {
  label: 'Window',
  role: 'window',
  submenu: [
    {
      label: 'Minimize',
      accelerator: 'CmdOrCtrl+M',
      role: 'minimize',
    },
    {
      label: 'Close',
      accelerator: 'CmdOrCtrl+W',
      role: 'close',
    },
  ],
};

if(process.platform === 'darwin') {
  windowDraft.submenu.push(
    {
      type: 'separator',
    },
    {
      label: 'Bring All to Front',
      role: 'front',
    }
  );
}

export const window = windowDraft;

export const help = {
  label: 'Help',
  role: 'help',
  submenu: [
    {
      label: 'Learn More',
      click: () => { require('electron').shell.openExternal('http://github.com/nteract/nteract'); },
    },
  ],
};

const name = app.getName();
export const named = {
  label: name,
  submenu: [
    {
      label: 'About ' + name,
      role: 'about',
    },
    {
      type: 'separator',
    },
    {
      label: 'Services',
      role: 'services',
      submenu: [],
    },
    {
      type: 'separator',
    },
    {
      label: 'Hide ' + name,
      accelerator: 'Command+H',
      role: 'hide',
    },
    {
      label: 'Hide Others',
      accelerator: 'Command+Alt+H',
      role: 'hideothers',
    },
    {
      label: 'Show All',
      role: 'unhide',
    },
    {
      type: 'separator',
    },
    {
      label: 'Quit',
      accelerator: 'Command+Q',
      click: () => { app.quit(); },
    },
  ],
};

export function generateDefaultTemplate() {
  const template = [];

  if(process.platform === 'darwin') {
    template.push(named);
  }

  template.push(file);
  template.push(edit);
  template.push(view);
  template.push(window);
  template.push(help);

  return template;
}

export const defaultMenu = Menu.buildFromTemplate(generateDefaultTemplate());

export function loadFullMenu(endpoint) {
  const listKernelSpecs = endpoint ? listSocketIoKernelSpecs : listZmqKernelSpecs
  const kernelMenuPromise = listKernelSpecs().then(kernelSpecs => {
    return Object.keys(kernelSpecs).map(kernelName => {
      return {
        label: kernelSpecs[kernelName].spec.display_name,
        click: createSender('menu:new-kernel', kernelName),
      };
    });
  });

  return kernelMenuPromise.then(kernelMenuItems => {
    const languageMenu = {
      label: '&Language',
      submenu: [
        {
          label: '&Kill Running Kernel',
          click: createSender('menu:kill-kernel'),
        },
        {
          type: 'separator',
        },
        // All the available kernels
        ...kernelMenuItems,
      ],
    };
    const template = [];

    if(process.platform === 'darwin') {
      template.push(named);
    }

    template.push(file);
    template.push(edit);
    template.push(view);

    // Application specific functionality should go before window and help
    template.push(languageMenu);
    template.push(window);
    template.push(help);

    const menu = Menu.buildFromTemplate(template);
    return menu;
  });
}
