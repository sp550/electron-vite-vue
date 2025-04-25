import * as monaco from 'monaco-editor';

/**
 * Types for language and theme config, and template completions.
 * These should match the structure of your config/templates files.
 */
export interface MonacoLanguageConfig {
  id: string;
  extensions?: string[];
  aliases?: string[];
  monarchTokensProvider?: monaco.languages.IMonarchLanguage;
  languageConfiguration?: monaco.languages.LanguageConfiguration;
  // Add more as needed
}

export interface MonacoThemeConfig {
  name: string;
  base: 'vs' | 'vs-dark' | 'hc-black' | 'hc-light';
  inherit: boolean;
  rules: monaco.editor.ITokenThemeRule[];
  colors?: Record<string, string>;
}

export interface TemplateCompletion {
  label: string;
  insertText: string;
  detail?: string;
  documentation?: string;
  kind?: monaco.languages.CompletionItemKind;
  // Add more as needed
}

export interface MonacoServiceOptions {
  container: HTMLElement;
  value?: string;
  language?: string;
  theme?: string;
  readOnly?: boolean;
  options?: monaco.editor.IStandaloneEditorConstructionOptions;
}

/**
 * MonacoService: Singleton class encapsulating all Monaco Editor logic.
 */
class MonacoService {
  private editor: monaco.editor.IStandaloneCodeEditor | null = null;
  private model: monaco.editor.ITextModel | null = null;
  private registeredLanguages = new Set<string>();
  private registeredThemes = new Set<string>();
  private completionProviderDisposable: monaco.IDisposable | null = null;

  /**
   * Create and mount a Monaco editor instance.
   * @param options Editor creation options.
   * @returns The created editor instance.
   */
  public createEditor(options: MonacoServiceOptions): monaco.editor.IStandaloneCodeEditor {
    if (this.editor) {
      this.disposeEditor();
    }

    // Create or reuse model
    this.model = monaco.editor.createModel(
      options.value ?? '',
      options.language ?? 'plaintext'
    );

    this.editor = monaco.editor.create(options.container, {
      model: this.model,
      theme: options.theme ?? 'vs',
      readOnly: options.readOnly ?? false,
      automaticLayout: true,
      wordWrap: 'on',
      minimap: { enabled: false },
      fontSize: 16,
      smoothScrolling: true,
      lineNumbers: 'on',
      ...options.options,
    });

    return this.editor;
  }

  /**
   * Dispose the editor and clean up resources.
   */
  public disposeEditor(): void {
    if (this.editor) {
      this.editor.dispose();
      this.editor = null;
    }
    if (this.model) {
      this.model.dispose();
      this.model = null;
    }
    if (this.completionProviderDisposable) {
      this.completionProviderDisposable.dispose();
      this.completionProviderDisposable = null;
    }
  }

  /**
   * Register a custom language.
   * @param config Language configuration object.
   */
  public registerLanguage(config: MonacoLanguageConfig): void {
    if (this.registeredLanguages.has(config.id)) return;
    monaco.languages.register({
      id: config.id,
      extensions: config.extensions,
      aliases: config.aliases,
    });
    if (config.monarchTokensProvider) {
      monaco.languages.setMonarchTokensProvider(config.id, config.monarchTokensProvider);
    }
    if (config.languageConfiguration) {
      monaco.languages.setLanguageConfiguration(config.id, config.languageConfiguration);
    }
    this.registeredLanguages.add(config.id);
  }

  /**
   * Register a custom theme.
   * @param config Theme configuration object.
   */
  public registerTheme(config: MonacoThemeConfig): void {
    if (this.registeredThemes.has(config.name)) return;
    monaco.editor.defineTheme(config.name, {
      base: config.base,
      inherit: config.inherit,
      rules: config.rules,
      colors: config.colors,
    });
    this.registeredThemes.add(config.name);
  }

  /**
   * Set the editor's theme at runtime.
   * @param themeName Name of the registered theme.
   */
  public setTheme(themeName: string): void {
    monaco.editor.setTheme(themeName);
  }

  /**
   * Set the editor's language at runtime.
   * @param languageId Language ID to switch to.
   */
  public setLanguage(languageId: string): void {
    if (this.model) {
      monaco.editor.setModelLanguage(this.model, languageId);
    }
  }

  /**
   * Update editor options dynamically.
   * @param options Partial editor options.
   */
  public updateOptions(options: monaco.editor.IStandaloneEditorConstructionOptions): void {
    if (this.editor) {
      this.editor.updateOptions(options);
    }
  }

  /**
   * Get the current editor value.
   * @returns The editor's content as a string.
   */
  public getValue(): string {
    return this.model ? this.model.getValue() : '';
  }

  /**
   * Set the editor value.
   * @param value The new content for the editor.
   */
  public setValue(value: string): void {
    if (this.model) {
      this.model.setValue(value);
    }
  }

  /**
   * Focus the editor programmatically.
   */
  public focus(): void {
    this.editor?.focus();
  }

  /**
   * Get the current Monaco model.
   * @returns The ITextModel instance.
   */
  public getModel(): monaco.editor.ITextModel | null {
    return this.model;
  }

  /**
   * Programmatically trigger a registered action.
   * @param actionId The action's ID.
   */
  public triggerAction(actionId: string): void {
    this.editor?.trigger('monacoService', actionId, null);
  }

  /**
   * Register a custom action on the editor.
   * @param action Monaco editor action descriptor.
   */
  public registerAction(action: monaco.editor.IActionDescriptor): void {
    this.editor?.addAction(action);
  }

  /**
   * Register a keybinding for the editor.
   * @param keybinding Monaco keybinding (e.g., monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS).
   * @param callback Function to execute on keybinding.
   * @param context Optional context expression.
   */
  public registerKeybinding(
    keybinding: number,
    callback: () => void,
    context?: string
  ): void {
    if (!this.editor) return;
    this.editor.addCommand(keybinding, callback, context);
  }

  /**
   * Register a completion provider using templates.
   * @param languageId Language to register completions for.
   * @param templates Array of template completions.
   */
  public registerCompletions(languageId: string, templates: TemplateCompletion[]): void {
    if (this.completionProviderDisposable) {
      this.completionProviderDisposable.dispose();
    }
    this.completionProviderDisposable = monaco.languages.registerCompletionItemProvider(
      languageId,
      {
        provideCompletionItems: (model, position) => {
          const suggestions: monaco.languages.CompletionItem[] = templates.map(t => ({
            label: t.label,
            kind: t.kind ?? monaco.languages.CompletionItemKind.Snippet,
            insertText: t.insertText,
            detail: t.detail,
            documentation: t.documentation,
            range: undefined, // Monaco will infer range
          }));
          return { suggestions };
        },
        triggerCharacters: [' ', '.'],
      }
    );
  }
}

// Export a singleton instance
export const monacoService = new MonacoService();