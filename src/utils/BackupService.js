import JSZip from 'jszip';
import { Buffer } from 'buffer';
import { File, Paths, Directory } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDBPath, getAllMedia, initDB, closeDatabase, deleteDatabaseFiles, getDB } from './database';
import { CustomAlertManager } from '../components/CustomAlert';

const BACKUP_FILENAME = 'Void_Ultra_Backup.zip';

// Calibrated Root for SQLite files
const DB_ROOT = Paths.library || Paths.document;

// Keys we want to sync between devices
const SYNC_KEYS = ['username', 'profileImage', 'lockEnabled'];

export const exportBackup = async () => {
  try {
    const zip = new JSZip();

    // 1. Add SQLite Database
    const dbRelPath = getDBPath();
    const dbFile = new File(DB_ROOT, dbRelPath);
    if (dbFile.exists) {
       const dbData = await dbFile.bytes();
       zip.file('voidultra.db', dbData);
    }

    // 2. Add Settings/AsyncStorage
    const settings = {};
    for (const key of SYNC_KEYS) {
      const val = await AsyncStorage.getItem(key);
      if (val) settings[key] = val;
    }
    zip.file('settings.json', JSON.stringify(settings));

    // 3. Add Media Files
    const mediaRows = await getAllMedia();
    const mediaFolder = zip.folder('media');
    
    // Backup any local file mentioned in the DB
    for (const row of mediaRows) {
      const uri = row.file_uri;
      if (uri && (uri.startsWith('file://') || uri.startsWith('/')) && !uri.startsWith('http')) {
        const file = new File(uri);
        if (file.exists) {
          const fileName = uri.split('/').pop();
          const data = await file.bytes();
          mediaFolder.file(fileName, data);
        }
      }
    }
    
    // 4. Also backup profile image
    const profileUri = settings.profileImage;
    if (profileUri && (profileUri.startsWith('file://') || profileUri.startsWith('/')) && !profileUri.startsWith('http')) {
      const pFile = new File(profileUri);
      if (pFile.exists) {
        const pName = profileUri.split('/').pop();
        const pData = await pFile.bytes();
        mediaFolder.file(pName, pData);
      }
    }

    // 5. Generate and Share
    const content = await zip.generateAsync({ type: 'uint8array' });
    const backupFile = new File(Paths.document, BACKUP_FILENAME);
    await backupFile.write(content);

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(backupFile.uri, {
        mimeType: 'application/zip',
        dialogTitle: 'Export Void Backup',
        UTI: 'public.zip-archive'
      });
    }

  } catch (err) {
    console.error('Export error:', err);
    CustomAlertManager.alert('Export Failed', 'An error occurred while creating your backup zip.');
  }
};

export const importBackup = async () => {
  try {
    const res = await DocumentPicker.getDocumentAsync({
      type: 'application/zip',
      copyToCacheDirectory: true
    });

    if (res.canceled || !res.assets.length) return false;

    const zipUri = res.assets[0].uri;
    const rawData = await new File(zipUri).bytes();
    const zip = await JSZip.loadAsync(rawData);

    // 1. Unpack Settings
    const settingsFile = zip.file('settings.json');
    if (settingsFile) {
        const settingsStr = await settingsFile.async('string');
        const settings = JSON.parse(settingsStr);
        for (const [key, val] of Object.entries(settings)) {
            if (key !== 'profileImage') {
                await AsyncStorage.setItem(key, val);
            }
        }
    }

    // 2. Unpack Media
    const mediaFolder = zip.folder('media');
    if (mediaFolder) {
        // Ensure media directory exists
        const mediaDir = new Directory(Paths.document, 'media');
        if (!mediaDir.exists) await mediaDir.create();

        const files = Object.keys(zip.files).filter(f => f.startsWith('media/') && !zip.files[f].dir);
        for (const f of files) {
            const fileName = f.replace('media/', '');
            const bytes = await zip.file(f).async('uint8array');
            const targetFile = new File(Paths.document, 'media/' + fileName);
            await targetFile.write(bytes);
        }
    }

    // 3. Unpack Database (The most critical part)
    // First, close the existing connection to prevent locks
    await closeDatabase();

    const sqliteDir = new Directory(Paths.document, 'SQLite');
    if (!sqliteDir.exists) await sqliteDir.create();

    const dbFile = zip.file('voidultra.db');
    if (dbFile) {
        const dbBytes = await dbFile.async('uint8array');
        const dbPath = getDBPath();
        const targetDb = new File(DB_ROOT, dbPath);

        // Nuke the old database and all its WAL/SHM helper files
        await deleteDatabaseFiles();

        // Write the fresh database exactly where the app expects it
        await targetDb.write(dbBytes);

        // ─── CRITICAL: Live Path Rewriting (One-Hand Protocol) ───
        // We initialize the app's official connection FIRST
        await initDB();
        const liveDb = getDB();

        try {
            // 1. Update Media Paths using the official live connection
            const rows = await liveDb.getAllAsync('SELECT id, file_uri FROM media');
            for (const row of rows) {
                if (row.file_uri) {
                    const fileName = row.file_uri.split('/').pop();
                    const newUri = new File(Paths.document, 'media/' + fileName).uri;
                    await liveDb.runAsync('UPDATE media SET file_uri = ? WHERE id = ?', [newUri, row.id]);
                }
            }
            
            // 2. Update Settings in AsyncStorage
            const settingsFile2 = zip.file('settings.json');
            if (settingsFile2) {
                const settingsStr = await settingsFile2.async('string');
                const settings = JSON.parse(settingsStr);
                if (settings.profileImage) {
                    const fileName = settings.profileImage.split('/').pop();
                    const newUri = new File(Paths.document, fileName).uri;
                    await AsyncStorage.setItem('profileImage', newUri);
                }
            }
        } catch (pathErr) {
            console.error('Live migration error:', pathErr);
            throw new Error(`Data Mapping Failed: ${pathErr.message}`);
        }
    } else {
        throw new Error('Database file missing inside the ZIP. This is not a valid Void Ultra backup.');
    }

    // Re-initialize the main app database connection with the fresh data
    await initDB();

    return true;
  } catch (err) {
    console.error('Import error:', err);
    CustomAlertManager.alert('Import Failed', err.message || 'An unknown error occurred during restore.');
    return false;
  }
};
