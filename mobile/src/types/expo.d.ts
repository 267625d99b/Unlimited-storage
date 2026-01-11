// Type declarations for Expo modules
declare module '@expo/vector-icons' {
  import { ComponentType } from 'react';
  import { TextProps } from 'react-native';
  
  interface IconProps extends TextProps {
    name: string;
    size?: number;
    color?: string;
  }
  
  export const Ionicons: ComponentType<IconProps>;
  export const MaterialIcons: ComponentType<IconProps>;
  export const FontAwesome: ComponentType<IconProps>;
  export const Feather: ComponentType<IconProps>;
}

declare module 'expo-sharing' {
  export function shareAsync(url: string, options?: {
    mimeType?: string;
    dialogTitle?: string;
    UTI?: string;
  }): Promise<void>;
  
  export function isAvailableAsync(): Promise<boolean>;
}

declare module 'expo-file-system' {
  export const documentDirectory: string | null;
  export const cacheDirectory: string | null;
  
  export interface DownloadProgressData {
    totalBytesWritten: number;
    totalBytesExpectedToWrite: number;
  }
  
  export interface DownloadResult {
    uri: string;
    status: number;
    headers: Record<string, string>;
    md5?: string;
  }
  
  export interface DownloadResumable {
    downloadAsync(): Promise<DownloadResult | undefined>;
    pauseAsync(): Promise<DownloadProgressData>;
    resumeAsync(): Promise<DownloadResult | undefined>;
    savable(): { url: string; fileUri: string; options: object };
  }
  
  export function createDownloadResumable(
    uri: string,
    fileUri: string,
    options?: object,
    callback?: (downloadProgress: DownloadProgressData) => void,
    resumeData?: string
  ): DownloadResumable;
  
  export function getInfoAsync(fileUri: string, options?: { md5?: boolean; size?: boolean }): Promise<{
    exists: boolean;
    uri: string;
    size?: number;
    isDirectory?: boolean;
    modificationTime?: number;
    md5?: string;
  }>;
  
  export function readAsStringAsync(fileUri: string, options?: { encoding?: string }): Promise<string>;
  export function writeAsStringAsync(fileUri: string, contents: string, options?: { encoding?: string }): Promise<void>;
  export function deleteAsync(fileUri: string, options?: { idempotent?: boolean }): Promise<void>;
  export function moveAsync(options: { from: string; to: string }): Promise<void>;
  export function copyAsync(options: { from: string; to: string }): Promise<void>;
  export function makeDirectoryAsync(fileUri: string, options?: { intermediates?: boolean }): Promise<void>;
  export function readDirectoryAsync(fileUri: string): Promise<string[]>;
}
