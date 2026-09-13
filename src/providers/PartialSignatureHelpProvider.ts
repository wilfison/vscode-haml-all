import { CancellationToken, Position, SignatureHelp, SignatureHelpProvider, SignatureInformation, TextDocument } from 'vscode';
import { fileExists, fileStringLocals, getPartialName, resolvePartialFilePath } from '../utils/file';

const RENDER_BASE_REGEX = /^\s*=\s*render[\s\(]/;
const RENDER_PARTIAL_REGEX = /render[\s\(]p/;

class PartialSignatureHelpProvider implements SignatureHelpProvider {
  public async provideSignatureHelp(
    document: TextDocument,
    position: Position,
    token: CancellationToken
  ): Promise<SignatureHelp | null> {
    const lineContent = document.lineAt(position.line).text;

    if (!RENDER_BASE_REGEX.test(lineContent)) {
      return null;
    }

    if (RENDER_PARTIAL_REGEX.test(lineContent)) {
      return this.createSignature(lineContent, document, position, 'explicit');
    }

    return this.createSignature(lineContent, document, position, 'implicit');
  }

  // Read '-# locals: (option1:, option2:)' from partial file
  private async loadPartialLocals(document: TextDocument, position: Position): Promise<string> {
    const partialName = getPartialName(document, position);
    const filePaths = await resolvePartialFilePath(partialName, document.fileName);

    if (filePaths.length === 0 || filePaths.length > 1) {
      return '';
    }

    return fileStringLocals(filePaths[0]);
  }

  private async createSignature(
    lineContent: string,
    document: TextDocument,
    position: Position,
    renderType: string
  ): Promise<SignatureHelp> {
    const beforeCursor = lineContent.substring(0, position.character);
    const signature = await this.buildSignature(document, position, renderType);

    const signatureHelp = new SignatureHelp();
    signatureHelp.activeSignature = 0;
    signatureHelp.signatures = [signature];

    // One parameter per comma typed so far. There is always exactly one signature, so
    // its parameter count, not the signature count, bounds the index.
    const commas = beforeCursor.split(',').length - 1;
    const lastParameter = Math.max(signature.parameters.length - 1, 0);

    signatureHelp.activeParameter = Math.min(commas, lastParameter);

    return signatureHelp;
  }

  private async buildSignature(document: TextDocument, position: Position, renderType: string): Promise<SignatureInformation> {
    const partialVariables: string = await this.loadPartialLocals(document, position);
    let options = partialVariables.split(',').map((option: string) => option.trim() || 'option:');

    const renderOptions = this.buildRender(renderType, options);

    const signature = new SignatureInformation(renderOptions.label, 'Renders a partial with the given options.');

    signature.parameters = renderOptions.parameters.map((param) => ({ label: param }));

    return signature;
  }

  private buildRender(renderType: string, options: string[]): { label: string; parameters: string[] } {
    const partial = renderType === 'explicit' ? 'partial: location' : 'location';
    const localsExplicit = renderType === 'explicit' ? 'locals: ' : '';
    const parameters = options.length > 0 ? options.map((option) => `${option} value`) : ['option: value'];

    return {
      label: `render(${partial}, ${localsExplicit}{ ${parameters.join(', ')} })`,
      parameters: [partial, ...parameters],
    };
  }
}

export default PartialSignatureHelpProvider;
