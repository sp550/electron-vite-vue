import * as monaco from "monaco-editor";

// Dummy config – replace with your app’s config if needed.
import medicalLangConfig from "../config/medicalLangConfig.json";

export interface Template {
  label: string;
  insertText: string;
  kind?: monaco.languages.CompletionItemKind;
  documentation?: string;
  inline: boolean;
  triggerWords?: string[];
  insertTextRules?: monaco.languages.CompletionItemInsertTextRule;
}

export async function initializeMedicalLanguage() {
  monaco.languages.register({ id: "medicalLang" });
  configureMedicalLanguage();
  configureMedicalTokenizer();
  setupMedicalFoldingRangeProvider();
  monaco.editor.defineTheme("medicalTheme", {
    ...medicalLangConfig.theme,
    base: medicalLangConfig.theme.base as monaco.editor.BuiltinTheme,
  });
}

export function configureMedicalLanguage(): void {
  monaco.languages.setLanguageConfiguration("medicalLang", {
    wordPattern: /[\w\-\.]+/g,
    indentationRules: {
      decreaseIndentPattern: /^\s*(#|\/\/|\[.*\]).*$/,
      increaseIndentPattern: /^\s*(#|\/\/).*$/,
    },
    onEnterRules: [
      {
        beforeText: /^\s*-\s*.*$/,
        action: {
          indentAction: monaco.languages.IndentAction.None,
          appendText: "- ",
        },
      },
    ],
  });
}

export function configureMedicalTokenizer(): void {
  // Add a header rule if needed.
  const headerRegex = /^\/\/\s*.*/;
  const headerRule = [headerRegex.source, "header", ""];
  if (Array.isArray(medicalLangConfig.tokenizer.root)) {
    medicalLangConfig.tokenizer.root.push(headerRule);
  } else {
    console.error("Tokenizer root configuration is not valid");
  }
  monaco.languages.setMonarchTokensProvider("medicalLang", {
    tokenizer: medicalLangConfig.tokenizer as any,
  });
}

export function setupMedicalFoldingRangeProvider() {
  monaco.languages.registerFoldingRangeProvider("medicalLang", {
    provideFoldingRanges: (model) => calculateMedicalFoldingRanges(model),
  });
}

export function calculateMedicalFoldingRanges(model: monaco.editor.ITextModel) {
  const ranges: monaco.languages.FoldingRange[] = [];
  const headMarkerRegex = /-{5,}/;
  const bracketsRegex = /\[.{0,3}\]/;
  for (let i = 0; i < model.getLineCount(); i++) {
    const lineContent = model.getLineContent(i + 1);
    if (headMarkerRegex.test(lineContent) || bracketsRegex.test(lineContent)) {
      const start = i + 1;
      let end = start;
      for (let j = i + 1; j < model.getLineCount(); j++) {
        const nextLineContent = model.getLineContent(j + 1);
        if (
          headMarkerRegex.test(nextLineContent) ||
          bracketsRegex.test(nextLineContent) ||
          j === model.getLineCount() - 1
        ) {
          end = j;
          break;
        }
      }
      ranges.push({
        start,
        end,
        kind: monaco.languages.FoldingRangeKind.Region,
      });
    } else if (lineContent.trim().startsWith("//")) {
      const start = i + 1;
      let end = start;
      for (let j = i + 1; j < model.getLineCount(); j++) {
        if (
          model
            .getLineContent(j + 1)
            .trim()
            .startsWith("//")
        ) {
          end = j;
          break;
        }
      }
      ranges.push({
        start,
        end,
        kind: monaco.languages.FoldingRangeKind.Region,
      });
    }
  }
  return ranges;
}

// Dummy function to get the current patient (adapt as needed)
async function getCurrentPatient() {
  // TODO: Replace with a real implementation to fetch the current patient data
  return { name: "John Doe" };
}

// Dummy formatter to replace placeholders (adapt as needed)
function formatInsertText(text: string, data: any): string {
  return text.replace(/\{\{(.*?)\}\}/g, (match, key) => {
    const value = data[key];
    return value !== undefined ? value : match;
  });
}

export async function initializeMedicalTemplates() {
  try {
    // Assumes a templates.json file in your public folder
    const response = await fetch("/templates.json");
    if (!response.ok) {
      throw new Error(`Failed to load templates.json: ${response.status}`);
    }
    const templates: Template[] = await response.json();
    templates.forEach((tpl) => {
      tpl.inline = !!tpl.inline;
      tpl.kind = tpl.kind ?? monaco.languages.CompletionItemKind.Text;
      if ((tpl.kind as any) === "Snippet") {
        tpl.kind = monaco.languages.CompletionItemKind.Snippet;
        tpl.insertTextRules =
          monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet;
      } else {
        tpl.kind = monaco.languages.CompletionItemKind.Text;
      }
    });
    monaco.languages.registerCompletionItemProvider("medicalLang", {
      provideCompletionItems: provideCompletionItemsFunction(templates),
    });
    monaco.languages.registerInlineCompletionsProvider("medicalLang", {
      provideInlineCompletions: provideInlineCompletionsFunction(templates),
      freeInlineCompletions: () => {},
    });
  } catch (error) {
    // console.error("Error loading templates:", error);
  }
}

function provideCompletionItemsFunction(templates: Template[]) {
  return async (
    model: monaco.editor.ITextModel,
    position: monaco.Position
  ): Promise<monaco.languages.CompletionList | null> => {
    const word = model.getWordUntilPosition(position);
    const currentPatient = await getCurrentPatient();
    templates.forEach((tpl) => {
      tpl.insertText = formatInsertText(tpl.insertText, currentPatient);
    });
    const suggestions: monaco.languages.CompletionItem[] = templates.map(
      (tpl) => ({
        label: tpl.label,
        insertText: tpl.insertText,
        kind: tpl.kind ?? monaco.languages.CompletionItemKind.Text,
        insertTextRules: tpl.insertTextRules,
        range: new monaco.Range(
          position.lineNumber,
          word.startColumn,
          position.lineNumber,
          word.endColumn
        ),
      })
    );
    return { suggestions };
  };
}

function provideInlineCompletionsFunction(templates: Template[]) {
  return async (
    model: monaco.editor.ITextModel,
    position: monaco.Position
  ): Promise<monaco.languages.InlineCompletions | null> => {
    const lineContentUpToPosition = model
      .getValueInRange({
        startLineNumber: position.lineNumber,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      })
      .toLowerCase()
      .trimStart();

    if (lineContentUpToPosition.length < 2) return null;

    const currentPatient = await getCurrentPatient();
    let hasTriggerWord = false;
    const items: monaco.languages.InlineCompletion[] = templates
      .filter((tpl) => tpl.inline)
      .map((tpl) => ({
        insertText: formatInsertText(tpl.insertText, currentPatient),
        label: tpl.label,
        triggerWords: tpl.triggerWords,
        kind: tpl.kind,
      }))
      .filter((tpl) => {
        if (tpl.triggerWords && tpl.triggerWords.length > 0) {
          const match = tpl.triggerWords.find((word) =>
            word.toLowerCase().includes(lineContentUpToPosition)
          );
          if (match) {
            hasTriggerWord = true;
            return true;
          }
          return false;
        } else {
          return tpl.insertText
            .toLowerCase()
            .startsWith(lineContentUpToPosition);
        }
      })
      .map((tpl) => {
        let text: string | { snippet: string } = hasTriggerWord
          ? tpl.insertText
          : tpl.insertText.slice(lineContentUpToPosition.length);
        if (tpl.kind === monaco.languages.CompletionItemKind.Snippet) {
          text = { snippet: text };
        }
        return {
          insertText: text,
          range: new monaco.Range(
            position.lineNumber,
            position.column,
            position.lineNumber,
            position.column
          ),
          ...(hasTriggerWord
            ? {
                additionalTextEdits: [
                  {
                    text: "",
                    range: new monaco.Range(
                      position.lineNumber,
                      position.column - lineContentUpToPosition.length,
                      position.lineNumber,
                      position.column
                    ),
                  },
                ],
              }
            : {}),
        };
      });
    return { items };
  };
}
