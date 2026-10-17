declare module 'mammoth' {
  export interface MammothMessage {
    type: string;
    message: string;
  }

  export interface MammothResult {
    value: string;
    messages: MammothMessage[];
  }

  export interface ExtractRawTextOptions {
    buffer?: Buffer;
    path?: string;
    arrayBuffer?: ArrayBuffer;
  }

  export function extractRawText(options: ExtractRawTextOptions): Promise<MammothResult>;
  export function convertToHtml(options: ExtractRawTextOptions): Promise<MammothResult>;
}
