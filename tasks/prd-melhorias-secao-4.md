# PRD: Melhorias no que já existe (M1–M9, residual)

Origem: `tmp/relatorio-analise.md`, seção 4 ("Melhorias no que já existe") e seção 7 (plano residual). Data: 2026-09-12, branch `main` @ `0be1219`. Cobre **só o que sobrou** de M1–M9 depois dos três PRDs anteriores; o que já está ✅ no relatório não é repetido aqui.

## 1. Introdução / Visão geral

Os PRDs de segurança, bugs e fix-all deixaram a extensão correta e testada, mas com um resíduo de nove itens de "qualidade do que já existe". Eles caem em quatro grupos:

1. **Código que sobrou de uma era anterior.** `src/formatter/` reimplementa cops do haml-lint com regex para haml_lint < 0.74 (2024), e continua rodando por cima do autocorrect nativo quando o servidor ainda não respondeu `list_cops` (M3). `Routes.CACHE_TTL` expira rotas a cada 5 min sem motivo, já que o `mtime` de `routes.rb` e o watcher já cobrem a invalidação (M5).
2. **Feedback e configuração incompletos.** Não há indicador visual do estado do servidor; a única sinalização é uma notificação de erro quando o restart esgota as tentativas (M1). `hamlAll.useBundler` e `hamlAll.rubyCommand` são lidos uma vez na ativação: mudá-los exige reload da janela, e o comando de restart também não relê (M2). Não há como desligar o lint ao digitar (M2).
3. **Resolução de arquivos frágil.** `resolvePartialFilePath` só olha o diretório da view atual ou um caminho sob o primeiro `app/views/`; `render @user`, `collection:`, variantes (`.turbo_stream.haml`, `+mobile`) e engines no repositório não resolvem; `ViewCompletionProvider` roda `findFiles` a cada tecla e `PartialSignatureHelpProvider` lê o partial do disco a cada tecla (M4). `RoutesDefinitionProvider` só procura em `app/controllers/` da raiz (M5). O servidor de lint atende só a primeira pasta do workspace, e `Report.safe_config_file` rejeita o `.haml-lint.yml` de qualquer outra pasta (M6).
4. **Higiene.** Dois providers que não dependem de Rails só são registrados em projetos Rails (M7); o preview de imagem tenta resolver **toda** string entre aspas da linha (M7); `haml-configuration.json` não tem `wordPattern`, então `data-controller` e `@user` são duas palavras (M8); `-# locals: (user:, title: nil)` é colorido como comentário (M8); ~30 `path.join` repetidos em `getAssetDirectories` e 6 cópias do bloco `startsWith('data-') || ...` (M9); dedup de ofensas por `line:message` sem `linter_name` (M6).

### Decisões do mantenedor (2026-09-12) que definem o escopo

Respondidas via questionário ao abrir este PRD; detalhadas em §9.

| Item | Decisão |
|---|---|
| M3 formatter legado | **Apagar `src/formatter/`**, sem versão mínima de haml_lint. Com < 0.74, o Format usa só o servidor e avisa uma vez por sessão. |
| M2 `useBundler`/`rubyCommand` | **Reiniciar o servidor automaticamente** ao mudar a setting. |
| M2 lint ao digitar | **Só `hamlAll.lintOnType`** (boolean). Debounce fica fixo em 300 ms. |
| M1 status bar | **Só com `.haml` ativo, três estados** (iniciando / ok / aviso). Clique abre o output "Haml". |
| M4 partials | **Índice completo**: `collection:`, `render @user`, variantes, múltiplos `app/views`, cache por mtime no signature help. |
| M5 rotas | **Um item por rota** com snippet `path\|url` (como hoje); remover o TTL e ampliar o gatilho. |
| M6 multi-root | **Um `LintServer` por workspace folder.** Rotas e assets continuam na pasta 0. |
| M6 `Linter.clear` ao fechar aba | **Manter** o comportamento atual. |

### Fatos verificados que limitam o escopo

- `HamlLint::Lint` (haml_lint 0.78.0, `lib/haml_lint/lint.rb`) expõe `line`, `message`, `linter`, `severity`, `corrected`, `correctable` — **não há coluna**. "Ranges cobrem a linha inteira" (M6) não tem solução do lado da extensão; vira não-objetivo.
- A gramática já colore atributos `{...}` como `source.ruby` (regra `nest_curly_and_self` em `syntaxes/haml.json`, 15 referências a `source.ruby`). Do bullet "injection grammar para `-# locals:` e `{...}`" (M8) só falta o `-# locals:`.
- `Linter.hamlLintConfig`/`HAML_LINT_DEFAULT_COPS` só são lidos por `src/formatter/`. `list_cops` continua necessário por `supports_native_autocorrect`.
- `Linter.configFilePath(document)` já resolve o `.haml-lint.yml` da pasta **do documento**; o que impede multi-root é o servidor único (cwd = pasta 0) e `Report.safe_config_file`, que só aceita caminhos sob `Dir.pwd`.
- `CodeLensProvider.readControllerLines` já tem o padrão de cache por `mtimeMs`; `rails/assetIndex.ts` já tem o padrão de índice em memória invalidado por watcher. Os dois são o modelo para M4.

## 2. Objetivos

- Apagar `src/formatter/` e tudo que só ele usa; o "Format Document" e o fix-all passam a depender exclusivamente do autocorrect do servidor, com um aviso único por sessão quando o haml_lint instalado não o suporta (< 0.74).
- Mudar `hamlAll.useBundler` ou `hamlAll.rubyCommand` reinicia o servidor sem reload; `hamlAll.lintOnType: false` desliga o lint ao digitar (lint só ao abrir/salvar).
- Um status bar item mostra o estado do servidor de lint enquanto um `.haml` está ativo, e o clique abre o output "Haml".
- `render "shared/header"`, `render "row"`, `render @user`, `render user`, `render partial: "x", collection: @xs`, variantes `.turbo_stream.haml`/`+mobile` e partials em qualquer `app/views/` do workspace resolvem para definição, completion e signature help, sem `findFiles` nem leitura de disco a cada tecla.
- Completions de rota aparecem também ao digitar `users_pa` fora de um helper; rotas só recarregam quando `routes.rb` muda; go-to-definition acha controllers de engines dentro do repositório.
- Cada pasta de um workspace multi-root tem seu próprio servidor de lint, com seu `Gemfile`, `cwd` e `.haml-lint.yml`.
- `DataAttributeCompletionProvider` e `ImagePreviewCodeLensProvider` funcionam em qualquer projeto HAML; o preview só considera o argumento do helper de imagem.
- `wordPattern` trata `data-controller`, `@user` e `user_path` como uma palavra; `-# locals: (...)` é colorido como Ruby.
- `getAssetDirectories` e `isInAttributeContext` sem repetição; dedup de ofensas inclui `linter_name`.
- Cada peça de lógica nova ou alterada deixa um teste (Mocha ou Minitest) que falha se ela regredir. `npm run compile`, `npm test`, `bundle exec rake` e `bundle exec rubocop` verdes ao fim de cada story.

## 3. User Stories

Ordem sugerida: US-001 → US-002 → US-003 → US-004 → US-005 → US-006 → US-007 → US-008 → US-009. As quatro primeiras são independentes e pequenas; US-007 usa o encanamento de US-006; US-009 vem por último porque mexe no ciclo de vida do servidor que US-006/US-007 acabam de tocar.

### US-001: Higiene — `getAssetDirectories` declarativo, `looksLikeData`, dedup com `linter_name` (M9, M6) ✅ (`1ddeb64`)

**Descrição:** Como mantenedor, quero que as três repetições apontadas pelo relatório virem uma tabela e duas funções, para que a próxima mudança nesses pontos seja de uma linha.

**Contexto:** `AssetsCompletionProvider.getAssetDirectories` (`src/providers/AssetsCompletionProvider.ts:133-193`) tem 5 blocos `if (helper.includes(...))` com `path.join(workspacePath, ...)` repetido ~30 vezes. `DataAttributeCompletionProvider.isInAttributeContext`/`checkRailsHelperContext` (`src/providers/DataAttributeCompletionProvider.ts:97-175`) repete 6 vezes `startsWith('data-') || startsWith('data_') || === 'data' || === ''`. `Linter.parse` (`src/linter/index.ts:165-181`) deduplica por `` `${line}:${message}` ``.

**Critérios de aceite:**

- [x] `getAssetDirectories` vira uma tabela `const ASSET_DIRS: { match: (helper: string) => boolean; dirs: string[] }[]` (ou `Record<'image'|'javascript'|'stylesheet'|'audio'|'video', string[]>` + função de classificação do helper) com caminhos relativos em POSIX (`'app/assets/images'`), e um único `path.join(workspacePath, ...dir.split('/'))` na saída. O conjunto de diretórios devolvido para cada helper em `ASSET_HELPERS` é **idêntico** ao atual (teste compara antes/depois via snapshot literal dos arrays para `image_tag`, `javascript_include_tag`, `stylesheet_link_tag`, `javascript_pack_tag`, `vite_javascript_tag`, `audio_tag`, `video_tag`, `asset_path`).
- [x] `looksLikeData(prefix: string): boolean` (privada ao módulo) substitui as 6 ocorrências; `isInAttributeContext` continua devolvendo `{ isDataAttribute, prefix }` com `prefix.replace(/_/g, '-')`. Os testes existentes em `DataAttributeCompletionProvider.test.ts` passam sem alteração.
- [x] A chave de dedup em `Linter.parse` passa a ser `` `${line}:${linter_name}:${message}` ``. Teste em `src/test/linter/index.test.ts`: duas ofensas na mesma linha com a mesma mensagem e `linter_name` diferentes produzem 2 diagnósticas; a mesma ofensa duplicada produz 1.
- [x] `npm run compile` e `npm test` passam.

### US-002: Data attributes e preview de imagem fora de Rails; preview só no argumento do helper (M7) ✅ (`e89bda3`)

**Descrição:** Como usuário de HAML sem Rails (Sinatra, Hanami, Middleman), quero completions de `data-*` e preview de imagens, que não dependem de `bin/rails`.

**Contexto:** `ExtensionActivator.registerRailsProviders` (`src/ExtensionActivator.ts:135-147`) registra `AssetsCompletionProvider`, `DataAttributeCompletionProvider` e `ImagePreviewCodeLensProvider` só quando `isARailsProject`. `AssetsCompletionProvider` procura em diretórios Rails e fica onde está. `ImagePreviewCodeLensProvider.findImageReferences` (`:74-125`) aplica `IMAGE_WITHOUT_EXT_REGEX = /['"]([\w\-\.\/\\:]+)['"]/gi` a toda a linha e chama `findImagePath` (que anda por diretórios) para cada string, filtrando só por `includes('path'|'url'|'controller'|'action')`.

**Critérios de aceite:**

- [x] `DataAttributeCompletionProvider` e `ImagePreviewCodeLensProvider` são registrados em `registerHamlProviders` (sempre); `registerRailsProviders` fica só com `AssetsCompletionProvider`.
- [x] `ImagePreviewCodeLensProvider` considera apenas a **primeira string** que segue o helper de imagem na linha: nova regex ancorada no helper, por exemplo `` new RegExp(`\\b(?:${IMAGE_HELPERS.join('|')})\\s*\\(?\\s*['"]([^'"]+)['"]`) `` (um match por linha). `IMAGE_WITH_EXT_REGEX`/`IMAGE_WITHOUT_EXT_REGEX` globais são removidas; a distinção com/sem extensão passa a ser feita no nome capturado (`path.extname`).
- [x] `src/test/providers/ImagePreviewCodeLensProvider.test.ts` ganha: (a) `= image_tag "logo.png", alt: "Company logo"` → só `logo.png` é candidato (o `alt` não chama `findImagePath`); (b) `= image_tag user.avatar, class: "round"` → nenhum candidato; (c) `= link_to image_tag("icon"), root_path` → `icon`. Injetar `findImagePath` (ou contar chamadas via subclasse) para verificar que só o candidato é resolvido.
- [x] `src/test/extension.test.ts` (smoke) confirma que, num workspace sem `bin/rails`, `vscode.executeCompletionItemProvider` em `%div{data-` devolve itens.
- [x] `README.md`: "Data Attributes Completion" e o preview de imagem deixam de ser listados como features Rails-only (se estiverem).
- [x] `CHANGELOG.md` `## [Unreleased]` → `### Fixes`: "Data attribute completion and image preview now work in projects without `bin/rails`" e "Image preview no longer probes every quoted string on an `image_tag` line".
- [x] `npm run compile` e `npm test` passam.

### US-003: `wordPattern` e realce Ruby em `-# locals:` (M8) ✅ (`610a927`)

**Descrição:** Como usuário, quero que duplo-clique e Ctrl+D selecionem `data-controller` e `@user` inteiros, e que `-# locals: (user:, title: nil)` seja colorido como Ruby, não como comentário cinza.

**Contexto:** `haml-configuration.json` não tem `wordPattern` (VS Code usa o padrão, que quebra em `-` e `@`). A gramática `text.haml` colore `-#` como `comment.line.slash.haml`/`comment.block.haml`. A gramática já trata `{...}` como `source.ruby` (verificado, ver §1).

**Critérios de aceite:**

- [x] `haml-configuration.json` ganha `"wordPattern": "(-?\\d*\\.\\d\\w*)|([^\\`\\~\\!\\%\\^\\&\\*\\(\\)\\=\\+\\[\\{\\]\\}\\\\\\|\\;\\:\\'\\\"\\,\\.\\<\\>\\/\\?\\s]+)"` — o padrão do VS Code **sem** `-` e `@` na lista de separadores. `#` **continua** separador (desvio do rascunho deste PRD, decidido na implementação): torná-lo parte da palavra funde `%div#id` num token só, o que custa mais do que o caso `#id` isolado ganha. Verificação manual: duplo-clique em `data-controller`, `@user`, `.btn-primary`, `user_path` seleciona a palavra inteira; em `%div{` seleciona só `div`.
- [x] `syntaxes/haml.json`: nova regra **antes** das regras de comentário: `begin: "^(\\s*)(-#)\\s*(locals:)"`, `end: "$"`, `name: "meta.line.ruby.locals.haml"`, captures 2 → `punctuation.definition.comment.haml`, 3 → `keyword.other.locals.haml`, `patterns: [{ include: "source.ruby" }]`. Um `-#` comum continua `comment.line.slash.haml`.
- [x] Verificação manual com "Developer: Inspect Editor Tokens and Scopes" em `-# locals: (user:, title: nil)` (escopos `source.ruby` em `user:` e `nil`) e em `-# TODO` (escopo `comment.line.slash.haml`). Registrar o resultado no PR.
- [x] `CHANGELOG.md` `### Fixes`: "Double-click selects `data-*` attributes, `@ivars` and `helper_path` as one word" e "`-# locals: (...)` is highlighted as Ruby".
- [x] `npm run compile` passa (a gramática é JSON: `npm run format:check` valida a sintaxe).

### US-004: Rotas — sem TTL, gatilho por palavra, controllers de engines (M5) ✅ (`3ed3236`)

**Descrição:** Como usuário, quero completar `users_pa` → `users_path` mesmo fora de `link_to`, quero que as rotas só recarreguem quando `routes.rb` mudar, e quero ir para a definição de uma rota cujo controller vive numa engine dentro do repositório.

**Contexto:** `Routes` (`src/rails/routes.ts`) tem `CACHE_TTL = 5 min` e `isCacheValid()` que loga "Routes cache expired". O watcher em `EventSubscriber.subscribeRailsWatchers` já chama `routes.load()` em `config/routes.rb` e `config/routes/**/*.rb`. `RoutesCompletionProvider` (`src/providers/RoutesCompletionProvider.ts`) só dispara se a linha até o cursor casa `LINE_REGEXP = /(?:link_to|redirect_to|button_to|form_for|visit|url|path|href)/`. `RoutesDefinitionProvider.findControllerPaths` usa `workspace.findFiles('app/controllers/<c>_controller.rb')`.

**Critérios de aceite:**

- [x] `CACHE_TTL`, `lastLoadTime` e a checagem de expiração saem de `Routes`; `isCacheValid()` passa a comparar só o `mtimeMs` de `config/routes.rb` (cache válido se o arquivo não mudou desde o último `load`). Se `config/routes.rb` não existir, o cache é sempre válido após o primeiro `load` (o watcher em `config/routes/**` continua forçando `load()`). Log "Routes cache expired (TTL exceeded)" removido.
- [x] `Routes.load()` ganha `force = false`; o watcher chama `load(true)` para ignorar o cache — hoje o watcher depende de `mtime` mudar, o que já acontece, mas `force` deixa a intenção explícita e cobre `config/routes/*.rb` (cuja mudança não altera o mtime de `routes.rb`).
- [x] `RoutesCompletionProvider.provideCompletionItems` também dispara quando a palavra sob o cursor (`document.getWordRangeAtPosition(position, /\w+/)`) tem ≥ 3 caracteres e é prefixo de algum `${prefix}_path`/`${prefix}_url` do `Routes.getAll()`. O item continua um por rota, label `${prefix}_path`, `insertText` snippet `${prefix}_${1|path,url|}(...)` (decisão do mantenedor). Para o gatilho por palavra, `item.range` cobre a palavra digitada, para que `users_pa` seja substituído em vez de concatenado. Também `filterText = \`${prefix}_path ${prefix}_url\`` para que digitar `users_url` case o item.
- [x] `RoutesDefinitionProvider.findControllerPaths` usa `workspace.findFiles(\`**/app/controllers/${controller}_controller.rb\`, '**/{node_modules,vendor,tmp,log,public}/**', 5)` e prefere o resultado sob a raiz (`app/controllers/...` direto) quando houver mais de um.
- [x] `src/test/rails/routes.test.ts` (novo): com `spawn` falso (padrão de `processRunner.test.ts`/`fakeServer.ts`) ou `execCmd` stubado, (a) segundo `load()` sem mudança em `routes.rb` não executa o comando; (b) `touch` no `routes.rb` (`fs.utimesSync`) faz o próximo `load()` executar; (c) `load(true)` executa sempre.
- [x] `RoutesCompletionProvider.test.ts`: (d) `users_pa` sem helper na linha → item `users_path` com `range` cobrindo `users_pa`; (e) `us` (2 chars) → `null`; (f) palavra que não prefixa rota → `null`; (g) `link_to` continua funcionando como hoje.
- [x] `RoutesDefinitionProvider.test.ts`: (h) o glob passado a `findFiles` começa com `**/app/controllers/`; (i) com dois resultados (`engines/blog/app/controllers/...` e `app/controllers/...`), o da raiz é usado.
- [x] `CHANGELOG.md` `### Added`: "Route helper completion also triggers while typing the helper name (`users_pa` → `users_path`)"; `### Fixes`: "Go to Definition on a route helper finds controllers inside in-repo engines"; "Routes are reloaded only when `config/routes*.rb` changes (no more 5-minute expiry)".
- [x] `npm run compile` e `npm test` passam.

### US-005: Remover o formatter legado (M3) ✅ (`11b6351`)

**Descrição:** Como mantenedor, quero apagar `src/formatter/` para que só exista um caminho de autocorreção (o servidor), e como usuário com haml_lint < 0.74 quero ser avisado uma vez de que a autocorreção dos linters do haml-lint exige 0.74+.

**Contexto:** `FormattingEditProvider.computeEdits` (`src/providers/FormattingEditProvider.ts:119-121`) chama `autoCorrectAll(...)` quando `linter.legacyAutocorrectNeeded()`; esse flag é `true` até o servidor responder `list_cops` com `supports_native_autocorrect: true` — ou seja, o formatter legado **sempre** roda nos primeiros segundos após a ativação, mesmo com haml_lint 0.78. `Linter.hamlLintConfig`, `HAML_LINT_DEFAULT_COPS` (`src/linter/cops.ts`), `LinterConfig`/`LinterConfigEnabler`/`LinterMetcher` (`src/types.d.ts`), `src/utils/haml.ts` e `src/utils/regex.ts` só servem ao formatter (verificado por grep). `Cops.list_cops` (Ruby) continua devolvendo `haml_lint`, `version` e `supports_native_autocorrect`.

**Critérios de aceite:**

- [x] Apagados: `src/formatter/` (3 arquivos), `src/test/formatter/` (2 arquivos), `src/linter/cops.ts`, `src/utils/haml.ts`, `src/utils/regex.ts`, e em `src/types.d.ts` os tipos `LinterConfig`, `LinterConfigEnabler`, `LinterMetcher` e o que mais ficar sem referência (`tsc --noEmit` e `eslint` com `no-unused-vars` confirmam).
- [x] `Linter` perde `hamlLintConfig` e `legacyAutocorrectNeeded()`; mantém `hamlLintSupportsNativeAutocorrect` (renomeado para `nativeAutocorrect: boolean | null`, `null` = servidor ainda não respondeu) e `loadConfigs()` (que segue chamando `list_cops`).
- [x] `FormattingEditProvider.computeEdits`: sem o bloco legado. Quando `linter.nativeAutocorrect === false` (servidor respondeu e a versão é < 0.74), após o autocorrect do servidor, mostra **uma vez por sessão** `window.showWarningMessage('haml-lint <versão> only autocorrects RuboCop offenses. Update to haml_lint >= 0.74 to autocorrect haml-lint linters too.')` — a versão vem de `list_cops.version`, guardada em `Linter.hamlLintVersion`. Enquanto `null`, nenhum aviso. O edit do servidor é aplicado normalmente em todos os casos.
- [x] O servidor Ruby não muda (`Cops.list_cops` já entrega tudo). Nenhum novo campo no protocolo.
- [x] `FormattingEditProvider.test.ts`: o fake `linter` perde `legacyAutocorrectNeeded`; teste novo: `nativeAutocorrect: false` → 1 aviso na primeira formatação, 0 na segunda; `nativeAutocorrect: null` → 0 avisos; `true` → 0 avisos. `countWarnings` existente é reutilizado.
- [x] `README.md` › "Formatting and auto-correction": remover a menção ao fallback TypeScript (se houver); dizer que a autocorreção usa o haml-lint instalado e que os linters do haml-lint (não só RuboCop) exigem haml_lint ≥ 0.74.
- [x] `CHANGELOG.md` `### Changed` (criar se não existir): "Formatting relies entirely on haml-lint's autocorrect. The built-in TypeScript fixers (ClassesBeforeIds, HtmlAttributes, LeadingCommentSpace, UnnecessaryStringOutput, TrailingWhitespace, StrictLocals, FinalNewline) were removed; with haml_lint < 0.74 only RuboCop offenses are corrected, and the extension says so once per session."
- [x] `tmp/relatorio-analise.md` não precisa mudar neste PRD (é atualizado ao fim, ver §8).
- [x] `npm run compile` e `npm test` passam; a contagem de testes Mocha cai (formatter/haml_lint_cops removidos) e isso é esperado.

### US-006: `hamlAll.lintOnType` e restart automático ao mudar `useBundler`/`rubyCommand` (M2) ✅ (`22a098e`)

**Descrição:** Como usuário, quero desligar o lint enquanto digito (só ao abrir e salvar) e quero que mudar `hamlAll.useBundler` ou `hamlAll.rubyCommand` reinicie o servidor sem recarregar a janela.

**Contexto:** `EventSubscriber.subscribeToEvents` (`src/EventSubscriber.ts:123-130`) agenda `linter.run` 300 ms após `onDidChangeTextDocument`. `LintServer` recebe `useBundler` e `rubyCommand` no construtor como `readonly` (`src/server/index.ts:60-73`) e `start()` os repassa a `startRubyServer` (`:68-80`); `restart()` (`:108-118`) chama `stop()` + `start()` e `handlers.onRestarted`. `ExtensionActivator.activateTrusted` lê `config.useBundler` e `helpers.rubyCommand()` uma vez (`:86-87`). Já existe `onDidChangeConfiguration` para `hamlAll.lintEnabled` (`EventSubscriber.ts:132-138`).

**Critérios de aceite:**

- [x] `package.json` › `contributes.configuration`: `hamlAll.lintOnType` (`boolean`, default `true`, description "Lint while typing (debounced). When false, files are linted only when opened or saved."). Sem `lintDebounceMs` (decisão do mantenedor).
- [x] `EventSubscriber`: o handler de `onDidChangeTextDocument` retorna cedo quando `workspace.getConfiguration('hamlAll').get('lintOnType', true) === false` (lido a cada evento, como `Linter.isEnabled()` faz). Save e open continuam lintando. `onDidChangeConfiguration` para `hamlAll.lintOnType` apenas cancela o debounce pendente (`clearChangeDebounce`).
- [x] `LintServer` deixa de receber `useBundler`/`rubyCommand` fixos: o construtor recebe `options: () => { useBundler: boolean; rubyCommand: string }` (um getter), chamado dentro de `start()`. `ExtensionActivator` passa `() => ({ useBundler: getConfiguration('hamlAll').get('useBundler', false), rubyCommand: helpers.rubyCommand() })`. Assim `restart()` (manual ou automático) sempre usa os valores atuais, sem novo código.
- [x] `ExtensionActivator.activateTrusted` registra `workspace.onDidChangeConfiguration`: se `affectsConfiguration('hamlAll.useBundler') || affectsConfiguration('hamlAll.rubyCommand')`, loga `Haml All: <setting> changed, restarting the lint server` e chama `this.restartLintServer()` (o método já existente, que trata erro com "Show Output"). Mudanças enquanto o workspace não é confiável são ignoradas (o servidor não existe).
- [x] `src/test/server/index.test.ts`: com `spawn` falso, `start()` com o getter devolvendo `useBundler: false` gera argv sem `--use-bundler`; mudar o valor devolvido pelo getter e chamar `restart()` gera argv com `--use-bundler` e o novo `rubyCommand` como executável.
- [x] `src/test/EventSubscriber.test.ts` (novo, ou em `linter/index.test.ts` se `EventSubscriber` for pesado de instanciar): com `lintOnType: false` (stub de `getConfiguration`, padrão de `Helpers.test.ts`), uma mudança de texto não agenda lint (o `linter.run` falso não é chamado após 300 ms); com `true`, é chamado uma vez. Se instanciar `EventSubscriber` exigir refatoração, extrair a decisão para uma função pura `shouldLintOnChange(config, event, activeDocument): boolean` e testar essa.
- [x] `README.md` › Configuration: `hamlAll.lintOnType` no bloco JSON; nota de que mudar `useBundler`/`rubyCommand` reinicia o servidor automaticamente.
- [x] `CHANGELOG.md` `### Added`: "`hamlAll.lintOnType` to lint only on open/save"; `### Fixes`: "Changing `hamlAll.useBundler` or `hamlAll.rubyCommand` restarts the lint server; a window reload is no longer needed".
- [x] `npm run compile` e `npm test` passam.

### US-007: Status bar do servidor de lint (M1) ✅ (`e30cd44`)

**Descrição:** Como usuário, quero ver na status bar se o haml-lint está funcionando, e clicar nele para abrir o output "Haml" quando algo der errado.

**Contexto:** Estados observáveis hoje: `Linter.startServer()` (`src/linter/index.ts:91-114`) loga início/sucesso/erro; `LintServer.scheduleRestart` (`src/server/index.ts:142-170`) loga cada tentativa e chama `handlers.onGaveUp`; `handlers.onRestarted` no sucesso; `helpers.hamlLintPresent()` em `activateTrusted` mostra erro quando o gem não existe. `ExtensionActivator.showWithOutput` já abre o output a partir de uma notificação.

**Critérios de aceite:**

- [x] Novo `src/StatusBar.ts` exportando `class LintStatusBar implements Disposable` com `constructor(item: StatusBarItem = window.createStatusBarItem(StatusBarAlignment.Right, 100))` (injeção para teste) e três métodos: `starting()` → texto `$(sync~spin) HAML`, tooltip `Starting haml-lint server…`; `ok()` → `$(check) HAML`, tooltip `haml-lint running`; `warning(reason: string)` → `$(warning) HAML`, tooltip `reason`, `backgroundColor = new ThemeColor('statusBarItem.warningBackground')`. `item.command = 'hamlAll.showOutput'`. `item.name = 'HAML lint server'`.
- [x] Visibilidade: `LintStatusBar` ouve `window.onDidChangeActiveTextEditor` e chama `item.show()` se `editor?.document.languageId === 'haml'`, senão `item.hide()`; avalia o editor ativo no construtor. `dispose()` descarta o item e a subscription.
- [x] Novo comando `hamlAll.showOutput` ("HAML: Show output") em `package.json` › `contributes.commands` e em `ExtensionActivator.registerCommands` → `this.outputChannel.show()`.
- [x] Ligações em `ExtensionActivator.activateTrusted`: `starting()` antes de `linter.startServer()`; `ok()` quando `startServer` resolve; `warning('haml-lint server failed to start. Click to see the output.')` quando rejeita; `warning('haml-lint not found. Install the gem or set hamlAll.useBundler.')` quando `hamlLintPresent()` é `false`; `onRestarted` → `ok()`; `onGaveUp` → `warning('haml-lint server stopped and could not be restarted. Run "HAML: Restart lint server".')`. `LintServer` ganha `handlers.onRestarting?: (attempt: number, max: number) => void`, chamado em `scheduleRestart`, ligado a `warning(\`haml-lint server died, restarting (${attempt}/${max})…\`)`. O comando de restart manual chama `starting()` antes e `ok()`/`warning()` depois. Em workspace não confiável a status bar não é criada (nada a mostrar).
- [x] `src/test/StatusBar.test.ts` (novo): com um `StatusBarItem` falso (objeto com `text`, `tooltip`, `backgroundColor`, `command`, `show()`, `hide()`, `dispose()` contando chamadas), (a) `starting/ok/warning` setam `text`/`tooltip`/`backgroundColor` esperados (`backgroundColor` `undefined` fora do warning); (b) construtor com editor ativo `.haml` → `show()`; com `.rb` → `hide()`; (c) `dispose()` descarta o item. Para (b), injetar também `activeEditorLanguage: () => string | undefined` ou abrir documentos reais com `window.showTextDocument`.
- [x] `src/test/server/index.test.ts`: `onRestarting` é chamado com `(1, n)` na primeira morte do processo falso.
- [x] `README.md`: um parágrafo em "Linting" descrevendo os três estados e o clique.
- [x] `CHANGELOG.md` `### Added`: "Status bar item showing the lint server state (starting / running / problem); click it to open the Haml output. New command **HAML: Show output**."
- [x] `npm run compile` e `npm test` passam.

### US-008: Índice de partials (M4) ✅ (`5ec8f9b`)

**Descrição:** Como usuário, quero que `render @user`, `render user`, `render partial: "row", collection: @rows`, `render "shared/header"` e partials com variantes (`_row.turbo_stream.haml`, `_row+mobile.html.haml`) ou em engines do repositório resolvam para definição, completion e signature help — sem a extensão varrer o disco a cada tecla.

**Contexto:** `resolvePartialFilePath` (`src/utils/file.ts:107-127`) testa `existsSync` para 4 extensões fixas no diretório da view atual ou em `<basePath até /views/>/<partial>`; `extractPartialNameFromLine` (`:46-64`) só extrai strings e símbolos (regex `PARTIAL_EXPLICIT_REGEX`/`PARTIAL_IMPLICIT_REGEX`); `ViewCompletionProvider.buildCompletionItems` (`src/providers/ViewCompletionProvider.ts:42-66`) chama `workspace.findFiles('app/views/**/_*')` a cada trigger; `PartialSignatureHelpProvider.loadPartialLocals` (`:23-32`) chama `fileStringLocals` (`readFileSync`) a cada tecla; `CodeLensProvider` e `ViewFileDefinitionProvider` também usam `resolvePartialFilePath`. Modelos existentes: `rails/assetIndex.ts` (índice em memória + `invalidateAssetIndex()` por watcher de create/delete em `EventSubscriber.subscribeAssetWatchers`) e `CodeLensProvider.readControllerLines` (cache por `mtimeMs`).

**Critérios de aceite:**

- [x] Novo `src/rails/partialIndex.ts`:
  - `export interface PartialFile { fullPath: string; viewsRoot: string; /* abs. path do app/views que o contém */ logicalPath: string; /* 'users/_row' — sem extensões nem variante */ dir: string; /* 'users' */ baseName: string; /* '_row' */ variant: string; /* 'html.haml', 'turbo_stream.haml', '+mobile.html.haml' */ }`
  - `export async function getPartialIndex(): Promise<PartialFile[]>` — na primeira chamada (ou após invalidação) roda `workspace.findFiles('**/app/views/**/_*.{haml,erb}', '**/{node_modules,vendor,tmp,log,public}/**')` uma vez e guarda em memória; chamadas seguintes devolvem o array cacheado. `export function invalidatePartialIndex(): void`.
  - `export function resolvePartial(index, partialName, currentViewFile): string[]` — regras, nesta ordem, devolvendo todos os `fullPath` do primeiro nível que casar: (1) nome com `/` → `logicalPath === formatPartialName(name)` em **qualquer** `viewsRoot`, preferindo o `viewsRoot` do arquivo atual; (2) nome sem `/` → mesmo `dir` do arquivo atual, no mesmo `viewsRoot`; (3) nome sem `/` → `baseName === '_' + name` em qualquer dir, ordenado por `matchScore` com o dir atual (reuso de `ViewCompletionProvider.matchScore`). Variantes: todas as entradas com o mesmo `logicalPath` são devolvidas, `.html.haml` primeiro, depois `.haml`, `.html.erb`, `.erb`, depois as demais em ordem alfabética.
- [x] `extractPartialNameFromLine` também reconhece: `render @user` / `render user` / `render(@user)` → `user` (identificador sem aspas; `@` removido); `render @users` (plural) → `user` via singularização **ingênua** (`ies`→`y`, `ses`/`xes`/`zes`/`ches`/`shes`→ remove `es`, senão remove `s` final) marcada com `// ponytail: naive inflector, swap for a table if a real project breaks it`; `collection: @rows` **não** muda o nome (o partial é o do `partial:` ou o singular da collection quando não há `partial:`: `render @rows` → `row`). O nome inferido de identificador vai pela regra (3) acima (busca por `baseName`), então `render @user` acha `users/_user.html.haml` sem precisar pluralizar.
- [x] `resolvePartialFilePath(partialName, fileBaseName)` passa a ser `async` e a delegar a `resolvePartial(await getPartialIndex(), ...)`. Chamadores (`ViewFileDefinitionProvider`, `PartialSignatureHelpProvider`, `CodeLensProvider`) passam a `await`. `PartialSignatureHelpProvider.provideSignatureHelp` vira `async` (a interface do VS Code aceita `ProviderResult`).
- [x] `ViewCompletionProvider.buildCompletionItems` usa `getPartialIndex()` em vez de `findFiles`; `viewPathForRelativePath` passa a derivar de `PartialFile.logicalPath` + `variant`. Um item por `logicalPath` (variantes não duplicam o item; `detail` lista as variantes).
- [x] `fileStringLocals` (`src/utils/file.ts`) cacheia por `mtimeMs` (mesmo padrão de `readControllerLines`), com `Map<string, { mtimeMs, locals }>`.
- [x] `EventSubscriber` registra `workspace.createFileSystemWatcher(new RelativePattern(folder, '**/app/views/**'), false, true, false)` para **cada** workspace folder, chamando `invalidatePartialIndex()` em create/delete (conteúdo ignorado, como o índice de assets). Não depende de `isARailsProject`. `onDidChangeWorkspaceFolders` também invalida.
- [x] `src/test/rails/partialIndex.test.ts` (novo) com um índice montado à mão (sem disco): (a) `shared/header` acha `app/views/shared/_header.html.haml`; (b) `row` a partir de `users/index.html.haml` acha `users/_row.html.haml` e `users/_row.turbo_stream.haml`, nessa ordem; (c) `row` a partir de `posts/show.html.haml` sem `posts/_row` acha `users/_row.*` pela regra (3); (d) `shared/header` com dois `viewsRoot` (`app/views` e `engines/blog/app/views`) a partir de um arquivo da engine prefere o da engine; (e) nome inexistente → `[]`.
- [x] `src/test/utils/file.test.ts`: `extractPartialNameFromLine` para `= render @user` → `_user`, `= render user` → `_user`, `= render @categories` → `_category`, `= render partial: "row", collection: @rows` → `_row`, `= render @rows` → `_row` (após `formatPartialName`). `fileStringLocals` lê o disco uma vez para o mesmo mtime (contar via `fs.readFileSync` stub ou arquivo tmp + `utimesSync`).
- [x] `ViewFileDefinitionProvider.test.ts` e `PartialSignatureHelpProvider.test.ts` adaptados ao `async` e ao índice (injeção: `getPartialIndex` aceita um índice pré-carregado via `setPartialIndexForTests(files)` ou o teste cria a árvore em tmpdir e chama `invalidatePartialIndex()` — preferir tmpdir + `findFiles` real só se o host de teste tiver workspace; senão, o setter de teste).
- [x] `README.md` › "Partials - Go to Definition"/"Partial Completion": listar as formas suportadas (`render "x"`, `render partial: "x"`, `render @user`, `collection:`, variantes, engines no repo).
- [x] `CHANGELOG.md` `### Added`: "Partial navigation, completion and signature help now understand `render @user`, `render user`, `collection:`, template variants (`.turbo_stream.haml`, `+mobile`) and partials inside in-repo engines"; `### Performance`: "Partials are indexed once and kept in memory; completion no longer scans the workspace on every keystroke, and signature help no longer re-reads the partial on every key".
- [x] `npm run compile` e `npm test` passam.

### US-009: Um servidor de lint por workspace folder (M6) ✅ (`f2d3e81`)

**Descrição:** Como usuário com um workspace multi-root (por exemplo, app + engine + gem de componentes), quero que cada pasta seja lintada com o seu `Gemfile`, seu `cwd` e seu `.haml-lint.yml`.

**Contexto:** `ExtensionActivator.activateTrusted` cria **um** `LintServer` com `getWorkspaceRoot()` (= pasta 0). `Linter` (`src/linter/index.ts`) guarda `lintServer` e usa `configFilePath(document)` = `<pasta do documento>/.haml-lint.yml`; `Report.safe_config_file` (`lib/lint_server/report.rb:24-34`) rejeita esse arquivo se a pasta não for descendente do `cwd` do servidor. `FormattingEditProvider`, `EventSubscriber.autocorrectLinters`, `restartLintServer`, `setRestartHandlers` e a status bar (US-007) falam com "o" servidor. `workspaceFolders[0]` restante: `EventSubscriber.rootPath` (watchers, rotas), `utils/file.getWorkspaceRoot`, `AssetsCompletionProvider`, `ImagePreviewCodeLensProvider` (2×) — **ficam** na pasta 0 (decisão do mantenedor: rotas/assets single-root).

**Critérios de aceite:**

- [x] Novo `src/server/pool.ts`: `class LintServerPool implements Disposable` com `constructor(create: (folder: WorkspaceFolder) => LintServer)`, `for(document: TextDocument): LintServer | undefined` (via `workspace.getWorkspaceFolder(document.uri)`; `undefined` para documento fora do workspace), `all(): LintServer[]`, `startAll()`, `restartAll()`, `stopAll()`/`dispose()`. Ouve `workspace.onDidChangeWorkspaceFolders`: pasta adicionada → cria e inicia; removida → `stop()` e remove do `Map`. Chave do `Map`: `folder.uri.toString()`.
- [x] `ExtensionActivator.activateTrusted` cria o pool com `create = (folder) => new LintServer(folder.uri.fsPath, optionsGetter, outputChannel)` e aplica `setRestartHandlers` a **cada** servidor criado (inclusive os adicionados depois). `restartLintServer` (comando) chama `pool.restartAll()`. `dispose()` chama `pool.dispose()`.
- [x] `Linter` recebe o pool em vez de um servidor; `lint()` usa `pool.for(document)` e retorna cedo se `undefined` ou se `rubyServerProcess` for `null`. `loadConfigs()` consulta o servidor da pasta 0 (o `list_cops` só alimenta `nativeAutocorrect`/versão; uma versão por workspace é suficiente — documentar no código). `startServer()` vira `pool.startAll()` e resolve quando todos responderem; um servidor que falha não impede os outros (log por pasta; `Promise.allSettled`).
- [x] `FormattingEditProvider.autocorrect` e `EventSubscriber.autocorrectLinters` usam `pool.for(document)`; sem servidor → `null` (mesmo tratamento de falha de hoje).
- [x] Status bar (US-007): `ok()` só quando **todos** os servidores estão de pé; `warning()` quando qualquer um falhou, com o nome da pasta no tooltip (`haml-lint server for "<folder.name>" …`).
- [x] Servidor Ruby: **sem mudança** em `safe_config_file` — cada processo já tem `cwd` na sua pasta, e o `.haml-lint.yml` da pasta passa no `ascend.any?(root)`. `lib/server.rb` não muda. (Minitest não muda.)
- [x] `EventSubscriber`: o watcher de `.haml-lint.yml` passa a ser um por workspace folder (`RelativePattern(folder, '.haml-lint.yml')`), chamando `onUpdateLintConfig()` (que já relinta tudo). Rotas e assets continuam em `workspaceFolders[0]` — adicionar um comentário `// ponytail: routes/assets are single-root on purpose, see tasks/prd-melhorias-secao-4.md US-009`.
- [x] `src/test/server/pool.test.ts` (novo): com `create` falso que devolve objetos `{ start, stop, restart, rubyServerProcess }` contadores, (a) `for(document)` devolve o servidor da pasta do documento (stub de `workspace.getWorkspaceFolder`); (b) documento fora do workspace → `undefined`; (c) `startAll` inicia todos; (d) `restartAll` reinicia todos; (e) `onDidChangeWorkspaceFolders` com `added` cria e inicia um novo; com `removed` para e remove. Para (e), disparar o evento via um `EventEmitter` injetado (`constructor(create, onDidChangeFolders = workspace.onDidChangeWorkspaceFolders)`).
- [x] `src/test/linter/index.test.ts`: `lint()` de um documento sem servidor no pool não lança e não chama `lint` em nenhum servidor.
- [x] `README.md` › "Linting": "In a multi-root workspace each folder gets its own lint server (own Gemfile, cwd and `.haml-lint.yml`). Rails routes and asset completion use the first folder."
- [x] `CHANGELOG.md` `### Added`: "Multi-root workspaces: every folder is linted with its own `.haml-lint.yml`, `Gemfile` and working directory."
- [x] `npm run compile`, `npm test`, `bundle exec rake` e `bundle exec rubocop` passam.

## 4. Requisitos funcionais

Higiene e escopo (US-001, US-002, US-003):

- FR-1: `getAssetDirectories` deve devolver, para cada helper, exatamente o mesmo conjunto de diretórios de hoje, a partir de uma tabela declarativa.
- FR-2: A detecção de prefixo `data` em `DataAttributeCompletionProvider` deve estar em uma única função.
- FR-3: A deduplicação de ofensas deve considerar `linter_name` além de linha e mensagem.
- FR-4: `DataAttributeCompletionProvider` e `ImagePreviewCodeLensProvider` devem ser registrados em qualquer projeto HAML; `AssetsCompletionProvider` continua Rails-only.
- FR-5: O preview de imagem deve considerar apenas a primeira string após um helper de imagem na linha.
- FR-6: `wordPattern` deve tratar `-`, `@` e `#` como parte da palavra.
- FR-7: `-# locals: (...)` deve ser tokenizado com `source.ruby` no conteúdo; outros `-#` continuam comentário.

Rotas (US-004):

- FR-8: `Routes` deve recarregar apenas quando `config/routes.rb` mudar (mtime) ou quando o watcher forçar (`load(true)`); sem expiração por tempo.
- FR-9: A completion de rotas deve disparar também para uma palavra de ≥ 3 caracteres que prefixe `<prefix>_path`/`<prefix>_url`, substituindo a palavra digitada; um item por rota com snippet `path|url`.
- FR-10: Go-to-definition de rota deve procurar `**/app/controllers/<c>_controller.rb` (excluindo `node_modules`, `vendor`, `tmp`, `log`, `public`) e preferir o da raiz.

Formatter (US-005):

- FR-11: Não deve existir autocorreção em TypeScript; o edit do Format/fix-all é exatamente o texto devolvido pelo servidor.
- FR-12: Com `supports_native_autocorrect: false`, a primeira formatação da sessão deve avisar que haml_lint ≥ 0.74 é necessário para corrigir linters do haml-lint; formatações seguintes não avisam. Nenhuma versão mínima é imposta.

Configuração e ciclo de vida (US-006, US-007, US-009):

- FR-13: `hamlAll.lintOnType: false` deve impedir o lint disparado por mudança de texto; abrir e salvar continuam lintando.
- FR-14: `LintServer.start()`/`restart()` devem ler `useBundler` e `rubyCommand` no momento da chamada.
- FR-15: Mudar `hamlAll.useBundler` ou `hamlAll.rubyCommand` deve reiniciar o(s) servidor(es) automaticamente, com log no output.
- FR-16: Um status bar item deve existir enquanto um `.haml` estiver ativo, com estados iniciando / ok / aviso, tooltip com o motivo, e comando `hamlAll.showOutput` no clique.
- FR-17: Cada workspace folder deve ter seu próprio servidor de lint, com `cwd` na pasta; pastas adicionadas/removidas em tempo de execução criam/param servidores.
- FR-18: Documentos fora de qualquer workspace folder não são lintados nem formatados pelo servidor (comportamento atual preservado).

Partials (US-008):

- FR-19: Deve existir um índice em memória de `**/app/views/**/_*.{haml,erb}` (excluindo `node_modules`, `vendor`, `tmp`, `log`, `public`), construído sob demanda e invalidado por criação/remoção de arquivos sob `app/views` ou mudança de workspace folders.
- FR-20: A resolução de partial deve seguir, em ordem: caminho lógico completo (com `/`) em qualquer `app/views`, preferindo o do arquivo atual; mesmo diretório do arquivo atual; qualquer diretório por `baseName`, ordenado por proximidade.
- FR-21: Todas as variantes de um partial devem ser devolvidas, `.html.haml` primeiro.
- FR-22: `render @x`, `render x`, `render @xs` e `collection: @xs` (sem `partial:`) devem inferir o nome do partial a partir do identificador, singularizando de forma ingênua.
- FR-23: `-# locals:` de um partial deve ser lido do disco no máximo uma vez por mtime.
- FR-24: Mudanças visíveis ao usuário vão para `CHANGELOG.md` sob `## [Unreleased]`; sem bump de versão (`AGENTS.md`).

## 5. Não-objetivos (fora de escopo)

- **Ranges por coluna nas diagnósticas.** `HamlLint::Lint` não expõe coluna; continuam cobrindo a linha.
- **`hamlAll.lintDebounceMs`.** Decisão do mantenedor: só `lintOnType`; debounce fixo em 300 ms.
- **Itens separados `*_path` e `*_url`.** Decisão do mantenedor: um item com snippet `path|url`.
- **Manter diagnósticas após fechar a aba.** Decisão do mantenedor: `Linter.clear` fica.
- **Versão mínima de haml_lint.** Nem para o formatter (US-005) nem para o `correctable` (PRD anterior, D5).
- **Rotas e assets multi-root.** `Routes`, `AssetsCompletionProvider` e `ImagePreviewCodeLensProvider` continuam na pasta 0. Reabrir se surgir demanda.
- **Engines fora do repositório (gems).** `RoutesDefinitionProvider` e o índice de partials só veem arquivos do workspace.
- **Inflector completo** (irregulares como `person`/`people`). A regra ingênua cobre o comum; a busca por `baseName` cobre `render @user` sem pluralizar.
- **`app/components` (ViewComponent) e `*.turbo_stream.haml` como view raiz** — feature 10 do relatório, não faz parte de M4.
- **Um `.haml-lint.yml` por subdiretório** (ancestral mais próximo do arquivo). O haml-lint suporta, mas a extensão continua com um config por workspace folder.
- **Status bar em arquivos não-HAML** ou com contagem de ofensas.
- **Cancelar requisições em voo no servidor** ao reiniciar; o transporte não suporta, como já documentado.

## 6. Considerações de design

- A status bar usa os ícones e a cor de fundo padrão do VS Code (`statusBarItem.warningBackground`) — nenhuma cor própria; aparece à direita, prioridade 100, só em `.haml`, para não competir com Ruby LSP/ESLint em outros arquivos.
- Mensagens seguem a convenção: dizem o que fazer e apontam para o output "Haml" quando há detalhe. O aviso de haml_lint < 0.74 nomeia a versão instalada.
- O gatilho por palavra em rotas substitui a palavra digitada (`item.range`), para que aceitar o item não gere `users_pausers_path`.
- Completion de partials mostra um item por partial lógico e lista variantes no `detail`, para não triplicar a lista em apps Turbo.
- Comentários `// ponytail:` marcam as duas simplificações deliberadas: inflector ingênuo (US-008) e rotas/assets single-root (US-009).

## 7. Considerações técnicas

- **Ordem importa em US-005.** Apagar `src/formatter/` antes de US-008/US-009 evita adaptar código que será removido. `tsc --noEmit` é o detector de código morto: apagar os arquivos, compilar, remover o que ficar sem referência.
- **Getter de opções (US-006)** é o menor diff que faz `restart()` reler settings sem recriar o `LintServer` (que `Linter`, `FormattingEditProvider` e `EventSubscriber` referenciam). Recriar o servidor exigiria trocar a referência em quatro lugares.
- **Pool (US-009)** mantém `LintServer` intocado (um processo, um `cwd`, um token) e move a escolha "qual servidor" para um objeto só. `Linter.lintVersions` já é por documento, então não muda. `safe_config_file` não precisa relaxar: cada processo nasce na própria pasta.
- **`findFiles` (US-008, US-004)** respeita `files.exclude`/`search.exclude` do usuário; o segundo argumento adiciona `node_modules`/`vendor`/`tmp`/`log`/`public`. Em monorepos grandes o primeiro `getPartialIndex()` pode levar ~1 s; é assíncrono e só roda uma vez por invalidação. Se um watcher em `**/app/views/**` disparar em rajada (`git checkout`), `invalidatePartialIndex()` é barato (só zera a referência); o rebuild acontece no próximo uso.
- **Testes sem workspace.** O host do `vscode-test` não abre pasta (`.vscode-test.mjs` sem `workspaceFolder`), então `workspace.getWorkspaceFolder`, `asRelativePath` e `findFiles` são stubados nos testes (padrão já usado em `RoutesCompletionProvider.test.ts` e `AssetsDefinitionProvider.test.ts`). Onde a lógica for pura (resolução no índice, `shouldLintOnChange`, estados da status bar), testar a função pura com fakes injetados.
- **Gramática (US-003):** a regra de `locals:` precisa vir **antes** de `comment.line.slash.haml`/`comment.block.haml` na lista `patterns`, porque o TextMate usa a primeira regra que casa na posição.
- **Compat:** `engines.vscode ^1.103.0` cobre `StatusBarItem.backgroundColor`, `ThemeColor`, `onDidChangeWorkspaceFolders`, `CompletionItem.range`, `ProviderResult` assíncrono em `SignatureHelpProvider`.
- **Ruby:** nenhuma mudança em `lib/`; `bundle exec rake` e `rubocop` só confirmam que nada quebrou.

## 8. Métricas de sucesso

- `grep -r "src/formatter" src` vazio; Mocha verde com a suíte de formatter removida.
- Com haml_lint 0.75 instalado, "Format Document" corrige RuboCop e mostra o aviso uma vez; com 0.78, nenhum aviso.
- Alterar `hamlAll.useBundler` em Settings faz o output "Haml" mostrar "restarting the lint server" e o novo argv em menos de 5 s, sem reload.
- Com `hamlAll.lintOnType: false`, digitar num `.haml` não gera linhas "Linting file://…" no output; salvar gera uma.
- Status bar mostra `$(sync~spin) HAML` na ativação, `$(check) HAML` em seguida; `kill <pid do ruby>` a leva para `$(warning) HAML` e de volta para `$(check)` após o restart automático; o clique abre o output.
- Num app com `app/views/users/_user.html.haml`, F12 em `render @user`, `render user` e `render partial: "user", collection: @users` abre o partial; `render "row"` com `_row.html.haml` e `_row.turbo_stream.haml` mostra ambos no peek.
- Digitar `users_pa` numa linha `= ` sem `link_to` oferece `users_path`; aceitar produz `users_path` (não `users_pausers_path`).
- Num workspace com duas pastas (app Rails com `Gemfile` + gem sem `Gemfile`), o output mostra dois servidores em portas distintas e cada `.haml` recebe as ofensas do `.haml-lint.yml` da sua pasta.
- `npm run compile`, `npm test`, `bundle exec rake`, `bundle exec rubocop` verdes; `npm audit --audit-level=high` 0.
- Ao final, `tmp/relatorio-analise.md` seção 4 com M1–M9 ✅ e seção 7 sem residual de melhorias.

## 9. Decisões registradas e questões em aberto

### D1 — Formatter legado apagado, sem versão mínima (US-005)

Decisão do mantenedor (2026-09-12). O fallback em TypeScript sai por completo; com haml_lint < 0.74 o Format corrige só RuboCop (o que o servidor consegue) e avisa uma vez por sessão. Alternativas descartadas: exigir ≥ 0.74 (imporia upgrade a quem só quer highlight) e manter o fallback (dois caminhos de correção, com o legado rodando por engano nos primeiros segundos de toda sessão).

### D2 — Mudança em `useBundler`/`rubyCommand` reinicia automaticamente (US-006)

Decisão do mantenedor. Sem prompt: a mudança de setting já é a intenção explícita. O restart reutiliza `restartLintServer()` (mesmo tratamento de erro e reset do backoff).

### D3 — Só `hamlAll.lintOnType`; debounce fixo (US-006)

Decisão do mantenedor. `lintDebounceMs` fica fora até alguém pedir; 300 ms é o valor usado desde a v3.0.

### D4 — Status bar só em `.haml`, três estados (US-007)

Decisão do mantenedor. Alternativas descartadas: só no estado de aviso (o usuário não saberia se o lint está ativo) e sempre visível (ruído em arquivos não-HAML).

### D5 — Índice completo de partials, inflector ingênuo (US-008)

Decisão do mantenedor pelo escopo completo (`collection:`, `render @user`, variantes, múltiplos `app/views`). O inflector é ingênuo por escolha: a busca por `baseName` resolve `render @user` sem pluralizar, e a singularização só entra para `render @users`/`collection:`. Marcado com `ponytail:`.

### D6 — Rotas: um item por rota com snippet `path|url`; gatilho ampliado (US-004)

Decisão do mantenedor. `filterText` com `_path` e `_url` faz `users_url` casar o item mesmo com label `users_path`.

### D7 — Multi-root: um servidor por pasta; rotas e assets ficam na pasta 0 (US-009)

Decisão do mantenedor. Um processo por pasta é o único jeito de honrar `Gemfile` e `cwd` distintos sem mexer em `safe_config_file`. Rotas/assets multi-root ficam para um PRD próprio se houver demanda.

### D8 — `Linter.clear` ao fechar aba permanece (M6)

Decisão do mantenedor. Mesmo comportamento do ESLint.

### D9 — "Ranges cobrem a linha inteira" descartado

Não é decisão de produto: `HamlLint::Lint` não tem coluna (verificado na 0.78.0). Se o haml-lint um dia expuser, reabrir.

### Questões em aberto

Nenhuma.
