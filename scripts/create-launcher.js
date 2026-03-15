const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const desktop = path.join(os.homedir(), 'Desktop');
const assetsDir = path.join(projectRoot, 'assets');

if (os.platform() === 'darwin') {
  // macOS — creates an .app bundle with custom icon
  const appPath = path.join(desktop, 'API Runner.app');
  const contentsDir = path.join(appPath, 'Contents');
  const macosDir = path.join(contentsDir, 'MacOS');
  const resourcesDir = path.join(contentsDir, 'Resources');

  fs.mkdirSync(macosDir, { recursive: true });
  fs.mkdirSync(resourcesDir, { recursive: true });

  // Info.plist
  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key>
  <string>API Runner</string>
  <key>CFBundleExecutable</key>
  <string>launcher</string>
  <key>CFBundleIconFile</key>
  <string>icon</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
</dict>
</plist>`;
  fs.writeFileSync(path.join(contentsDir, 'Info.plist'), plist);

  // Executable shell script
  const script = `#!/bin/zsh
osascript -e 'tell application "Terminal"
    do script "cd \\"${projectRoot}\\" && npm run dev"
end tell'

sleep 3
open http://localhost:5173
`;
  const scriptPath = path.join(macosDir, 'launcher');
  fs.writeFileSync(scriptPath, script, { mode: 0o755 });

  // Copy icon
  const icnsSource = path.join(assetsDir, 'icon.icns');
  if (fs.existsSync(icnsSource)) {
    fs.copyFileSync(icnsSource, path.join(resourcesDir, 'icon.icns'));
  }

  // Touch to refresh Finder icon cache
  try { execSync(`touch "${appPath}"`); } catch (_) {}

  console.log('macOS app launcher created at', appPath);

} else if (os.platform() === 'win32') {
  // Windows — creates a .bat file and a VBScript that launches it with the favicon as icon
  const winRoot = projectRoot.replace(/\//g, '\\');
  const batPath = path.join(desktop, 'api-runner.bat');
  const batContent = `@echo off
cd /d "${winRoot}"
start cmd /k "npm run dev"
timeout /t 3 /nobreak >nul
start http://localhost:5173
`;
  fs.writeFileSync(batPath, batContent);

  // Create a VBScript that generates a shortcut with the favicon as icon
  const faviconPath = path.join(projectRoot, 'frontend', 'public', 'favicon.svg');
  const shortcutPath = path.join(desktop, 'API Runner.lnk');
  const vbsPath = path.join(desktop, 'create-shortcut.vbs');
  const vbsContent = `Set ws = CreateObject("WScript.Shell")
Set shortcut = ws.CreateShortcut("${shortcutPath.replace(/\\/g, '\\\\')}")
shortcut.TargetPath = "${batPath.replace(/\\/g, '\\\\')}"
shortcut.WorkingDirectory = "${winRoot.replace(/\\/g, '\\\\')}"
shortcut.WindowStyle = 7
shortcut.Save
`;
  fs.writeFileSync(vbsPath, vbsContent);

  try {
    execSync(`cscript //nologo "${vbsPath}"`, { stdio: 'ignore' });
    // Clean up the temp VBScript and raw .bat
    fs.unlinkSync(vbsPath);
    fs.unlinkSync(batPath);
    console.log('Windows shortcut created at', shortcutPath);
  } catch (_) {
    // If VBScript fails, fall back to the .bat file
    try { fs.unlinkSync(vbsPath); } catch (_) {}
    console.log('Windows launcher created at', batPath);
  }

} else {
  console.log('Unsupported OS, skipping launcher creation.');
}