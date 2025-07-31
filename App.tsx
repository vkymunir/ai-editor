
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Editor } from './components/Editor';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { CommandPalette } from './components/CommandPalette';
import { AiSearchModal } from './components/AiSearchModal';
import { ContentBlock, BlockType, Page, Theme } from './types';
import { pageTemplates } from './templates/pageTemplates';
import { exportPageAsMarkdown } from './utils/export';
import * as geminiService from './services/geminiService';

const App: React.FC = () => {
    const [pages, setPages] = useState<Record<string, Page>>({});
    const [currentPageId, setCurrentPageId] = useState<string | null>(null);
    const [theme, setTheme] = useState<Theme>('light');
    const [isCommandPaletteOpen, setCommandPaletteOpen] = useState(false);
    const [isAiSearchOpen, setAiSearchOpen] = useState(false);

    // Load from localStorage on initial render
    useEffect(() => {
        // Load theme
        const savedTheme = localStorage.getItem('editor-theme') as Theme | null;
        if (savedTheme && ['light', 'dark'].includes(savedTheme)) {
            setTheme(savedTheme);
        } else {
            // Set theme based on system preference
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            setTheme(prefersDark ? 'dark' : 'light');
        }

        // Load pages
        try {
            const savedPages = localStorage.getItem('editor-pages');
            const savedCurrentPageId = localStorage.getItem('editor-currentPageId');
            
            if (savedPages) {
                const parsedPages = JSON.parse(savedPages);
                setPages(parsedPages);
                if (savedCurrentPageId && parsedPages[savedCurrentPageId]) {
                    setCurrentPageId(savedCurrentPageId);
                } else if (Object.keys(parsedPages).length > 0) {
                    setCurrentPageId(Object.keys(parsedPages)[0]);
                }
            } else {
                // If no saved pages, create a default one
                handleAddPage(pageTemplates[0].blocks);
            }
        } catch (error) {
            console.error("Failed to load pages from localStorage", error);
            handleAddPage();
        }
    }, []);

    // Save to localStorage and update theme class
    useEffect(() => {
        // Theme
        document.documentElement.classList.remove('light', 'dark');
        document.documentElement.classList.add(theme);
        localStorage.setItem('editor-theme', theme);

        // Pages
        try {
            if (Object.keys(pages).length > 0) {
                localStorage.setItem('editor-pages', JSON.stringify(pages));
            } else {
                localStorage.removeItem('editor-pages');
            }
            if (currentPageId) {
                localStorage.setItem('editor-currentPageId', currentPageId);
            } else {
                 localStorage.removeItem('editor-currentPageId');
            }
        } catch (error) {
            console.error("Failed to save to localStorage", error);
        }
    }, [pages, currentPageId, theme]);

    // Command Palette hotkey
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setCommandPaletteOpen(isOpen => !isOpen);
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);

    const handleAddPage = useCallback((blocks?: ContentBlock[]) => {
        const newPageId = `page-${Date.now()}`;
        const defaultBlocks = [
            { id: `${Date.now()}-1`, type: BlockType.H1, content: 'Untitled' },
            { id: `${Date.now()}-2`, type: BlockType.P, content: '' },
        ];
        
        const newPage: Page = {
            id: newPageId,
            title: 'Untitled',
            blocks: blocks || defaultBlocks,
        };

        // If using a template, derive title from first H1
        if (blocks) {
             const h1Block = blocks.find(b => b.type === BlockType.H1);
             if (h1Block) {
                 newPage.title = h1Block.content;
             }
        }

        setPages(prev => ({ ...prev, [newPageId]: newPage }));
        setCurrentPageId(newPageId);
    }, []);

    const handleDeletePage = useCallback((pageIdToDelete: string) => {
        const remainingPageIds = Object.keys(pages).filter(id => id !== pageIdToDelete);

        setPages(prev => {
            const newPages = { ...prev };
            delete newPages[pageIdToDelete];
            return newPages;
        });
        
        if (currentPageId === pageIdToDelete) {
            if (remainingPageIds.length > 0) {
                setCurrentPageId(remainingPageIds[0]);
            } else {
                handleAddPage();
            }
        }
    }, [currentPageId, pages, handleAddPage]);

    const handleSwitchPage = useCallback((pageId: string) => {
        setCurrentPageId(pageId);
        setCommandPaletteOpen(false);
    }, []);

    const updateBlocksForCurrentPage = useCallback((newBlocks: ContentBlock[]) => {
        if (!currentPageId) return;

        setPages(prev => {
            const currentPage = prev[currentPageId];
            if (!currentPage) return prev;

            const h1Block = newBlocks.find(b => b.type === BlockType.H1);
            const newTitle = h1Block ? h1Block.content.replace(/<[^>]*>?/gm, '').trim() : 'Untitled';

            return {
                ...prev,
                [currentPageId]: {
                    ...currentPage,
                    blocks: newBlocks,
                    title: newTitle || 'Untitled',
                }
            };
        });
    }, [currentPageId]);

    const handleExport = () => {
        if (currentPage) {
            exportPageAsMarkdown(currentPage);
        }
    };
    
    const handleAiSearch = async (prompt: string): Promise<void> => {
        if (!currentPageId) return;

        const { text, sources } = await geminiService.generateWithGoogleSearch(prompt);

        const resultBlock: ContentBlock = {
            id: `search-result-${Date.now()}`,
            type: BlockType.AI_SEARCH_RESULT,
            content: text,
            sources: sources,
        };
        
        const promptBlock: ContentBlock = {
            id: `search-prompt-${Date.now()}`,
            type: BlockType.QUOTE,
            content: `> ${prompt}`,
        };
        
        setPages(prev => {
            const currentPage = prev[currentPageId];
            if (!currentPage) return prev;
            
            const newBlocks = [...currentPage.blocks, promptBlock, resultBlock];
            
            return {
                ...prev,
                [currentPageId]: {
                    ...currentPage,
                    blocks: newBlocks
                }
            };
        });
    };

    const currentPage = currentPageId ? pages[currentPageId] : null;
    const sortedPages = useMemo(() => Object.values(pages).sort((a, b) => (a.title > b.title ? 1 : -1)), [pages]);

    return (
        <div className="flex h-screen bg-stone-50 text-stone-900 dark:bg-stone-900 dark:text-stone-200">
            <CommandPalette
                isOpen={isCommandPaletteOpen}
                onClose={() => setCommandPaletteOpen(false)}
                pages={sortedPages}
                onNavigate={handleSwitchPage}
                onAddPage={handleAddPage}
            />
            <AiSearchModal
                isOpen={isAiSearchOpen}
                onClose={() => setAiSearchOpen(false)}
                onSubmit={handleAiSearch}
            />

            <Sidebar
                pages={sortedPages}
                currentPageId={currentPageId}
                onAddPage={handleAddPage}
                onSwitchPage={handleSwitchPage}
                onDeletePage={handleDeletePage}
                theme={theme}
                setTheme={setTheme}
            />
            <div className="flex-1 flex flex-col overflow-hidden">
                 <Header
                     onExport={handleExport}
                     onAiSearch={() => setAiSearchOpen(true)}
                     hasApiKey={geminiService.hasApiKey()}
                 />
                <main className="flex-1 overflow-y-auto">
                    {currentPage ? (
                        <Editor
                            key={currentPage.id}
                            initialBlocks={currentPage.blocks}
                            onBlocksChange={updateBlocksForCurrentPage}
                        />
                    ) : (
                        <div className="flex items-center justify-center h-full">
                            <div className="text-center text-stone-500 dark:text-stone-400">
                                <h2 className="text-2xl font-semibold">No Page Selected</h2>
                                <p className="mt-2">Create a new page from the sidebar to get started.</p>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

export default App;
