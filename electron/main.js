const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let backendProcess;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 768,
    minWidth: 1024,
    minHeight: 600,
    backgroundColor: '#0B0F19',
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
    show: false, // Hide until ready to show to prevent white flash
  });

  // Remove the default File/Edit/View/Window/Help menu bar
  mainWindow.removeMenu();

  mainWindow.maximize();


  const isDev = process.env.NODE_ENV === 'development';

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../frontend/dist/index.html'));
  }

  // Spawn PyInstaller backend executable in production only
  if (!isDev) {
    startBackend();
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (backendProcess) {
      backendProcess.kill();
    }
  });
}

function startBackend() {
  // Path for packaged PyInstaller binary in resources folder
  let backendPath = path.join(process.resourcesPath, 'app_backend', 'main.exe');
  if (process.platform !== 'win32') {
    backendPath = path.join(process.resourcesPath, 'app_backend', 'main');
  }
  
  try {
    backendProcess = spawn(backendPath, [], {
      env: { ...process.env, PORT: '8000' }
    });

    backendProcess.stdout.on('data', (data) => {
      console.log(`Backend stdout: ${data}`);
    });

    backendProcess.stderr.on('data', (data) => {
      console.error(`Backend stderr: ${data}`);
    });

    backendProcess.on('close', (code) => {
      console.log(`Backend process exited with code ${code}`);
    });
  } catch (error) {
    console.error('Failed to spawn backend process:', error);
  }
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
  if (backendProcess) {
    backendProcess.kill();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
