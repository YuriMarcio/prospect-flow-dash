// Integração com o Google Drive Picker: deixa o usuário escolher um arquivo
// do Drive dele (Doc, Sheet, PDF, etc.) e devolve metadados + link pra abrir.
// Não baixa o conteúdo do arquivo pra cá — só guarda a referência, então
// Docs/Sheets continuam sendo editados no próprio Google.

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY as string | undefined;

// drive.file (não drive.readonly): só dá acesso aos arquivos que o próprio
// usuário selecionar na tela do Picker, não à Drive inteira. É o escopo
// recomendado pelo Google pra esse caso de uso — classificado como "sensível"
// em vez de "restrito", exige menos verificação.
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

declare global {
  interface Window {
    gapi: {
      load: (api: string, callback: () => void) => void;
    };
    google: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token?: string; error?: string }) => void;
          }) => { requestAccessToken: () => void };
        };
      };
      picker: {
        PickerBuilder: new () => GooglePickerBuilder;
        DocsView: new () => GoogleDocsView;
        Action: { PICKED: string; CANCEL: string };
        ViewId: Record<string, string>;
      };
    };
  }
}

interface GoogleDocsView {
  setIncludeFolders: (value: boolean) => GoogleDocsView;
  setSelectFolderEnabled: (value: boolean) => GoogleDocsView;
}

interface GooglePickerDoc {
  id: string;
  name: string;
  mimeType: string;
  url?: string;
  iconUrl?: string;
  sizeBytes?: number;
}

interface GooglePickerBuilder {
  addView: (view: GoogleDocsView) => GooglePickerBuilder;
  setOAuthToken: (token: string) => GooglePickerBuilder;
  setDeveloperKey: (key: string) => GooglePickerBuilder;
  setCallback: (cb: (data: { action: string; docs?: GooglePickerDoc[] }) => void) => GooglePickerBuilder;
  build: () => { setVisible: (visible: boolean) => void };
}

export interface DrivePickedFile {
  id: string;
  name: string;
  mimeType: string;
  url: string;
  iconUrl?: string;
  sizeBytes?: number;
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Falha ao carregar ${src}`));
    document.head.appendChild(script);
  });
}

let pickerApiLoaded: Promise<void> | null = null;

function ensurePickerApiLoaded(): Promise<void> {
  pickerApiLoaded ??= (async () => {
    await Promise.all([
      loadScript("https://apis.google.com/js/api.js"),
      loadScript("https://accounts.google.com/gsi/client"),
    ]);
    await new Promise<void>((resolve) => window.gapi.load("picker", () => resolve()));
  })();
  return pickerApiLoaded;
}

let cachedAccessToken: string | null = null;

function requestAccessToken(): Promise<string> {
  if (cachedAccessToken) return Promise.resolve(cachedAccessToken);

  return new Promise((resolve, reject) => {
    if (!CLIENT_ID) {
      reject(new Error("VITE_GOOGLE_CLIENT_ID não configurado."));
      return;
    }
    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: DRIVE_SCOPE,
      callback: (response) => {
        if (response.error || !response.access_token) {
          reject(new Error(response.error ?? "Não foi possível autorizar o Google Drive."));
          return;
        }
        cachedAccessToken = response.access_token;
        resolve(response.access_token);
      },
    });
    tokenClient.requestAccessToken();
  });
}

export function isGoogleDriveConfigured(): boolean {
  return Boolean(CLIENT_ID && API_KEY);
}

export async function pickGoogleDriveFile(): Promise<DrivePickedFile | null> {
  if (!CLIENT_ID || !API_KEY) {
    throw new Error(
      "Configure VITE_GOOGLE_CLIENT_ID e VITE_GOOGLE_API_KEY no .env do front para usar o Google Drive.",
    );
  }

  await ensurePickerApiLoaded();
  const accessToken = await requestAccessToken();

  return new Promise((resolve, reject) => {
    try {
      const view = new window.google.picker.DocsView().setIncludeFolders(true).setSelectFolderEnabled(false);

      const picker = new window.google.picker.PickerBuilder()
        .addView(view)
        .setOAuthToken(accessToken)
        .setDeveloperKey(API_KEY)
        .setCallback((data) => {
          if (data.action === window.google.picker.Action.PICKED && data.docs?.[0]) {
            const doc = data.docs[0];
            resolve({
              id: doc.id,
              name: doc.name,
              mimeType: doc.mimeType,
              url: doc.url ?? `https://drive.google.com/file/d/${doc.id}/view`,
              iconUrl: doc.iconUrl,
              sizeBytes: doc.sizeBytes,
            });
          } else if (data.action === window.google.picker.Action.CANCEL) {
            resolve(null);
          }
        })
        .build();
      picker.setVisible(true);
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
}
