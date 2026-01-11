const { app, BrowserWindow, Menu } = require('electron');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // تحميل الموقع
  mainWindow.loadURL('http://localhost:5173');
  
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null); // إخفاء القائمة
  createWindow();
});

app.on('window-all-closed', () => {
  app.quit();
});
