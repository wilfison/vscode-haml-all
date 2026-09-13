# PRD: Correções de segurança (relatório de análise v3.1.0)

Origem: `tmp/relatorio-analise.md`, seção 3 (S1-S5), 2026-09-12, branch `main` @ `1ba0eb8`.

## 1. Introdução

A extensão declara no manifesto que suporta workspaces não confiáveis de forma "limitada", mas nenhum código consulta `workspace.isTrusted`. Ao abrir um `.haml` em um repositório não confiável, a ativação executa código do próprio repositório (`bin/rails routes -E`, `Gemfile` via `bundle exec`, `require:` em `.haml-lint.yml`). Isso é execução remota de código (RCE) por simplesmente abrir um arquivo.

Além do vetor principal, o relatório aponta: instalação automática de gem sem consentimento no servidor Ruby (S2), webview sem Content Security Policy e com interpolação sem escape (S3), autenticação do servidor TCP que fica aberta quando o token está vazio (S4) e endurecimento de CI/supply chain (S5).

Este PRD cobre **apenas** os itens de segurança. Bugs funcionais (B1-B20) e melhorias (M1-M9) ficam para PRDs próprios.

## 2. Objetivos

- Nenhum processo externo (`ruby`, `bin/rails`, `bundle`, `haml-lint`, `html2haml`) é iniciado enquanto o workspace não for confiável.
- Ao conceder confiança (`onDidGrantWorkspaceTrust`), o restante da extensão ativa sem precisar recarregar a janela.
- Configurações que alteram *o que* é executado (`hamlAll.useBundler`) não podem ser definidas por `.vscode/settings.json` do repositório em modo restrito.
- O servidor Ruby nunca instala gems por conta própria.
- A webview de preview de imagem tem CSP, não executa scripts e escapa todo valor interpolado.
- O servidor TCP recusa iniciar sem token, salvo opt-in explícito.
- CI falha em vulnerabilidade `high`/`critical` de dependência npm e usa actions pinadas por SHA.

## 3. User Stories

### US-001: Gate de Workspace Trust na ativação

**Descrição:** Como usuário que abre um repositório desconhecido em Modo Restrito, quero que a extensão não execute nada do repositório para que abrir um `.haml` não seja um vetor de RCE.

**Critérios de aceite:**

- [ ] Em `src/extension.ts`, `activate()` checa `vscode.workspace.isTrusted`. Se `false`: não cria/inicia `LintServer`, não chama `hamlLintPresent()`, não chama `Routes.load()` nem registra os watchers de rotas, e não registra `FormattingEditProvider` nem `FixActionsProvider` (dependem do servidor).
- [ ] Em modo restrito continuam ativos: highlighting, snippets, `language-configuration`, `ViewCompletionProvider`, `ViewFileDefinitionProvider`, `PartialSignatureHelpProvider`, `ViewCodeActionProvider`, `CodeLensProvider`, `DataAttributeCompletionProvider`, `AssetsCompletionProvider`, `AssetsDefinitionProvider`, `ImagePreviewCodeLensProvider` (nenhum deles spawna processo).
- [ ] O comando `hamlAll.html2Haml` em modo restrito exibe `showWarningMessage("Trust the workspace to run html2haml.")` e retorna sem executar nada.
- [ ] `activate()` registra `vscode.workspace.onDidGrantWorkspaceTrust` (em `context.subscriptions`) que executa a parte gated uma única vez, sem exigir "Reload Window".
- [ ] O output channel "Haml" registra uma linha `Workspace is not trusted: Ruby tooling disabled.` quando o gate bloqueia.
- [ ] Verificação manual documentada no PR: abrir um repo com `bin/rails` executável que escreve em `/tmp/pwned` em Modo Restrito → arquivo **não** é criado; após "Trust", rotas carregam e lint funciona (`ps aux | grep server.rb` mostra o processo só depois do trust).
- [ ] `npm run compile` (typecheck + lint) passa.

### US-002: Restringir `hamlAll.useBundler` em workspaces não confiáveis

**Descrição:** Como usuário, quero que o repositório não consiga forçar `bundle exec` via `.vscode/settings.json` para que o `Gemfile` do repo não seja carregado sem minha confiança.

**Critérios de aceite:**

- [ ] `package.json` → `capabilities.untrustedWorkspaces.restrictedConfigurations` contém `"hamlAll.useBundler"`.
- [ ] `hamlAll.lintEnabled` **não** é restrito (não muda o que é executado).
- [ ] Manifesto continua com `supported: "limited"`; a `description` é atualizada para dizer que linting, formatação, rotas e html2haml ficam desabilitados até o workspace ser confiável.
- [ ] README ganha uma subseção "Workspace Trust" (3-5 linhas) listando o que fica desabilitado em Modo Restrito.

### US-003: Remover `gem install` automático do servidor Ruby

**Descrição:** Como usuário, não quero que a extensão instale gems no meu `GEM_HOME` sem pedir, para não ter acesso à rede e escrita no ambiente Ruby sem consentimento.

**Critérios de aceite:**

- [ ] `lib/server.rb` não contém `system("gem", "install", ...)` nem `retry` no `rescue LoadError`.
- [ ] No `LoadError`, o servidor escreve em stderr `haml_lint gem not found. Install it with: gem install haml_lint (or add it to your Gemfile and enable hamlAll.useBundler).` e sai com código 1.
- [ ] A rejeição de `startRubyServer` (que já inclui a cauda do stderr) é mostrada ao usuário via `showErrorMessage` contendo a instrução de instalação (hoje a mensagem "haml-lint not found" vem só do probe `--version`).
- [ ] `bundle exec rake test` e `bundle exec rubocop` passam com 0 ofensas.

### US-004: CSP e escape na webview de preview de imagem

**Descrição:** Como usuário, quero que a webview de preview não execute scripts nem interprete nomes de arquivo como HTML, para que um nome de arquivo malicioso no repo nunca vire XSS na webview.

**Critérios de aceite:**

- [ ] `createWebviewPanel` usa `enableScripts: false`.
- [ ] `templates/webview_image_preview.html` tem `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src {{cspSource}} https:; style-src 'unsafe-inline';">`, com `{{cspSource}}` substituído por `panel.webview.cspSource`.
- [ ] O template não contém `<script>`, `onload` ou `onerror`; a linha "Dimensions" é removida.
- [ ] Todo valor interpolado (`imageName`, `imagePath`, `imageSize`, `imageExt`, `imageUri`) passa por uma função `escapeHtml` (escapa `& < > " '`) antes do `replace`. Reusar se já existir helper equivalente em `src/utils/`; senão, uma função de 1 linha em `src/utils/haml.ts` ou no próprio provider.
- [ ] `findImagePath` só aceita URL remota com prefixo `https://`; `http://` retorna `null` (sem codelens).
- [ ] `showImagePreview` usa `fs.statSync(imagePath, { throwIfNoEntry: false })`; se o arquivo sumiu, exibe `showErrorMessage("Image not found: <imagePath>")` e não abre a webview.
- [ ] Teste unitário em `src/test/providers/ImagePreviewCodeLensProvider.test.ts`: `getWebviewContent` (tornar `static` acessível para teste, ou extrair `renderTemplate`) com `imageName = '<img src=x onerror=alert(1)>'` produz HTML sem `<img src=x` literal e com a entidade `&lt;img`.
- [ ] Verificação manual: preview de imagem local e `https://` abre e renderiza a imagem; sem erro de CSP no DevTools da webview.

### US-005: Servidor TCP falha fechado sem token

**Descrição:** Como usuário que roda `ruby lib/server.rb start` manualmente, quero que o servidor recuse iniciar sem token, para não deixar um endpoint que executa Ruby aberto a qualquer processo local sem perceber.

**Critérios de aceite:**

- [ ] `lib/server.rb`: se `ENV["HAML_LINT_SERVER_TOKEN"]` estiver vazio e `ARGV` não contiver `--no-auth`, escreve `Refusing to start without HAML_LINT_SERVER_TOKEN. Pass --no-auth to run unauthenticated (local development only).` em stderr e sai com código 1.
- [ ] `Controller#authorized?` mantém o comportamento "pula auth quando vazio" apenas quando `--no-auth` foi passado (flag propagada como atributo de classe/constante, sem variável global); com token vazio e sem a flag, retorna `false`.
- [ ] `test/test_helper.rb` define `ENV["HAML_LINT_SERVER_TOKEN"]` fixo (ex.: `"test-token"`) e `FakeClient`/`lint_request` incluem o token, para que os testes existentes continuem passando.
- [ ] Novo teste em `test/lib/lint_server/controller_test.rb` (ou existente): token vazio + sem `--no-auth` → resposta `Unauthorized`.
- [ ] Comentário em `AGENTS.md` (seção Ruby Server Bridge) atualizado com a flag `--no-auth`.
- [ ] `bundle exec rake test` e `bundle exec rubocop` passam.

### US-006: Endurecimento de CI

**Descrição:** Como mantenedor, quero que o CI alerte sobre CVEs em dependências npm e que as actions sejam imutáveis, para reduzir risco de supply chain.

**Critérios de aceite:**

- [ ] `.github/workflows/ci.yml` tem um step `npm audit --audit-level=high` logo após `npm ci`.
- [ ] Em `ci.yml` e `release.yml`, `actions/checkout`, `actions/setup-node` e `ruby/setup-ruby` são referenciados por SHA completo de 40 caracteres com comentário `# vX.Y.Z` ao lado.
- [ ] CI verde em um PR de teste.

## 4. Requisitos funcionais

- FR-1: Em `workspace.isTrusted === false`, a extensão não deve chamar `spawn`, `exec`, `execFile` ou `execSync` por nenhum caminho de código (ativação, comandos, watchers).
- FR-2: A extensão deve completar a ativação em modo restrito (providers puros) e ativar o restante ao receber `onDidGrantWorkspaceTrust`, exatamente uma vez.
- FR-3: `hamlAll.useBundler` deve constar em `restrictedConfigurations`.
- FR-4: `lib/server.rb` não deve executar `gem install`; em `LoadError` deve falhar com mensagem instrutiva e exit 1.
- FR-5: A webview de preview deve ter CSP `default-src 'none'`, `enableScripts: false`, e todo valor interpolado escapado.
- FR-6: URLs remotas de imagem devem ser aceitas apenas com esquema `https:`.
- FR-7: O servidor Ruby deve recusar iniciar sem token salvo `--no-auth`.
- FR-8: CI deve rodar `npm audit --audit-level=high` e usar actions pinadas por SHA.

## 5. Não-objetivos

- Não corrigir bugs funcionais B1-B20 nem melhorias M1-M9 (exceto o mínimo tocado acima).
- Não adicionar comando "Restart server", status bar ou watchdog (M1): vão em PRD próprio.
- Não mudar `untrustedWorkspaces.supported` para `false`: highlighting e completions puras devem seguir funcionando em Modo Restrito.
- Não passar o token via stdin (S4): mesmo trust boundary de `/proc/<pid>/environ`, ganho marginal.
- Não confinar `file_path` do request nem truncar `backtrace` em `Dispatcher.error` (S4): já avaliados como aceitáveis.
- Não reativar Dependabot: removido deliberadamente em `9f7cb8d`; `npm audit` no CI cobre o alerta.
- Não adicionar job Windows ao CI (pertence a B9).

## 6. Considerações técnicas

- **Ponto único de gate**: a divisão natural é `ExtensionActivator.activate()` → extrair `activateTrusted()` (servidor, probe, `EventSubscriber.subscribeRails`, formatting/fix providers) e chamá-la de `activate()` ou do listener de trust. `LintServer` só deve ser instanciado dentro de `activateTrusted()`; `deactivate()` deve tolerar `lintServer === undefined` (já tolera).
- **`EventSubscriber`** hoje faz `subscribeRails()` dentro de `subscribe()`; separar em duas chamadas para que a parte HAML pura rode sempre e a Rails só após trust. `isARailsProject` (só `existsSync`) pode rodar em modo restrito sem risco.
- **Settings**: `railsRoutes.railsCommand` e `hamlAll.linterExecutablePath` já são `machine`-scoped; nada a fazer neles.
- **Testes de extensão** (`vscode-test`) rodam com workspace confiável; o gate é verificado manualmente. Os helpers puros (`escapeHtml`, template) recebem teste unitário.
- **Escape HTML**: verificar `src/utils/` antes de escrever; não adicionar dependência para isso.
- **Ruby tests**: `test/test_helper.rb` centraliza o token; `FakeClient`/`lint_request` são o único ponto que monta requests nos testes.

## 7. Métricas de sucesso

- Repo malicioso de teste (`bin/rails` que escreve arquivo) não executa em Modo Restrito.
- `grep -rn "gem\", \"install" lib/` retorna vazio.
- Teste de XSS na webview passa; DevTools da webview sem violação de CSP.
- `ruby lib/server.rb start` sem token sai com código 1.
- CI passa com `npm audit` e SHAs pinados; suíte Ruby (35+ testes) e TS verdes.

## 8. Decisões registradas

Sem questões em aberto. Pontos que admitiam mais de uma leitura, com a decisão tomada:

- **Linha "Dimensions" da webview (US-004): removida.** Mantê-la exigiria `enableScripts: true` ou um parser de cabeçalho PNG/JPEG no lado da extensão. Nenhum dos dois vale a superfície extra para um dado cosmético.
- **Servidor sem token (US-005): flag `--no-auth` explícita.** Gerar e imprimir um token automaticamente seria mais código para atender só a execuções manuais de desenvolvimento, que já sabem o que estão fazendo ao passar a flag.
- **`npm audit` no CI (US-006): bloqueia o merge em `high`/`critical`.** Um step que só avisa é ignorado; se um falso positivo travar o CI, usar `overrides` no `package.json` (padrão já adotado para o `mocha`) em vez de `continue-on-error`.
- **Manifesto (US-001/002): permanece `supported: "limited"`.** Highlighting, snippets e completions puras funcionam em Modo Restrito; só a cadeia Ruby fica gated.
- **Dependabot (US-006): não reativar.** Removido de propósito em `9f7cb8d`; o `npm audit` no CI cobre o alerta de CVE.
