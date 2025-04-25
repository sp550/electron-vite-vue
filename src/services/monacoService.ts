import * as monaco from 'monaco-editor';
import { loadMedicalLangConfig, loadTemplates } from '@/composables/useConfig';

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
  colors?: monaco.editor.IColors;
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
    const themeData: monaco.editor.IStandaloneThemeData = {
      base: config.base,
      inherit: config.inherit,
      rules: config.rules,
      colors: config.colors ?? {},
    };
    monaco.editor.defineTheme(config.name, themeData);
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
    // As of Monaco 0.44.0+, addAction expects a monaco.editor.IActionDescriptor, but the type is now in monaco.editor.IActionDescriptor2
    // We'll support both for compatibility, but prefer IActionDescriptor2 if available.
    this.editor?.addAction(action as any);
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
    // addCommand expects a handler function and an optional context key expression (string or undefined)
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
        provideCompletionItems: (
          model: monaco.editor.ITextModel,
          position: monaco.Position,
          context: monaco.languages.CompletionContext // Add context parameter
        ): monaco.languages.ProviderResult<monaco.languages.CompletionList> => {

          // Only provide suggestions if triggered manually (e.g., Ctrl+Space)
          if (context.triggerKind !== monaco.languages.CompletionTriggerKind.Invoke) {
            return { suggestions: [] }; // Return empty list if not invoked manually
          }

          const word = model.getWordUntilPosition(position);
          const range = new monaco.Range(
            position.lineNumber,
            word.startColumn,
            position.lineNumber,
            word.endColumn
          );
          const suggestions: monaco.languages.CompletionItem[] = templates.map(t => ({
            label: t.label,
            kind: t.kind ?? monaco.languages.CompletionItemKind.Snippet,
            insertText: t.insertText,
            detail: t.detail,
            documentation: t.documentation,
            range,
          }));
          return { suggestions };
        },
      }
    );
  }
  /**
   * Register all custom keybindings and editor actions for the application.
   * This method should be called after the editor is created.
   * It encapsulates all custom Monaco logic, ensuring strong typing and modularity.
   *
   * Keybindings and actions include:
   * - Quick Command Palette
   * - Inline Suggest Trigger
   * - Trigger Suggest
   * - Fold Level 1
   * - Patient navigation (up/down)
   * - Select whole note text
   * - Checkbox toggles (0, 1, 2)
   * - Reindent lines
   * - WholeMonths notes
   *
   * Actions that depend on not-yet-implemented logic use placeholder async functions with TODOs.
   */
  public registerCustomKeybindingsAndActions(): void {
    if (!this.editor) return;

   
    // --- Keybindings registration ---
    // Helper to register a keybinding and (optionally) an action
    const registerKeybinding = (
      keybinding: number,
      _actionId: string,
      callback: (editor: monaco.editor.IStandaloneCodeEditor) => void
    ) => {
      this.editor!.addCommand(keybinding, () => callback(this.editor!), undefined);
    };

    // Keybindings map (actionId -> keybinding(s))
    const keybindings: Record<string, number | number[]> = {
      'editor.action.quickCommand': monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyP,
      'editor.action.inlineSuggest.trigger': monaco.KeyMod.Shift | monaco.KeyCode.Space,
      'editor.action.triggerSuggest': monaco.KeyMod.CtrlCmd | monaco.KeyCode.Space,
      'editor.foldLevel1': monaco.KeyCode.F3,
      'select-whole-note-text': monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyC,
      'checkbox-0': monaco.KeyMod.CtrlCmd | monaco.KeyCode.Digit0,
      'checkbox-1': monaco.KeyMod.CtrlCmd | monaco.KeyCode.Digit1,
      'checkbox-2': monaco.KeyMod.CtrlCmd | monaco.KeyCode.Digit2,
      'editor.action.reindentlines': monaco.KeyMod.Alt | monaco.KeyMod.Shift | monaco.KeyCode.KeyF,
    };

    // Register keybindings
    Object.entries(keybindings).forEach(([actionId, key]) => {
      if (Array.isArray(key)) {
        key.forEach(k =>
          registerKeybinding(k, actionId, () => this.triggerAction(actionId))
        );
      } else {
        registerKeybinding(key, actionId, () => this.triggerAction(actionId));
      }
    });

    // --- Editor actions registration ---
    // Fold Level 1
    this.editor.addAction({
      id: 'editor.foldLevel1',
      label: 'Fold Level 1',
      contextMenuGroupId: 'organisation',
      contextMenuOrder: 1.1,
      run: (editor) => {
        const action = editor.getAction('editor.foldLevel1');
        if (action) {
          action.run();
        }
      },
    });


  }
  /**
   * Loads and merges language configuration for 'medicalLang' from config/medicalLangConfig.json
   * and applies it using Monaco's latest API. This method is modular and extensible for future config changes.
   *
   * - Loads Monarch tokens from config file and merges with provided tokens (code config takes precedence).
   * - Applies provided language configuration (word pattern, indentation rules, onEnter rules).
   * - Registers the language and configuration with Monaco.
   *
   * @param languageId The Monaco language ID (e.g., 'medicalLang' or 'medicalLang').
   * @param languageConfiguration Monaco language configuration (word pattern, indentation rules, onEnter rules).
   * @param monarchTokensProvider Optional Monarch tokens provider (if not provided, loaded from config).
   * @returns Promise<void>
   */
  public async registerLanguageConfiguration(
    languageId: string,
    languageConfiguration: monaco.languages.LanguageConfiguration,
    monarchTokensProvider?: monaco.languages.IMonarchLanguage
  ): Promise<void> {
    // Dynamically import config (avoids bundling, works in Electron/Vite context)
    const config = await loadMedicalLangConfig();

    // Extract Monarch tokens from config if not provided
    let monarchTokens: monaco.languages.IMonarchLanguage | undefined = monarchTokensProvider;
    if (!monarchTokens && config.language && config.language.tokenizer) {
      monarchTokens = {
        tokenizer: config.language.tokenizer,
        // Optionally add more Monarch fields if present in config
      } as monaco.languages.IMonarchLanguage;
    }

    // Extract extensions and aliases from config if present
    const extensions: string[] | undefined = config.language?.extensions;
    const aliases: string[] | undefined = config.language?.aliases;

    // Register language if not already registered
    if (!this.registeredLanguages.has(languageId)) {
      monaco.languages.register({
        id: languageId,
        extensions,
        aliases,
      });
      this.registeredLanguages.add(languageId);
    }

    // Set Monarch tokens provider (code config takes precedence)
    if (monarchTokens) {
      monaco.languages.setMonarchTokensProvider(languageId, monarchTokens);
    }

    // Set language configuration (word pattern, indentation rules, onEnter rules)
    monaco.languages.setLanguageConfiguration(languageId, languageConfiguration);
  }
  /**
   * Extends the Monarch tokenizer for the specified language by merging rules from config/medicalLangConfig.json
   * and adding a custom header rule (if not already present), then registers the Monarch tokens provider.
   *
   * - Loads tokenizer rules from config file.
   * - Adds the custom header rule: ["^//\\s*.*", "header"] (if not present).
   * - Merges rules, avoiding duplication.
   * - Registers the Monarch tokens provider for the language.
   *
   * @param languageId The Monaco language ID to extend (default: "medicalLang").
   * @returns Promise<void>
   */
  public async extendTokenizerAndRegisterProvider(languageId: string = "medicalLang"): Promise<void> {
    // Fetch config dynamically (avoids bundling, works in Electron/Vite context)
    const config = await loadMedicalLangConfig();

    // Extract tokenizer rules from config
    const tokenizer: Record<string, any[]> = config.language?.tokenizer;
    if (!tokenizer) {
      console.warn("Medical language tokenizer configuration is empty.");
    } else if (!Array.isArray(tokenizer.root)) {
       console.warn("Medical language tokenizer root is not an array.");
    }

    // // Define the custom header rule (from old project)
    // const customHeaderRule: [string, string] = ["^//\\s*.*", "header"];

    // // Check if the custom header rule is already present (by pattern and token)
    // const hasHeaderRule = tokenizer.root.some(
    //   (rule: any) =>
    //     Array.isArray(rule) &&
    //     rule[0] === customHeaderRule[0] &&
    //     rule[1] === customHeaderRule[1]
    // );

    // // Add the custom header rule if not present
    // if (!hasHeaderRule) {
    //   tokenizer.root.unshift(customHeaderRule);
    // }

    // Build the Monarch tokens provider object
    const monarchTokensProvider: monaco.languages.IMonarchLanguage = {
      tokenizer: tokenizer,
    };

    // Register the Monarch tokens provider for the language
    monaco.languages.setMonarchTokensProvider(languageId, monarchTokensProvider);
  }
/**
   * Registers a folding range provider for the specified language.
   * Encapsulates all custom folding logic (head markers, brackets, subhead markers).
   * @param languageId The Monaco language ID (e.g., 'medicalLang').
   */
  public registerFoldingRangeProvider(languageId: string): void {
    monaco.languages.registerFoldingRangeProvider(languageId, {
      provideFoldingRanges: (model, context, token) => {
        return this._computeFoldingRanges(model);
      }
    });
  }

  /**
   * Computes folding ranges for the given model using custom logic:
   * - Head markers (e.g., lines starting with '##')
   * - Brackets (folding between { ... } and [ ... ])
   * - Subhead folding markers (e.g., lines starting with '###')
   * @param model The Monaco text model.
   * @returns Array of FoldingRange objects.
   */
  private _computeFoldingRanges(model: monaco.editor.ITextModel): monaco.languages.FoldingRange[] {
    const ranges: monaco.languages.FoldingRange[] = [];
    const stack: { start: number, type: 'bracket' | 'head' | 'subhead', marker?: string }[] = [];
    const headRegex = /^##\s/;
    const subheadRegex = /^###\s/;
    const openBrackets = ['{', '['];
    const closeBrackets = ['}', ']'];
    const bracketMap: Record<string, string> = { '{': '}', '[': ']' };

    for (let i = 0; i < model.getLineCount(); i++) {
      const lineNumber = i + 1;
      const line = model.getLineContent(lineNumber);

      // Head marker
      if (headRegex.test(line)) {
        // Close previous head or subhead
        while (stack.length && (stack[stack.length - 1].type === 'head' || stack[stack.length - 1].type === 'subhead')) {
          const prev = stack.pop()!;
          if (lineNumber - 1 > prev.start) {
            ranges.push({
              start: prev.start,
              end: lineNumber - 1,
              kind: prev.type === 'head' ? monaco.languages.FoldingRangeKind.Region : undefined
            });
          }
        }
        stack.push({ start: lineNumber, type: 'head' });
        continue;
      }

      // Subhead marker
      if (subheadRegex.test(line)) {
        // Close previous subhead
        while (stack.length && stack[stack.length - 1].type === 'subhead') {
          const prev = stack.pop()!;
          if (lineNumber - 1 > prev.start) {
            ranges.push({
              start: prev.start,
              end: lineNumber - 1,
              kind: undefined
            });
          }
        }
        stack.push({ start: lineNumber, type: 'subhead' });
        continue;
      }

      // Bracket folding
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (openBrackets.includes(char)) {
          stack.push({ start: lineNumber, type: 'bracket', marker: char });
        } else if (closeBrackets.includes(char)) {
          // Find matching open
          for (let k = stack.length - 1; k >= 0; k--) {
            if (stack[k].type === 'bracket' && bracketMap[stack[k].marker!] === char) {
              const open = stack.splice(k, 1)[0];
              if (lineNumber > open.start) {
                ranges.push({
                  start: open.start,
                  end: lineNumber,
                  kind: monaco.languages.FoldingRangeKind.Region
                });
              }
              break;
            }
          }
        }
      }
    }

    // Close any remaining open regions
    while (stack.length) {
      const open = stack.pop()!;
      if (model.getLineCount() > open.start) {
        ranges.push({
          start: open.start,
          end: model.getLineCount(),
          kind: open.type === 'head' ? monaco.languages.FoldingRangeKind.Region : undefined
        });
      }
    }

    return ranges;
  }
  /**
   * Loads template completions from /public/templates.json.
   * @returns Promise<TemplateCompletion[]>
   */
  private async _loadTemplates(): Promise<TemplateCompletion[]> {
    const templates = await loadTemplates();
    // Optionally infer kind for each template
    return templates.map((t: Omit<TemplateCompletion, 'kind'>) => ({
      ...t,
      kind: this._inferTemplateKind(t),
    }));
  }

  /**
   * Loads key terms from /config/medicalLangConfig.json.
   * @returns Promise<string[]>
   */
  private async _loadKeyTerms(): Promise<string[]> {
    const config = await loadMedicalLangConfig();
    return Array.isArray(config.keyTerms) ? config.keyTerms : [];
  }

  /**
   * Infers the Monaco CompletionItemKind for a template.
   * Extend this logic as needed for more kinds.
   * @param template The template object.
   * @returns monaco.languages.CompletionItemKind
   */
  private _inferTemplateKind(template: { label: string; insertText: string }): monaco.languages.CompletionItemKind {
    // Heuristic: If insertText contains a placeholder or newline, treat as Snippet, else Text
    if (/\$\{\d+:|[\n]/.test(template.insertText)) {
      return monaco.languages.CompletionItemKind.Snippet;
    }
    return monaco.languages.CompletionItemKind.Text;
  }

  /**
   * Registers a completion item provider for 'medicalLang' using templates from /public/templates.json.
   * This replaces any previous provider for the language.
   */
  public async registerMedicalLangCompletionProvider(): Promise<void> {
    const templates = await this._loadTemplates();
    this.registerCompletions('medicalLang', templates);
  }

  /**
   * Registers an inline completion provider for 'medicalLang' that suggests all templates (including snippets)
   * and patient data placeholders (TODO: implement patient data logic).
   * This provider uses template trigger words and placeholder logic.
   */
  public async registerMedicalLangTemplateInlineCompletionProvider(): Promise<void> {
    // Inline completion provider for templates and patient data
    const templates = await this._loadTemplates();
    // TODO: Integrate patient data completions (see below)
    monaco.languages.registerInlineCompletionsProvider('medicalLang', {
      /**
       * Provide inline completions for templates and patient data.
       * @param model The Monaco text model.
       * @param position The current cursor position.
       * @param context The inline completion context.
       * @param token The cancellation token.
       */
      provideInlineCompletions: (model, position, context, token) => {
        const textUntilPosition = model.getValueInRange({
          startLineNumber: 1,
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: position.column,
        });
        // Suggest templates if their label or insertText matches the last word
        const lastWordMatch = textUntilPosition.match(/(\w+)$/);
        const lastWord = lastWordMatch ? lastWordMatch[1].toLowerCase() : '';
        const suggestions = templates
          .filter(t =>
            t.label.toLowerCase().includes(lastWord) ||
            t.insertText.toLowerCase().includes(lastWord)
          )
          .map(t => ({
            insertText: t.insertText,
            filterText: t.label,
            range: {
              startLineNumber: position.lineNumber,
              startColumn: position.column - lastWord.length,
              endLineNumber: position.lineNumber,
              endColumn: position.column,
            },
            command: undefined,
          }));

        // TODO: Add patient data inline completions here
        // Example: suggestions.push({ insertText: '${patientName}', ... })
        // Placeholder for patient data completions
        // suggestions.push({
        //   insertText: '${patientName}', // TODO: Replace with real patient data
        //   filterText: 'patientName',
        //   range: { ... },
        //   command: undefined,
        // });

        return { items: suggestions, dispose: () => {} };
      },
      handleItemDidShow: () => {},
      freeInlineCompletions: () => {},
    });
  }

  /**
   * Registers an inline completion provider for 'medicalLang' that suggests only key terms from config.
   */
  public async registerMedicalLangKeyTermInlineCompletionProvider(): Promise<void> {
    const keyTerms = await this._loadKeyTerms();
    monaco.languages.registerInlineCompletionsProvider('medicalLang', {
      /**
       * Provide inline completions for key terms.
       * @param model The Monaco text model.
       * @param position The current cursor position.
       * @param context The inline completion context.
       * @param token The cancellation token.
       */
      provideInlineCompletions: (model, position, context, token) => {
        const textUntilPosition = model.getValueInRange({
          startLineNumber: 1,
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: position.column,
        });
        const lastWordMatch = textUntilPosition.match(/(\w+)$/);
        const lastWord = lastWordMatch ? lastWordMatch[1].toLowerCase() : '';

// DEBUG LOG: Show lastWord and suggestions
console.log('[InlineCompletion] lastWord:', lastWord);
        // Only provide suggestions if the last word exists and has at least 3 characters
        if (!lastWord || lastWord.length < 3) {
          return null;
        }

// DEBUG LOG: Show suggestions
        const suggestions = keyTerms
          .filter(term => term.toLowerCase().startsWith(lastWord))
          .map(term => ({
            insertText: term,
            filterText: term,
            range: {
              startLineNumber: position.lineNumber,
              startColumn: position.column - lastWord.length,
              endLineNumber: position.lineNumber,
              endColumn: position.column,
            },
            command: undefined,
          }));

        // DEBUG LOG: Show suggestions
        console.log('[InlineCompletion] suggestions:', suggestions);

        return { items: suggestions, dispose: () => {} };
      },
      handleItemDidShow: () => {},
      freeInlineCompletions: () => {},
    });
  }
/**
   * Initializes all Monaco Editor customizations for a given editor instance.
   *
   * This is the single entry point for setting up Monaco customizations in the application.
   * It orchestrates the registration and application of language configuration, theme, actions,
   * keybindings, tokenizer, folding, and completion providers. This method should be called
   * every time a new Monaco editor instance is created to ensure all customizations are (re)applied.
   *
   * @param editorInstance The Monaco editor instance to customize.
   * @returns Promise<void>
   *
   * Usage:
   *   await monacoService.initializeMonacoCustomizations(editorInstance);
   */
  public async initializeMonacoCustomizations(
    editorInstance: monaco.editor.IStandaloneCodeEditor
  ): Promise<void> {
    // Set the current editor instance for per-instance registrations
    this.editor = editorInstance;

    // 1. Register language configuration and tokenizer
    // 1. Register language configuration and tokenizer using config
    await this.registerLanguageConfiguration(
      'medicalLang',
      {
        // // Provide minimal config; real config is loaded/merged in the method
        // wordPattern: /(-?\d*\.\d\w*)|([^\`\~\!\@\#\%\^\&\*\(\)\=\+\[\{\]\}\\\|\;\:\'\"\,\<\>\/\?\s]+)/g,
        // comments: {
        //   lineComment: '//'
        // },
        // autoClosingPairs: [
        //   { open: '{', close: '}' },
        //   { open: '[', close: ']' },
        //   { open: '(', close: ')' },
        //   { open: '"', close: '"' },
        //   { open: "'", close: "'" }
        // ]
      }
    );
    await this.extendTokenizerAndRegisterProvider('medicalLang');

    // 2. Register folding provider
    this.registerFoldingRangeProvider('medicalLang');

    // 3. Register and set theme from config/medicalLangConfig.json
    const config = await loadMedicalLangConfig();
    if (config.theme) {
      const themeConfig = {
        name: config.theme.id || 'medicalLang-theme',
        base: config.theme.base || 'vs',
        inherit: config.theme.inherit !== undefined ? config.theme.inherit : true,
        rules: config.theme.rules || [],
        colors: config.theme.colors || {}
      };
      this.registerTheme(themeConfig);
      this.setTheme(themeConfig.name);
    }

    // 4. Register completion providers
    await this.registerMedicalLangCompletionProvider();
    await this.registerMedicalLangTemplateInlineCompletionProvider();
    await this.registerMedicalLangKeyTermInlineCompletionProvider();

    // 5. Register custom actions and keybindings for this editor instance
    this.registerCustomKeybindingsAndActions();
  }
}

/**
 * Export a singleton instance of MonacoService.
 */
export const monacoService = new MonacoService();