
export enum BlockType {
  H1 = 'h1',
  H2 = 'h2',
  P = 'p',
  UL = 'ul',
  OL = 'ol',
  TODO = 'todo',
  IMG = 'img',
  QUOTE = 'quote',
  DIVIDER = 'divider',
  CODE = 'code',
  AI_SEARCH_RESULT = 'ai_search_result',
}

export interface ContentBlock {
  id: string;
  type: BlockType;
  content: string;
  checked?: boolean;
  src?: string;
  language?: string;
  sources?: { web: { uri: string; title: string } }[];
}

export interface Page {
  id: string;
  title: string;
  blocks: ContentBlock[];
}

export interface PageTemplate {
    id: string;
    name: string;
    description: string;
    blocks: ContentBlock[];
}

export type Theme = 'light' | 'dark';
