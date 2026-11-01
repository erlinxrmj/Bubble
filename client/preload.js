const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bubble', {
  platform: process.platform,
  onPickSource: (cb) => ipcRenderer.on('pick-source', (e, sources) => cb(sources)),
  pickSource: (choice) => ipcRenderer.send('source-picked', choice),
  flash: () => ipcRenderer.send('flash'),
  focusWindow: () => ipcRenderer.send('focus-window'),
  screen: {
    sources: () => ipcRenderer.invoke('screen:sources'),
    preselect: (choice) => ipcRenderer.send('screen:preselect', choice),
  },
  themes: {
    list: () => ipcRenderer.invoke('themes:list'),
    saveJson: (fileName, theme) => ipcRenderer.invoke('themes:save-json', fileName, theme),
    saveFile: (fileName, data) => ipcRenderer.invoke('themes:save-file', fileName, data),
    remove: (fileName) => ipcRenderer.invoke('themes:delete', fileName),
    openFolder: () => ipcRenderer.invoke('themes:open-folder'),
  },
  activity: {
    configure: (cfg) => ipcRenderer.send('activity:config', cfg),
    onChange: (cb) => ipcRenderer.on('activity', (e, a) => cb(a)),
  },
  sounds: {
    saveFile: (fileName, data) => ipcRenderer.invoke('sounds:save-file', fileName, data),
    openFolder: () => ipcRenderer.invoke('sounds:open-folder'),
  },
});
