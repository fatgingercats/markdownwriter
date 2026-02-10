import { app, BrowserWindow, ipcMain, dialog, shell, Rectangle, Menu, MenuItemConstructorOptions } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';

let mainWindow: BrowserWindow | null;

type DeviceFingerprint = {
    deviceId: string;
    hardwareProfile: {
        platform: string;
        arch: string;
        cpuModel: string;
        cpuCount: number;
        totalMemoryGb: number;
        macs: string[];
    };
    toleranceKeys: string[];
    distributionChannel: 'portable' | 'installed';
};

function sha256(input: string): string {
    return crypto.createHash('sha256').update(input).digest('hex');
}

function normalizeMacs(): string[] {
    const nics = os.networkInterfaces();
    const macs = new Set<string>();

    Object.values(nics).forEach((list) => {
        (list || []).forEach((item) => {
            if (!item || item.internal) return;
            if (!item.mac || item.mac === '00:00:00:00:00:00') return;
            macs.add(item.mac.toLowerCase().replace(/-/g, ':'));
        });
    });

    return Array.from(macs).sort();
}

function getDeviceFingerprint(): DeviceFingerprint {
    const cpus = os.cpus() || [];
    const cpuModel = (cpus[0]?.model || 'unknown').replace(/\s+/g, ' ').trim();
    const cpuCount = cpus.length || 0;
    const totalMemoryGb = Math.max(1, Math.round(os.totalmem() / (1024 * 1024 * 1024)));
    const platform = process.platform;
    const arch = process.arch;
    const macs = normalizeMacs();

    const hardwareProfile = {
        platform,
        arch,
        cpuModel,
        cpuCount,
        totalMemoryGb,
        macs,
    };

    const primaryMac = macs[0] || 'none';
    const secondaryMac = macs[1] || 'none';

    const toleranceKeys = [
        sha256(`${cpuModel}|${cpuCount}|${arch}|${platform}`),
        sha256(`${cpuModel}|${totalMemoryGb}|${platform}`),
        sha256(`${primaryMac}|${arch}|${platform}`),
        sha256(`${secondaryMac}|${cpuCount}|${platform}`),
    ];

    const deviceId = sha256(
        JSON.stringify({
            cpuModel,
            cpuCount,
            totalMemoryGb,
            arch,
            platform,
            macs: macs.slice(0, 3),
        })
    );

    const distributionChannel = process.env.PORTABLE_EXECUTABLE_DIR ? 'portable' : 'installed';

    return {
        deviceId,
        hardwareProfile,
        toleranceKeys,
        distributionChannel,
    };
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 840,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
        titleBarStyle: 'hiddenInset',
    });

    // Hide the default application menu bar.
    mainWindow.setMenuBarVisibility(false);
    Menu.setApplicationMenu(null);

    const isDev = process.env.NODE_ENV === 'development';
    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
    } else {
        mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    mainWindow.webContents.on('context-menu', (_event, params) => {
        const menuTemplate: MenuItemConstructorOptions[] = [];

        if (params.isEditable) {
            menuTemplate.push(
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' },
                { role: 'delete' },
                { type: 'separator' },
                { role: 'selectAll' },
            );
        } else if (params.selectionText && params.selectionText.trim().length > 0) {
            menuTemplate.push(
                { role: 'copy' },
                { type: 'separator' },
                { role: 'selectAll' },
            );
        } else {
            menuTemplate.push({ role: 'copy' }, { role: 'selectAll' });
        }

        Menu.buildFromTemplate(menuTemplate).popup({ window: mainWindow || undefined });
    });

    if (process.env.MDWRITER_INTERACTION_CHECK === '1') {
        runInteractionCheck().catch((err) => {
            console.error('INTERACTION_CHECK_FAILED');
            console.error(err?.stack || err);
            app.exit(1);
        });
    }
}

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForSelector(selector: string, timeoutMs = 15000): Promise<void> {
    if (!mainWindow) throw new Error('Main window not available.');
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
        const found = await mainWindow.webContents.executeJavaScript(
            `Boolean(document.querySelector(${JSON.stringify(selector)}))`
        );
        if (found) return;
        await delay(80);
    }
    throw new Error(`Timeout waiting for selector: ${selector}`);
}

async function getSelectorCenter(selector: string): Promise<{ x: number; y: number }> {
    if (!mainWindow) throw new Error('Main window not available.');
    const rect = await mainWindow.webContents.executeJavaScript(
        `(() => {
            const el = document.querySelector(${JSON.stringify(selector)});
            if (!el) return null;
            const r = el.getBoundingClientRect();
            return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
        })()`
    );

    if (!rect) {
        throw new Error(`Selector not found for click: ${selector}`);
    }
    return rect;
}

async function clickSelector(selector: string): Promise<void> {
    if (!mainWindow) throw new Error('Main window not available.');
    await waitForSelector(selector);
    const point = await getSelectorCenter(selector);
    mainWindow.webContents.sendInputEvent({ type: 'mouseDown', x: point.x, y: point.y, button: 'left', clickCount: 1 });
    mainWindow.webContents.sendInputEvent({ type: 'mouseUp', x: point.x, y: point.y, button: 'left', clickCount: 1 });
    await delay(60);
}

async function clickButtonByText(text: string): Promise<void> {
    if (!mainWindow) throw new Error('Main window not available.');
    await waitForSelector('button');
    const point = await mainWindow.webContents.executeJavaScript(
        `(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const target = buttons.find((b) => (b.textContent || '').trim() === ${JSON.stringify(text)});
            if (!target) return null;
            const r = target.getBoundingClientRect();
            return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
        })()`
    );
    if (!point) {
        throw new Error(`Button not found: ${text}`);
    }
    mainWindow.webContents.sendInputEvent({ type: 'mouseDown', x: point.x, y: point.y, button: 'left', clickCount: 1 });
    mainWindow.webContents.sendInputEvent({ type: 'mouseUp', x: point.x, y: point.y, button: 'left', clickCount: 1 });
    await delay(60);
}

async function typeText(text: string): Promise<void> {
    if (!mainWindow) throw new Error('Main window not available.');
    for (const ch of text) {
        if (ch === '\n') {
            mainWindow.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Enter' });
            mainWindow.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Enter' });
        } else {
            mainWindow.webContents.sendInputEvent({ type: 'char', keyCode: ch });
        }
    }
}

async function clearEditorWithShortcut(): Promise<void> {
    if (!mainWindow) throw new Error('Main window not available.');
    mainWindow.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Control' });
    mainWindow.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'A', modifiers: ['control'] });
    mainWindow.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'A', modifiers: ['control'] });
    mainWindow.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Control' });
    await delay(40);
    mainWindow.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Backspace' });
    mainWindow.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Backspace' });
}

async function triggerSaveAsShortcut(): Promise<void> {
    if (!mainWindow) throw new Error('Main window not available.');
    mainWindow.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Control' });
    mainWindow.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Shift' });
    mainWindow.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'S', modifiers: ['control', 'shift'] });
    mainWindow.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'S', modifiers: ['control', 'shift'] });
    mainWindow.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Shift' });
    mainWindow.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Control' });
    await delay(120);
}

async function getText(selector: string): Promise<string> {
    if (!mainWindow) throw new Error('Main window not available.');
    return await mainWindow.webContents.executeJavaScript(
        `(() => {
            const el = document.querySelector(${JSON.stringify(selector)});
            return el ? (el.textContent || '').trim() : '';
        })()`
    );
}

async function waitForFile(filePath: string, timeoutMs = 15000): Promise<void> {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
        if (fs.existsSync(filePath)) return;
        await delay(100);
    }
    throw new Error(`Timeout waiting for file: ${filePath}`);
}

async function runInteractionCheck(): Promise<void> {
    if (!mainWindow) throw new Error('Main window not available.');

    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'draftone-interaction-'));
    const docsDir = path.join(tmpRoot, 'docs');
    const outDir = path.join(tmpRoot, 'out');
    fs.mkdirSync(docsDir, { recursive: true });
    fs.mkdirSync(outDir, { recursive: true });

    const smokeFile = path.join(docsDir, 'smoke-a.md');
    fs.writeFileSync(smokeFile, '# Smoke A\n\nalpha line\n', 'utf-8');
    fs.writeFileSync(path.join(docsDir, 'smoke-b.md'), '# Smoke B\n\nbeta line\n', 'utf-8');

    let saveAsCounter = 0;
    const originalShowOpenDialog = dialog.showOpenDialog.bind(dialog);
    const originalShowSaveDialog = dialog.showSaveDialog.bind(dialog);

    dialog.showOpenDialog = (async () => ({
        canceled: false,
        filePaths: [docsDir],
    })) as any;

    dialog.showSaveDialog = (async (...args: any[]) => {
        const options = args.length >= 2 ? args[1] : args[0];
        const ext = options?.filters?.[0]?.extensions?.[0] || 'txt';
        const defaultPath = options?.defaultPath || '';
        if (process.env.MDWRITER_INTERACTION_CHECK === '1') {
            console.log(`INTERACTION_DIALOG_SAVE defaultPath=${defaultPath}`);
        }

        if (defaultPath.includes('export-')) {
            return {
                canceled: false,
                filePath: path.join(outDir, `export-${ext}.${ext}`),
            } as any;
        }

        saveAsCounter += 1;
        return {
            canceled: false,
            filePath: path.join(outDir, `save-as-${saveAsCounter}.md`),
        } as any;
    }) as any;

    try {
        console.log('INTERACTION_STEP=wait_initial_load');
        await new Promise<void>((resolve) => {
            if (!mainWindow) return resolve();
            mainWindow.webContents.once('did-finish-load', () => resolve());
        });

        console.log('INTERACTION_STEP=reload');
        await mainWindow.webContents.executeJavaScript(`
            window.alert = () => {};
            location.reload();
        `);

        console.log('INTERACTION_STEP=wait_editor');
        await waitForSelector('.editor-toolbar', 20000);
        await mainWindow.webContents.executeJavaScript('(() => { window.alert = () => {}; return true; })()');

        console.log('INTERACTION_STEP=open_folder');
        await clickSelector('button[title="Open Folder"]');
        await waitForSelector('.file-item.active');
        await waitForSelector('.preview-content h1');

        const h1 = await getText('.preview-content h1');
        if (h1 !== 'Smoke A') {
            throw new Error(`Open/read check failed. Expected Smoke A, got: ${h1}`);
        }

        console.log('INTERACTION_STEP=autosave');
        await clickSelector('.cm-content');
        await typeText('\nAUTOSAVE_MARKER_123');
        await delay(4200);

        const autoSaved = fs.readFileSync(smokeFile, 'utf-8');
        if (!autoSaved.includes('AUTOSAVE_MARKER_123')) {
            throw new Error('Autosave check failed.');
        }

        console.log('INTERACTION_STEP=save');
        await typeText('\nSAVE_MARKER_456');
        await clickButtonByText('Save');
        await delay(1600);

        const saved = fs.readFileSync(smokeFile, 'utf-8');
        if (!saved.includes('SAVE_MARKER_456')) {
            throw new Error('Save check failed.');
        }

        console.log('INTERACTION_STEP=save_as');
        await clickSelector('button[title="New File"]');
        await clickSelector('.cm-content');
        await clearEditorWithShortcut();
        await typeText('# Save As Title\n\nSaveAs Body\n');
        await triggerSaveAsShortcut();

        const saveAsPath = path.join(outDir, 'save-as-1.md');
        await waitForFile(saveAsPath);
        const saveAsContent = fs.readFileSync(saveAsPath, 'utf-8');
        if (!saveAsContent.includes('SaveAs Body')) {
            throw new Error('Save As content check failed.');
        }

        console.log('INTERACTION_STEP=export_md');
        await mainWindow.webContents.executeJavaScript(`
            (async () => {
                const { ipcRenderer } = window.require('electron');
                return ipcRenderer.invoke('export-file', {
                    content: '# Export MD\\n',
                    type: 'markdown',
                    filename: 'export-md.md',
                });
            })()
        `);
        await waitForFile(path.join(outDir, 'export-md.md'));

        console.log('INTERACTION_STEP=export_docx');
        await mainWindow.webContents.executeJavaScript(`
            (async () => {
                const { ipcRenderer } = window.require('electron');
                const bytes = new TextEncoder().encode('DOCX-BINARY-SMOKE');
                return ipcRenderer.invoke('export-file', {
                    content: bytes.buffer,
                    type: 'docx',
                    filename: 'export-docx.docx',
                });
            })()
        `);
        await waitForFile(path.join(outDir, 'export-docx.docx'));

        console.log('INTERACTION_STEP=export_pdf');
        await mainWindow.webContents.executeJavaScript(`
            (async () => {
                const { ipcRenderer } = window.require('electron');
                const html = '<!doctype html><html><body><h1>PDF Smoke</h1><p>ok</p></body></html>';
                return ipcRenderer.invoke('export-file', {
                    content: '',
                    type: 'pdf',
                    html,
                    filename: 'export-pdf.pdf',
                });
            })()
        `);
        await waitForFile(path.join(outDir, 'export-pdf.pdf'));

        console.log('INTERACTION_STEP=export_jpeg');
        await mainWindow.webContents.executeJavaScript(`
            (async () => {
                const { ipcRenderer } = window.require('electron');
                const html = '<!doctype html><html><body><h1>JPEG Smoke</h1><p>ok</p></body></html>';
                return ipcRenderer.invoke('export-file', {
                    content: '',
                    type: 'jpeg',
                    html,
                    filename: 'export-jpeg.jpeg',
                });
            })()
        `);
        await waitForFile(path.join(outDir, 'export-jpeg.jpeg'));

        const exportFiles = [
            path.join(outDir, 'export-md.md'),
            path.join(outDir, 'export-docx.docx'),
            path.join(outDir, 'export-pdf.pdf'),
            path.join(outDir, 'export-jpeg.jpeg'),
        ];
        for (const file of exportFiles) {
            const stat = fs.statSync(file);
            if (stat.size <= 0) {
                throw new Error(`Export file is empty: ${file}`);
            }
        }

        console.log('INTERACTION_CHECK_OK');
        console.log(`INTERACTION_ARTIFACTS=${outDir}`);
        app.exit(0);
    } finally {
        dialog.showOpenDialog = originalShowOpenDialog;
        dialog.showSaveDialog = originalShowSaveDialog;
    }
}

function resolveFileInFolder(folderPath: string, fileName: string): string {
    const resolvedFolder = path.resolve(folderPath);
    const resolvedFile = path.resolve(resolvedFolder, fileName);
    const isInsideFolder = resolvedFile === resolvedFolder || resolvedFile.startsWith(resolvedFolder + path.sep);

    if (!isInsideFolder) {
        throw new Error('Invalid file path.');
    }

    return resolvedFile;
}

async function createExportWindow(html: string): Promise<BrowserWindow> {
    const exportWindow = new BrowserWindow({
        width: 1240,
        height: 1754,
        show: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
        },
    });

    const dataUrl = `data:text/html;charset=UTF-8,${encodeURIComponent(html)}`;
    await exportWindow.loadURL(dataUrl);

    return exportWindow;
}

async function captureHtmlAsJpeg(html: string): Promise<Buffer> {
    const exportWindow = await createExportWindow(html);
    try {
        const dimensions = await exportWindow.webContents.executeJavaScript(`
            (() => {
                const body = document.body;
                const doc = document.documentElement;
                const width = Math.max(
                    body.scrollWidth, body.offsetWidth, body.clientWidth,
                    doc.scrollWidth, doc.offsetWidth, doc.clientWidth
                );
                const height = Math.max(
                    body.scrollHeight, body.offsetHeight, body.clientHeight,
                    doc.scrollHeight, doc.offsetHeight, doc.clientHeight
                );
                return { width, height };
            })();
        `);

        const targetWidth = Math.max(1240, Math.ceil(dimensions.width || 1240));
        const targetHeight = Math.max(1, Math.ceil(dimensions.height || 1));
        const maxCaptureHeight = 16000;

        if (targetHeight > maxCaptureHeight) {
            throw new Error(`Document is too long for JPEG export (${targetHeight}px > ${maxCaptureHeight}px).`);
        }

        exportWindow.setContentSize(targetWidth, targetHeight);
        await exportWindow.webContents.executeJavaScript('new Promise((resolve) => requestAnimationFrame(() => resolve(true)));');

        const image = await exportWindow.webContents.capturePage({
            x: 0,
            y: 0,
            width: targetWidth,
            height: targetHeight,
        });

        return image.toJPEG(92);
    } finally {
        exportWindow.destroy();
    }
}

function normalizeClip(clip: Rectangle, maxWidth: number, maxHeight: number): Rectangle | null {
    const x = Math.max(0, Math.floor(clip.x));
    const y = Math.max(0, Math.floor(clip.y));
    const width = Math.max(0, Math.floor(clip.width));
    const height = Math.max(0, Math.floor(clip.height));

    if (width <= 0 || height <= 0) {
        return null;
    }

    if (x >= maxWidth || y >= maxHeight) {
        return null;
    }

    return {
        x,
        y,
        width: Math.min(width, maxWidth - x),
        height: Math.min(height, maxHeight - y),
    };
}

ipcMain.handle('open-folder', async () => {
    if (!mainWindow) return null;

    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory'],
    });

    if (result.canceled || result.filePaths.length === 0) return null;

    const folderPath = result.filePaths[0];
    const files = fs.readdirSync(folderPath)
        .filter((file) => file.toLowerCase().endsWith('.md'))
        .sort((a, b) => a.localeCompare(b))
        .slice(0, 500);

    return { path: folderPath, files };
});

ipcMain.handle('read-markdown-file', async (_event, { folderPath, fileName }) => {
    try {
        if (!folderPath || !fileName) {
            return { success: false, error: 'Missing folder or file name.' };
        }

        const filePath = resolveFileInFolder(folderPath, fileName);
        const content = fs.readFileSync(filePath, 'utf-8');
        return { success: true, content, path: filePath };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
});

ipcMain.handle('save-file', async (_event, { filePath, content }) => {
    try {
        if (!filePath) {
            return { success: false, error: 'Missing file path.' };
        }

        fs.writeFileSync(filePath, content ?? '', 'utf-8');
        return { success: true, path: filePath };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
});

ipcMain.handle('save-file-as', async (_event, { content, defaultPath }) => {
    if (!mainWindow) return { success: false, error: 'Main window not available.' };
    if (process.env.MDWRITER_INTERACTION_CHECK === '1') {
        console.log(`INTERACTION_IPC save-file-as defaultPath=${defaultPath}`);
    }

    const result = await dialog.showSaveDialog(mainWindow, {
        defaultPath: defaultPath || 'Untitled.md',
        filters: [{ name: 'Markdown', extensions: ['md'] }],
    });
    if (process.env.MDWRITER_INTERACTION_CHECK === '1') {
        console.log(`INTERACTION_IPC save-file-as result=${result.filePath || 'none'} canceled=${result.canceled}`);
    }

    if (result.canceled || !result.filePath) {
        return { success: false, canceled: true };
    }

    try {
        fs.writeFileSync(result.filePath, content ?? '', 'utf-8');
        return { success: true, path: result.filePath };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
});

ipcMain.handle('get-machine-id', async () => {
    try {
        return getDeviceFingerprint().deviceId;
    } catch (_err) {
        return 'UNKNOWN-DEVICE';
    }
});

ipcMain.handle('get-device-fingerprint', async () => {
    try {
        return getDeviceFingerprint();
    } catch (_err) {
        return {
            deviceId: 'UNKNOWN-DEVICE',
            hardwareProfile: {
                platform: process.platform,
                arch: process.arch,
                cpuModel: 'unknown',
                cpuCount: 0,
                totalMemoryGb: 0,
                macs: [],
            },
            toleranceKeys: [],
            distributionChannel: 'installed',
        };
    }
});

ipcMain.on('open-external', (_event, url) => {
    shell.openExternal(url);
});

ipcMain.handle('export-file', async (_event, payload) => {
    if (!mainWindow) return { success: false, error: 'Main window not available.' };

    const { content, type, filename, html, clip } = payload || {};
    const extension = type === 'markdown' ? 'md' : type === 'docx' ? 'docx' : type === 'jpeg' ? 'jpeg' : 'pdf';
    const label = extension.toUpperCase();

    const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
        defaultPath: filename || `document.${extension}`,
        filters: [{ name: label, extensions: [extension] }],
    });

    if (canceled || !filePath) return { success: false, canceled: true };

    try {
        if (type === 'markdown') {
            fs.writeFileSync(filePath, content ?? '', 'utf-8');
            return { success: true, path: filePath };
        }

        if (type === 'docx') {
            fs.writeFileSync(filePath, Buffer.from(content));
            return { success: true, path: filePath };
        }

        if (type === 'pdf') {
            if (html) {
                const exportWindow = await createExportWindow(html);
                try {
                    const data = await exportWindow.webContents.printToPDF({
                        printBackground: true,
                        margins: { top: 0, bottom: 0, left: 0, right: 0 },
                        pageSize: 'A4',
                    });
                    fs.writeFileSync(filePath, data);
                } finally {
                    exportWindow.destroy();
                }
            } else {
                const data = await mainWindow.webContents.printToPDF({
                    printBackground: true,
                    margins: { top: 0, bottom: 0, left: 0, right: 0 },
                    pageSize: 'A4',
                });
                fs.writeFileSync(filePath, data);
            }
            return { success: true, path: filePath };
        }

        if (type === 'jpeg') {
            if (html) {
                const jpeg = await captureHtmlAsJpeg(html);
                fs.writeFileSync(filePath, jpeg);
                return { success: true, path: filePath };
            }

            const contentBounds = mainWindow.getContentBounds();
            const safeClip = clip
                ? normalizeClip(clip as Rectangle, contentBounds.width, contentBounds.height)
                : null;

            const image = safeClip
                ? await mainWindow.webContents.capturePage(safeClip)
                : await mainWindow.webContents.capturePage();

            fs.writeFileSync(filePath, image.toJPEG(92));
            return { success: true, path: filePath };
        }

        return { success: false, error: `Unsupported export type: ${type}` };
    } catch (err: any) {
        console.error('Export failed:', err);
        return { success: false, error: err.message };
    }
});

app.on('ready', createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});
