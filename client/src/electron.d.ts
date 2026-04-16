// Type declarations for the Electron IPC bridge exposed via preload.js

interface ElectronAPI {
  config: {
    read: () => Promise<AppConfig | null>;
    write: (data: AppConfig) => Promise<boolean>;
  };
  system: {
    mac: () => Promise<string | null>;
    listPrinters: () => Promise<{ name: string; isDefault: boolean }[]>;
  };
  print: {
    receipt: (html: string) => Promise<boolean>;
  };
}

interface AppConfig {
  serverUrl: string;
  stationId: string;
  licenseToken: string;
  printerName: string | null;
  printerType: 'USB' | 'BLUETOOTH' | 'NONE';
}

declare interface Window {
  electronAPI?: ElectronAPI;
}
