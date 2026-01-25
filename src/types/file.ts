// File explorer types

export interface FileItem {
  name: string;
  type: 'file' | 'folder';
  path: string;
}
