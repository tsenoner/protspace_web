const STORE_DIRECTORY_NAME = 'protspace-last-import';
const DATA_FILENAME = 'dataset.bin';
const METADATA_FILENAME = 'metadata.json';
const SCHEMA_VERSION = 1;

interface StoredDatasetMetadata {
  schemaVersion: number;
  name: string;
  type: string;
  size: number;
  lastModified: number;
  storedAt: string;
}

export class StoredDatasetCorruptError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StoredDatasetCorruptError';
  }
}

function hasStorageDirectoryApi(storage: StorageManager | undefined): storage is StorageManager & {
  getDirectory: () => Promise<FileSystemDirectoryHandle>;
} {
  return typeof storage?.getDirectory === 'function';
}

async function getRootDirectory(): Promise<FileSystemDirectoryHandle | null> {
  if (typeof navigator === 'undefined' || !hasStorageDirectoryApi(navigator.storage)) {
    return null;
  }

  return navigator.storage.getDirectory();
}

async function getStoreDirectory(create: boolean): Promise<FileSystemDirectoryHandle | null> {
  const root = await getRootDirectory();
  if (!root) {
    return null;
  }

  try {
    return await root.getDirectoryHandle(STORE_DIRECTORY_NAME, { create });
  } catch {
    return null;
  }
}

function isValidMetadata(value: unknown): value is StoredDatasetMetadata {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const metadata = value as Record<string, unknown>;
  return (
    metadata.schemaVersion === SCHEMA_VERSION &&
    typeof metadata.name === 'string' &&
    typeof metadata.type === 'string' &&
    typeof metadata.size === 'number' &&
    typeof metadata.lastModified === 'number' &&
    typeof metadata.storedAt === 'string'
  );
}

async function writeTextFile(
  directory: FileSystemDirectoryHandle,
  filename: string,
  content: string,
): Promise<void> {
  const handle = await directory.getFileHandle(filename, { create: true });
  const writable = await handle.createWritable();
  await writable.write(content);
  await writable.close();
}

async function writeBlobFile(
  directory: FileSystemDirectoryHandle,
  filename: string,
  content: Blob,
): Promise<void> {
  const handle = await directory.getFileHandle(filename, { create: true });
  const writable = await handle.createWritable();
  await writable.write(content);
  await writable.close();
}

async function clearStoreDirectory(): Promise<void> {
  const root = await getRootDirectory();
  if (!root) {
    return;
  }

  try {
    await root.removeEntry(STORE_DIRECTORY_NAME, { recursive: true });
  } catch {
    // Directory may not exist yet.
  }
}

function buildSupportError(): Error {
  return new Error('Origin Private File System is not supported in this browser.');
}

export function isSupported(): boolean {
  return typeof navigator !== 'undefined' && hasStorageDirectoryApi(navigator.storage);
}

export async function saveLastImportedFile(file: File): Promise<void> {
  if (!isSupported()) {
    throw buildSupportError();
  }

  const directory = await getStoreDirectory(true);
  if (!directory) {
    throw new Error('Unable to access the Origin Private File System.');
  }

  const metadata: StoredDatasetMetadata = {
    schemaVersion: SCHEMA_VERSION,
    name: file.name,
    type: file.type,
    size: file.size,
    lastModified: file.lastModified,
    storedAt: new Date().toISOString(),
  };

  try {
    await writeBlobFile(directory, DATA_FILENAME, file);
    await writeTextFile(directory, METADATA_FILENAME, JSON.stringify(metadata));
  } catch (error) {
    await clearStoreDirectory();
    throw error instanceof Error ? error : new Error('Failed to save imported dataset.');
  }
}

export async function loadLastImportedFile(): Promise<File | null> {
  if (!isSupported()) {
    return null;
  }

  const directory = await getStoreDirectory(false);
  if (!directory) {
    return null;
  }

  let metadataText = '';

  try {
    const metadataHandle = await directory.getFileHandle(METADATA_FILENAME);
    metadataText = await (await metadataHandle.getFile()).text();
  } catch {
    await clearStoreDirectory();
    return null;
  }

  let metadata: StoredDatasetMetadata;
  try {
    const parsed = JSON.parse(metadataText);
    if (!isValidMetadata(parsed)) {
      throw new StoredDatasetCorruptError('Stored dataset metadata is invalid.');
    }
    metadata = parsed;
  } catch (error) {
    await clearStoreDirectory();
    if (error instanceof StoredDatasetCorruptError) {
      throw error;
    }
    throw new StoredDatasetCorruptError('Stored dataset metadata could not be parsed.');
  }

  try {
    const dataHandle = await directory.getFileHandle(DATA_FILENAME);
    const storedFile = await dataHandle.getFile();
    return new File([storedFile], metadata.name, {
      type: metadata.type,
      lastModified: metadata.lastModified,
    });
  } catch {
    await clearStoreDirectory();
    return null;
  }
}

export async function clearLastImportedFile(): Promise<void> {
  await clearStoreDirectory();
}
