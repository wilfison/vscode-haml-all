# PRD: Correção dos bugs do relatório de análise (B1-B20)

Origem: `tmp/relatorio-analise.md`, seção 2 (B1-B20), 2026-09-12, branch `main` @ `1ba0eb8`.

## 1. Introdução / Visão geral

O relatório de análise da v3.1.0 lista 20 bugs confirmados. Três famílias dominam:

1. **Funcionalidades mortas.** Quase todos os quick fixes nunca aparecem no editor porque o código compara `diagnostic.code` (um objeto `{ value, target }`) com string e filtra apenas `source === 'haml-lint'`, excluindo as ofensas do RuboCop (B1).
2. **Configurações que não fazem o que prometem.** `railsRoutes.railsCommand` é ignorado ao carregar rotas (`Routes.execCmd` tem `bin/rails` fixo) e `hamlAll.linterExecutablePath` só afeta o probe `--version`, nunca o lint real (B2, B3, B4).
3. **Crashes e fragilidades.** `extractPartialNameFromLine` lança `TypeError` em qualquer linha com a palavra `render` fora do padrão esperado (B5); `Routes.execCmd` não trata `error`, rejeita em qualquer byte de stderr e tem corrida entre processos (B6); `parseLintOffence` pode lançar e descartar **todas** as diagnósticas do arquivo (B12).

Somam-se a isso uma família de bugs de Windows (`path.sep` aplicado a caminhos POSIX, B9), uma regra de `onEnterRules` que indenta depois de praticamente qualquer linha (B7), formatação que silenciosamente não faz nada por timeout curto (B8), servidor que não reinicia após morrer (B14) e um conjunto de itens menores e de código morto (B15-B20).

Os itens de segurança (S1-S5) já foram implementados e têm PRD próprio em `tasks/prd-seguranca-workspace-trust.md`. Este PRD cobre **apenas a seção 2 do relatório**.

## 2. Objetivos

- Todo quick fix registrado aparece no editor para a ofensa correspondente, tanto de `haml-lint` quanto de `RuboCop`, em qualquer severidade.
- Nenhum provider derruba o extension host nem engole todas as diagnósticas por causa de uma linha inesperada.
- Toda configuração publicada em `package.json` afeta de fato o comportamento que sua descrição promete, e vive no namespace `hamlAll.*`.
- As features de partials e assets produzem os mesmos nomes de arquivo no Windows e no Linux/macOS.
- O servidor de lint volta sozinho quando morre, e existe um comando para reiniciá-lo manualmente.
- Nenhuma função exportada sem uso permanece em `src/`.
- Cada correção de lógica deixa para trás um teste que falha se a lógica regredir.

## 3. User Stories

### US-001: Quick fixes voltam a ser oferecidos (B1)

**Descrição:** Como usuário com uma ofensa de haml-lint ou RuboCop no arquivo, quero ver a lâmpada com a correção automática, para não precisar corrigir à mão algo que a extensão já sabe arrumar.

**Contexto:** `DiagnosticFull.code` é `{ value, target }` (`src/linter/parser.ts:31`) e ofensas RuboCop têm `source: 'RuboCop'` (`parser.ts:30`). Hoje `FixActionsProvider.filterWarnings` (`src/providers/FixActionsProvider.ts:41`) exige `source === SOURCE` (`'haml-lint'`) **e** `severity === Warning`; `createGlobalRubocopActions` (linha 82) compara `diagnostic.code === 'RuboCop'`; e `fixSpaceBeforeScript` (`src/quick_fixes/spaceBeforeScript.ts:4`) compara `diagnostic.code !== 'SpaceBeforeScript'`.

**Critérios de aceite:**

- [ ] `filterWarnings` aceita `diagnostic.source` em `['haml-lint', 'RuboCop']` e **não** filtra por severidade (uma ofensa `error` do haml-lint também recebe ações).
- [ ] `createGlobalRubocopActions` filtra por `diagnostic.source === 'RuboCop'` (não por `code`), e `fixAllStringLiterals` é oferecido quando há uma ofensa cuja mensagem começa com `Style/StringLiterals:`.
- [ ] A checagem redundante de `diagnostic.code` dentro de `fixSpaceBeforeScript` é removida: `hamlLintFixes` (`src/quick_fixes/index.ts:18`) já despacha por `rule`, e o `rule` recebido já vem de `diagnostic.code.value`.
- [ ] Para ofensa com `source === 'RuboCop'`, a ação "Disable ... for this entire file" insere `-# haml-lint:disable RuboCop` (haml-lint não desabilita um cop individual do RuboCop por diretiva), e o título da ação diz `Disable \`RuboCop\` for this entire file`.
- [ ] Para ofensa com `source === 'haml-lint'`, a ação continua inserindo `-# haml-lint:disable <Cop>` com o nome do cop.
- [ ] Novo `src/test/providers/FixActionsProvider.test.ts` cobre: (a) ofensa `SpaceBeforeScript` severidade `Warning` → oferece o fix + o disable; (b) ofensa `SpaceBeforeScript` severidade `Error` → oferece as mesmas ações; (c) ofensa RuboCop `Style/StringLiterals` → oferece `fixStringLiterals`, `fixAllStringLiterals` e o disable com `haml-lint:disable RuboCop`; (d) ofensa de cop sem fix conhecido → oferece só o disable.
- [ ] Verificação manual documentada no PR: abrir um `.haml` com `=foo` e com `%p{class: "a"}`, confirmar que a lâmpada aparece nas duas linhas.
- [ ] `npm run compile` e `npm test` passam.

### US-002: `extractPartialNameFromLine` não lança mais (B5)

**Descrição:** Como usuário editando uma view que contém a palavra `render` em outro contexto, quero que "Go to Definition" e o signature help continuem funcionando, em vez de estourar `TypeError`.

**Contexto:** `src/utils/file.ts:41` faz `split(/render\(|render\ |render\: /)[1]` e usa o resultado sem checar `undefined`. Linhas como `%p= @rendered_count`, `= render_to_string(x)` e `= content_for :rendered` produzem `undefined` e quebram `ViewFileDefinitionProvider` e `PartialSignatureHelpProvider`.

**Critérios de aceite:**

- [ ] `extractPartialNameFromLine` retorna `''` (sem lançar) quando o split não produz a parte depois de `render`.
- [ ] Novo `src/test/utils/file.test.ts` cobre, retornando `''`: `'%p= @rendered_count'`, `'= render_to_string(@x)'`, `"= content_for :rendered"`, `'-# rendered'`, `''`.
- [ ] O mesmo teste cobre os casos que **devem** funcionar: `= render 'shared/header'` → `shared/_header`; `= render('form')` → `_form`; `= render partial: 'users/row'` → `users/_row`.
- [ ] `npm run compile` e `npm test` passam.

### US-003: Parser de ofensas resiliente (B12, B17)

**Descrição:** Como usuário, quero que uma ofensa reportada na última linha do arquivo não apague todas as diagnósticas, e que o código do cop nunca apareça como `"undefined"`.

**Contexto:** `src/linter/parser.ts:56` chama `document.lineAt(line)` sem limitar ao `lineCount - 1`; `FinalNewline`/`TrailingEmptyLines` reportam a última linha e, dependendo de o arquivo terminar em `\n`, `line` pode valer `lineCount` → exceção que aborta o `parse` inteiro (`src/linter/index.ts:176`). Na linha 17, `String(match?.at(1))` produz o literal `"undefined"` quando a mensagem do RuboCop não segue `Cop/Name:`.

**Critérios de aceite:**

- [ ] `parseLintOffence` limita a linha com `Math.min(line, document.lineCount - 1)` além do `Math.max(..., 0)` existente.
- [ ] `parseHamllintAttributes` usa `offense.linter_name` (`'RuboCop'`) como `code.value` quando o regex `RUBOCOP_COP_NAME_REGEX` não casa, em vez de `"undefined"`; nesse caso `code.target` aponta para a doc do haml-lint (`hamlCopUrl`), não para uma URL RuboCop inventada.
- [ ] Novo `src/test/linter/parser.test.ts` cobre: ofensa na linha `lineCount + 1` de um documento → diagnóstica criada na última linha, sem lançar; ofensa RuboCop com mensagem `Style/StringLiterals: Prefer single-quoted` → `code.value === 'Style/StringLiterals'`; ofensa RuboCop com mensagem sem `Cop/Name:` → `code.value === 'RuboCop'` e nenhuma ocorrência da string `undefined`.
- [ ] `npm run compile` e `npm test` passam.

### US-004: `Routes.execCmd` robusto e sem corrida (B6)

**Descrição:** Como usuário de um projeto Rails que imprime warnings no stderr, quero que as rotas carreguem de qualquer jeito, e que uma falha ao executar o comando não derrube a janela.

**Contexto:** `src/rails/routes.ts:125-154`. Não há `.on('error')` (um `spawn` que falha emite `error` não tratado e derruba o extension host); qualquer byte em stderr chama `reject(string)` e `load()` não tem try/catch (unhandled rejection); o handler `close` do processo antigo executa `this.process = null`, apagando a referência ao processo **novo** e resolvendo com saída parcial que é parseada como rotas válidas. Em `src/rails/router_parser.ts:26` o destructuring não checa o tamanho do bloco: um bloco de engine montada (`mount Sidekiq::Web`) sem linha de controller lança `TypeError`.

**Critérios de aceite:**

- [ ] `execCmd` registra `.on('error')` e rejeita a promise com um `Error` (não string), sem deixar evento não tratado.
- [ ] stderr é **apenas** logado no output channel (`Error: ...` vira `rails routes stderr: ...`); a promise nunca é rejeitada por causa de stderr.
- [ ] A promise só rejeita em `error` de spawn ou em `close` com `code !== 0`; a mensagem de erro inclui o comando, o exit code e a cauda do stderr.
- [ ] O handler `close` usa a referência local do processo que ele criou e só limpa `this.process` se `this.process === <esse processo>`, para não apagar a referência de um processo mais novo.
- [ ] `load()` envolve `await this.execCmd()` em try/catch: em falha, loga no output channel, mantém as rotas anteriores (não limpa o `Map`) e retorna sem lançar.
- [ ] `parseRawBlock` ignora blocos com menos de 4 linhas úteis (retorna `null`) e `formatObjectRoutes` descarta os `null`; nenhum `TypeError` com um fixture que contenha um bloco de engine montada.
- [ ] Novo `src/test/rails/router_parser.test.ts` com um fixture realista de `bin/rails routes -E` (incluindo uma engine montada sem `controller#action` e uma rota `redirect(...)`): `parseRoutes` retorna as rotas normais e não lança.
- [ ] `npm run compile` e `npm test` passam.

### US-005: `hamlAll.railsCommand` existe e é usado para carregar rotas (B2)

**Descrição:** Como usuário que roda Rails via `bundle exec rails` ou por um caminho absoluto, quero que as rotas carreguem com o meu comando, e quero a setting no mesmo namespace das outras.

**Contexto:** `src/rails/routes.ts:131` usa `'bin/rails'` fixo; a setting `railsRoutes.railsCommand` só é lida em `Helpers.isARailsProject` (`src/Helpers.ts:40`) e está fora do namespace `hamlAll.*`.

**Critérios de aceite:**

- [ ] `package.json` declara `hamlAll.railsCommand` (`string`, default `bin/rails`, `scope: machine`, com a mesma justificativa de segurança da setting atual).
- [ ] `railsRoutes.railsCommand` permanece declarada, com `"deprecationMessage"` apontando para `hamlAll.railsCommand`, e continua sendo lida como fallback quando `hamlAll.railsCommand` não foi definida explicitamente. Sem código de migração e sem remoção agendada. (Ver §9, decisão D1.)
- [ ] Um único helper (ex. `Helpers.railsCommand()`) resolve a precedência `hamlAll.railsCommand` → `railsRoutes.railsCommand` → `'bin/rails'`, e é usado tanto por `isARailsProject` quanto por `Routes`.
- [ ] `Routes.execCmd` usa esse comando. Se o comando resolvido contiver espaços (ex. `bundle exec rails`), ele é dividido em executável + argumentos antes do `spawn`, **sem** `shell: true`, já que o valor vem de configuração.
- [ ] Um caminho relativo é resolvido contra o root do workspace; um caminho absoluto é usado como está (mesma regra já aplicada em `isARailsProject`).
- [ ] Teste unitário do helper de resolução do comando (precedência e split de argumentos), sem depender de um Rails real.
- [ ] `README.md` documenta a nova setting e marca a antiga como deprecada.
- [ ] `npm run compile` e `npm test` passam.

### US-006: `hamlAll.rubyCommand` e descrição honesta de `linterExecutablePath` (B3)

**Descrição:** Como usuário de rbenv/asdf/mise que abre o VS Code pelo dock, quero poder apontar o Ruby que a extensão usa, em vez de receber `ENOENT` sem saída; e quero que a descrição de `linterExecutablePath` diga o que ela realmente faz.

**Contexto:** `src/server/processRunner.ts:70` faz `spawnFn('ruby', args, ...)` sem shell, então não vê shims de gerenciadores de versão quando o `PATH` do processo do VS Code não os inclui. `hamlAll.linterExecutablePath` é lida só em `Helpers.hamlLintPresent` (`src/Helpers.ts:28`), já que o servidor sempre roda `ruby lib/server.rb` + `require "haml_lint"`, mas sua descrição e o README a apresentam como "path to haml-lint executable".

**Critérios de aceite:**

- [ ] `package.json` declara `hamlAll.rubyCommand` (`string`, default `ruby`, `scope: machine`, descrição explicando que é o interpretador usado para rodar o servidor de lint e que é machine-scoped por segurança).
- [ ] `RubyServerConfig` ganha o comando e `startRubyServer` o usa no `spawn` em lugar do literal `'ruby'`; um valor com espaços é dividido em executável + argumentos, sem `shell: true`.
- [ ] Quando o spawn falha com `ENOENT`, a rejeição cita o comando tentado e a setting `hamlAll.rubyCommand` (ex.: `Failed to spawn "ruby": not found. Set hamlAll.rubyCommand to your Ruby path.`).
- [ ] A descrição de `hamlAll.linterExecutablePath` em `package.json` passa a dizer que ela é usada **apenas** na verificação de disponibilidade do haml-lint, e que o lint em si roda pelo `hamlAll.rubyCommand`; `README.md` é corrigido no mesmo sentido.
- [ ] Teste em `src/test/server/processRunner.test.ts` (já existe, usa `spawn` injetado): o comando configurado chega ao `spawn`, e um comando com argumentos é dividido corretamente.
- [ ] `npm run compile` e `npm test` passam.

### US-007: Sem falso "haml-lint not found" com `useBundler` (B4)

**Descrição:** Como usuário cujo haml-lint só existe dentro do bundle, não quero um erro modal a cada ativação dizendo que ele não está instalado, quando o lint funciona.

**Contexto:** `Helpers.hamlLintPresent` roda `haml-lint --version` global independentemente de `hamlAll.useBundler`; `ExtensionActivator.activateTrusted` (`src/ExtensionActivator.ts:91`) exibe `showErrorMessage` quando o probe falha.

**Critérios de aceite:**

- [ ] Com `hamlAll.useBundler: true`, o probe global não roda e nenhum erro de "não encontrado" é exibido: a falha real, se houver, já chega pelo `startServer` (`src/linter/index.ts:106`), que mostra a cauda do stderr do servidor.
- [ ] Com `hamlAll.useBundler: false`, o comportamento atual é preservado.
- [ ] Teste em `src/test/Helpers.test.ts` cobrindo os dois ramos (com o `execFile` real substituído ou com a função de probe injetada).
- [ ] `npm run compile` e `npm test` passam.

### US-008: `onEnterRules` só indenta onde faz sentido (B7)

**Descrição:** Como usuário digitando HAML, quero que o Enter indente depois de um bloco ou de uma tag vazia, e **não** depois de `= render "foo"` ou `%p Hello world`.

**Contexto:** `haml-configuration.json:38` usa o padrão `^\s*[%\.#-=][\w\s][\w\d\-\|]*[^>]*[^\)]$`. O trecho `#-=` dentro do character class é um **range** (0x23-0x3D) que inclui dígitos, `(`, `)`, `,`, `:`, `<`. Verificado: `= render "foo"`, `%p Hello world` e `= link_to "x", path` todos disparam indentação. Além disso `blockComment: ["-#", ""]` é inválido.

**Critérios de aceite:**

- [ ] O character class passa a ser `[%.#=-]` (ou equivalente com `-` escapado/no fim), eliminando o range acidental.
- [ ] `onEnterRules` indenta depois de: `^\s*-\s*(if|unless|case|while|until|for|begin)\b`, linha terminando em `\bdo(\s*\|[^|]*\|)?\s*$`, tag HAML sem conteúdo inline (`^\s*[%.#][\w\-.#]*(\{.*\}|\(.*\))?\s*$`) e filtro (`^\s*:[a-z]+\s*$`).
- [ ] `onEnterRules` **não** indenta depois de `= render "foo"`, `%p Hello world`, `= link_to "x", path`, `- foo = bar`.
- [ ] `indentationRules.decreaseIndentPattern` cobre `^\s*-\s*(else|elsif|when|rescue|ensure|end)\b`.
- [ ] `blockComment` é removido da configuração (HAML não tem comentário de bloco delimitado); `lineComment: "-#"` permanece.
- [ ] Verificação manual documentada no PR (com a extensão em modo dev): em cada uma das 8 linhas acima, pressionar Enter e conferir a indentação resultante.

### US-009: Formatação não falha mais em silêncio (B8)

**Descrição:** Como usuário formatando um arquivo grande, quero que a formatação conclua, e que um timeout me avise em vez de devolver o texto original sem explicação.

**Contexto:** `TIMEOUTS.autocorrectMs = 1000` (`src/server/protocol.ts:28`) inclui o tempo de fila no servidor Ruby, que é single-thread: um lint em curso (RuboCop em arquivo grande passa de 1 s) faz o autocorrect estourar, e `LintServer.autocorrect` devolve o template original (`src/server/index.ts:116`), com `FormattingEditProvider` retornando `[]` sem avisar. Além disso o autocorrect roda mesmo com `hamlAll.lintEnabled: false`.

**Critérios de aceite:**

- [ ] `TIMEOUTS.autocorrectMs` passa a `10000`, com comentário explicando que o orçamento inclui a fila do servidor single-thread.
- [ ] `FormattingEditProvider.provideDocumentFormattingEdits` cancela o lint debounced pendente antes de chamar o autocorrect (expor um método no `Linter`/`EventSubscriber` para isso).
- [ ] Quando o autocorrect falha ou estoura o timeout, o usuário recebe `window.showWarningMessage('HAML formatting timed out. See the "Haml" output for details.', 'Show Output')`, **no máximo uma vez por sessão**: um flag booleano no provider suprime as notificações seguintes e é rearmado na primeira formatação bem-sucedida. Toda falha, notificada ou não, é sempre registrada no output channel. (Ver §9, decisão D4.)
- [ ] `LintServer.autocorrect` precisa distinguir "sem mudanças" de "falhou" (ex. retornar `null` em falha e o provider tratar).
- [ ] Teste cobrindo o flag: duas falhas consecutivas → uma notificação; falha, sucesso, falha → duas notificações.
- [ ] Com `hamlAll.lintEnabled: false`, `provideDocumentFormattingEdits` retorna `[]` imediatamente, sem chamar o servidor.
- [ ] Teste cobrindo: autocorrect que rejeita/estoura → provider retorna `[]` e não lança; `lintEnabled: false` → servidor não é chamado (usar um `LintServer` falso, como em `src/test/server/fakeServer.ts`).
- [ ] `npm run compile` e `npm test` passam.

### US-010: Caminhos POSIX unificados (B9)

**Descrição:** Como usuário de Windows, quero que os nomes de partials e assets saiam corretos, em vez de misturarem `\` e `/`.

**Contexto:** `workspace.asRelativePath` e `Uri.path` sempre usam `/`, mas o código divide por `path.sep`: `src/providers/ViewCompletionProvider.ts:18,27,71,76,79` (score e nome do partial errados), `src/providers/RoutesCompletionProvider.ts:20-21`, `src/providers/ViewCodeActionProvider.ts:121` (`getPartialName`, partial criado com nome errado), `src/utils/file.ts:22,65,94,102` (mistura `/` literal com `fsPath`, que no Windows usa `\`), e `AssetsCompletionProvider.getAssetName` (`src/providers/AssetsCompletionProvider.ts:110`), que insere `relativePath` com `\` no HAML.

**Critérios de aceite:**

- [ ] Um único helper exportado em `src/utils/file.ts`, `toPosix(p: string): string`, converte `\` em `/` (`p.split(path.sep).join('/')`, idempotente para caminhos já POSIX).
- [ ] Todos os `split(path.sep)`/`join(path.sep)` e `path.join` aplicados a caminhos relativos ou a `Uri.path` nos arquivos acima passam a usar `path.posix` e/ou `toPosix`.
- [ ] Todo `fsPath` usado como string para split ou comparação passa por `toPosix` antes.
- [ ] `src/test/utils/file.test.ts` cobre `toPosix` (entrada Windows, entrada POSIX, string vazia) e `isPartialDocument` com `fileName` em estilo Windows.
- [ ] Teste de `ViewCompletionProvider.buildCompletionItem`/`matchScore` (extraídos ou exportados se necessário) com caminhos `app/views/users/_row.haml` em estilo POSIX e Windows produzindo o mesmo `partialPath`.
- [ ] `AssetsCompletionProvider.getAssetName` nunca retorna uma string contendo `\` (teste no arquivo existente `src/test/providers/AssetsCompletionProvider.test.ts`).
- [ ] `npm run compile` e `npm test` passam.

### US-011: CodeLens do controller não quebra com `/app/` no caminho do workspace (B10)

**Descrição:** Como usuário cujo projeto vive em um caminho que contém `/app/` (ex. `/home/x/app/projeto`), quero que o "Jump to controller Action" abra o controller certo.

**Contexto:** `src/providers/CodeLensProvider.ts:52,59` usa `document.uri.path.split('/app/views/')[1]` e `split('/app/')[0]` no caminho absoluto; o primeiro `/app/` do caminho ganha.

**Critérios de aceite:**

- [ ] `getControllerFilePath` usa `workspace.getWorkspaceFolder(document.uri)` + `path.relative` para obter o caminho relativo ao root, e só então localiza o prefixo `app/views/`.
- [ ] Sem workspace folder para o documento (arquivo solto), retorna `['', 0]` sem lançar.
- [ ] Novo `src/test/providers/CodeLensProvider.test.ts` cobre: workspace em `/home/x/app/projeto` com a view `app/views/users/index.html.haml` → controller resolvido como `/home/x/app/projeto/app/controllers/users_controller.rb`; view fora de `app/views` → `['', 0]`.
- [ ] `npm run compile` e `npm test` passam.

### US-012: `activeParameter` do signature help acompanha o cursor (B11)

**Descrição:** Como usuário digitando `= render 'form', a: 1, b: 2`, quero que o parâmetro destacado avance conforme eu digito vírgulas, em vez de travar no primeiro.

**Contexto:** `src/providers/PartialSignatureHelpProvider.ts:43` testa `signatureHelp.signatures.length > 2`, mas `signatures` sempre tem exatamente 1 elemento, então o `else` fixa `activeParameter = 1`.

**Critérios de aceite:**

- [ ] A condição passa a comparar com a quantidade de parâmetros da assinatura (`signatureHelp.signatures[0].parameters.length`) e `activeParameter` é limitado a `parameters.length - 1`.
- [ ] Novo `src/test/providers/PartialSignatureHelpProvider.test.ts` cobre: 0 vírgulas → `activeParameter === 0`; 1 vírgula → `1`; 3 vírgulas com 3 parâmetros → último índice válido, nunca fora do range.
- [ ] `npm run compile` e `npm test` passam.

### US-013: `html2Haml` reporta erro de verdade e não bloqueia o editor (B13)

**Descrição:** Como usuário sem a gem `html2haml`, quero uma mensagem clara dizendo como instalá-la, em vez de um erro genérico do VS Code; e quero que a conversão não congele o editor.

**Contexto:** `src/html2Haml.ts:8` usa `exec(command)` (assíncrono) dentro de try/catch: nunca lança, então `html2HamlAvailable` sempre retorna `true`. Depois `execSync` (linha 26) lança sem tratamento e bloqueia o extension host, e roda sem `cwd` do workspace: com `useBundler`, `bundle exec` não acha o `Gemfile` do projeto. `newFilePath` (linha 31) não trata `.htm`.

**Critérios de aceite:**

- [ ] `html2HamlAvailable` é removida (a checagem era inoperante); a ausência da gem é detectada pela falha da própria conversão.
- [ ] A conversão usa `execFile` assíncrono (com `await`), com `cwd` no root do workspace, sem `shell: true`, e com timeout.
- [ ] Em falha, o usuário recebe uma mensagem única contendo o comando tentado e a instrução de instalação (`gem install html2haml`, ou adicionar ao `Gemfile` com `hamlAll.useBundler`); a saída completa vai para o output channel "Haml".
- [ ] `newFilePath` cobre `.html.erb` → `.html.haml`, `.erb` → `.haml`, `.html` → `.haml` e `.htm` → `.haml`.
- [ ] Novo `src/test/html2Haml.test.ts` cobre as 4 conversões de nome de arquivo de `newFilePath` (exportando-a para teste).
- [ ] Verificação manual documentada no PR: com a gem ausente, confirmar a mensagem de instalação; com a gem presente, converter um `.html.erb` de exemplo.
- [ ] `npm run compile` e `npm test` passam.

### US-014: Servidor de lint reinicia e pode ser reiniciado à mão (B14)

**Descrição:** Como usuário cujo servidor Ruby morreu (OOM, `kill`, `bundle install`), quero que o lint volte sozinho, e ter um comando para reiniciá-lo quando não voltar, em vez de descobrir depois que nada acontece mais.

**Contexto:** `LintServer.start` é chamado uma única vez por `Linter.startServer` (`src/linter/index.ts:94`). Quando o processo morre, `rubyServerProcess` vira `null` (`src/server/index.ts:170`) e `Linter.lint` passa a retornar cedo (`linter/index.ts:139`) silenciosamente até um reload da janela. Além disso, se o extension host morrer, `ruby server.rb` fica rodando indefinidamente ocupando a porta.

**Critérios de aceite:**

- [ ] Quando o processo fecha fora de `deactivate`/`stop()`, `LintServer` tenta reiniciar com backoff (ex. 1 s, 4 s, 16 s), no máximo 3 tentativas; cada tentativa é logada no output channel.
- [ ] Depois de um restart bem-sucedido, as diagnósticas do workspace são recalculadas (reaproveitar `EventSubscriber.updateAllDiagnostics`) e as configs recarregadas (`Linter.loadConfigs`).
- [ ] Esgotadas as tentativas, o usuário recebe `showErrorMessage` com o botão "Show Output" e a informação de que há o comando de restart.
- [ ] Novo comando `hamlAll.restartLintServer`, título `HAML: Restart lint server`, declarado em `package.json` e registrado em `ExtensionActivator`. Em workspace não confiável, exibe aviso e não faz nada (mesma política de `html2Haml`).
- [ ] O comando manual é o **único** jeito de zerar o contador de tentativas: não há reset por tempo nem timer de "servidor estável". (Ver §9, decisão D2.)
- [ ] `stop()` e `dispose()` marcam o desligamento como intencional, para o restart automático não disparar na desativação da extensão.
- [ ] `lib/server.rb` ganha um watchdog: uma thread que lê `$stdin` até EOF e então encerra o processo, para o servidor não sobreviver à morte do extension host. O watchdog só é armado quando `$stdin` é um pipe (não quebra a execução manual nem a suíte Minitest).
- [ ] Teste em `src/test/server/index.test.ts` com `spawn` injetado: ao emitir `close` inesperado, um novo spawn acontece; após `stop()`, um `close` não dispara spawn; esgotadas as 3 tentativas, nenhum spawn adicional.
- [ ] Teste Minitest cobrindo que o watchdog não é armado quando `$stdin` não é pipe.
- [ ] `npm run compile`, `npm test`, `bundle exec rake` e `bundle exec rubocop` (0 ofensas) passam.

### US-015: Remover o fixer no-op `fixTrailingEmptyLines` (B15)

**Descrição:** Como mantenedor, quero remover um fixer que não faz nada, para não manter código e teste que dão falsa confiança.

**Contexto:** `src/formatter/haml_lint_cops.ts:18` aplica `/\n{2,}$/gm` **por linha** (o formatter já fez `split('\n')`), onde nenhum `\n` existe. Testes em `src/test/formatter/haml_lint_cops.test.ts:96,106` exercitam a função com texto multilinha, o que não reflete como ela é chamada.

**Critérios de aceite:**

- [ ] `fixTrailingEmptyLines` é removida de `src/formatter/haml_lint_cops.ts`, da tabela `linter_cops` e do export default.
- [ ] Os testes correspondentes em `src/test/formatter/haml_lint_cops.test.ts` são removidos.
- [ ] `TrailingEmptyLines` permanece no tipo `LinterConfig` (`src/types.d.ts`), pois ainda é um cop reportado pelo servidor.
- [ ] Verificação manual documentada no PR: formatar um arquivo com 3 linhas vazias no fim continua produzindo o mesmo resultado que hoje (o cop nativo do haml-lint cuida disso).
- [ ] `npm run compile` e `npm test` passam.

### US-016: `createPartialFromSelection` gera locals corretos (B16)

**Descrição:** Como usuário extraindo um partial de uma seleção, quero que os locals declarados correspondam às variáveis de instância de verdade, que eu possa criar `shared/_foo`, e que um arquivo já existente não seja sobrescrito em silêncio.

**Contexto:** `src/providers/ViewCodeActionProvider.ts`. `globalVariableList` (linha 127) usa `/(@[\w\d_]*)/g` e captura `@bar` de `mailto:foo@bar.com`, verificado. `formatPartialVariables` (linha 141) usa `new RegExp(variable, 'g')` sem escapar e sem `\b`. A sanitização do nome remove `/`, impedindo `shared/_foo`. `edit.createFile(uri)` falha em silêncio se o partial já existe (`applyEdit` retorna `false`, e o retorno é ignorado). `wrapContentInBlock` (linhas 195-206) tem `if`/`else` com corpos idênticos.

**Critérios de aceite:**

- [ ] `globalVariableList` exige início de palavra antes do `@` (ex. `(?<![\w@])@([A-Za-z_]\w*)`), então não captura `@bar` de `mailto:foo@bar.com` nem `@@classvar`.
- [ ] `formatPartialVariables` escapa o nome da variável no regex e usa fronteira à direita (`(?![\w])`), para `@user` não casar dentro de `@user_id`.
- [ ] O nome informado pelo usuário aceita `/` (ex. `shared/foo` cria `app/views/shared/_foo.html.haml` e renderiza `= render('shared/foo')`); segmentos `.`/`..` e caminhos absolutos são rejeitados com mensagem.
- [ ] Se o arquivo de destino já existe, o comando avisa (`showErrorMessage`) e não altera nada: o retorno de `workspace.applyEdit` é verificado.
- [ ] O `if`/`else` idêntico em `wrapContentInBlock` é reduzido a uma atribuição.
- [ ] Testes em `src/test/providers/ViewCodeActionProvider.test.ts` (já existe) cobrem: `globalVariableList` com `mailto:foo@bar.com` → `[]`; conteúdo com `@user` e `@user_id` → substituição correta dos dois; nome `shared/foo` → caminho e texto de render esperados; nome `../x` → rejeitado.
- [ ] `npm run compile` e `npm test` passam.

### US-017: "Change to ... quotes" não corrompe a seleção (B18)

**Descrição:** Como usuário selecionando um trecho como `"a" + "b"`, não quero que a ação de trocar aspas produza `'a" + "b'`.

**Contexto:** `src/providers/FixActionsProvider.ts:96-113` só compara o primeiro e o último caractere da seleção.

**Critérios de aceite:**

- [ ] A ação só é oferecida quando a seleção é uma única string literal: começa e termina com a mesma aspa **e** não contém essa aspa no meio.
- [ ] Teste em `src/test/providers/FixActionsProvider.test.ts` cobre: `"abc"` → ação oferecida; `"a" + "b"` → não oferecida; `'it\\'s'` → não oferecida; seleção sem aspas → não oferecida.
- [ ] `npm run compile` e `npm test` passam.

### US-018: Watchers param de disparar em `node_modules` e assets compilados (B19)

**Descrição:** Como usuário de um projeto com engines e assets compilados, não quero recarregar rotas (que levam segundos) por causa de um `config/routes.rb` dentro de `vendor/bundle`, nem invalidar o índice de assets a cada arquivo do webpack.

**Contexto:** `src/EventSubscriber.ts:142,152` usa padrões `**/...` que casam dentro de `node_modules` e `vendor/bundle`; `subscribeAssetWatchers` (linha 165) inclui `**/public/**`, que cobre `public/assets` e `public/packs`.

**Critérios de aceite:**

- [ ] Os watchers usam `RelativePattern` ancorado no workspace folder com padrões relativos (`.haml-lint.yml`, `config/routes.rb`, `config/routes/**/*.rb`), em vez de `**/...` global.
- [ ] Os padrões de assets também usam `RelativePattern` relativo ao root (`app/assets/**`, `app/javascript/**`, `app/frontend/**`, `public/**`, `vendor/assets/**`).
- [ ] O callback do watcher de assets ignora caminhos cujos segmentos incluam `assets`, `packs`, `packs-test`, `builds` ou `vite` sob `public/`, para `assets:precompile`/webpack watch não invalidarem o índice continuamente.
- [ ] Teste da função de decisão "este caminho invalida o índice?" (extraída como função pura) com os casos: `public/images/logo.png` → sim; `public/assets/application-abc123.js` → não; `public/packs/js/x.js` → não; `app/assets/images/a.png` → sim.
- [ ] `npm run compile` e `npm test` passam.

### US-019: Remover código morto e scripts obsoletos (B20)

**Descrição:** Como mantenedor, quero que `src/` não contenha funções exportadas sem uso nem scripts que contradizem o processo documentado, para ninguém os usar por engano.

**Contexto:** Verificado por grep (0 referências fora da própria definição): `src/utils/array.ts` (`stringContainsAny`), `src/utils/ruby.ts` (`stringReplace`, `RESERVED_RUBY_WORDS`), `notifyErrors` e `LinterConfigWithErrors` (`src/linter/parser.ts:70`, `src/types.d.ts:37`), `simpleAutoFixOnSave` em `ExtensionConfig` (`src/types.d.ts:6`, não existe em `package.json`), `EventSubscriber.unsubscribe` (`src/EventSubscriber.ts:63`), o parâmetro `enable` de `createWorkspaceEdit` (`src/providers/FixActionsProvider.ts:63`). `bin/test` usa exatamente o padrão `ruby -Ilib:test test/**/*_test.rb` que o `AGENTS.md` proíbe, e `bin/release` cria a tag sem o prefixo `v` exigido por `release.yml`. `src/test/extension.test.ts` é o boilerplate do gerador (`[1,2,3].indexOf(5)`). `package.json` declara `tags` e `recommendations`, que o VS Code não reconhece (`keywords` já existe e duplica `tags`).

**Correção ao relatório:** `ExtensionActivator.dispose` **não** é código morto: `src/extension.ts:31` o chama em `deactivate()`, e ele é o único ponto que para o servidor Ruby (`this.lintServer?.stop()`). Fica onde está. (Ver §9, decisão D3.)

**Critérios de aceite:**

- [ ] Arquivos removidos: `src/utils/array.ts`, `src/utils/ruby.ts`, `bin/test`, `bin/release` (e o diretório `bin/` se ficar vazio).
- [ ] Símbolos removidos: `notifyErrors`, `LinterConfigWithErrors`, `simpleAutoFixOnSave`, `EventSubscriber.unsubscribe`, parâmetro `enable` de `createWorkspaceEdit`.
- [ ] `ExtensionActivator.dispose` **permanece** (é chamado em `src/extension.ts:31`); nenhuma mudança nele nesta story além do que US-014 exigir para marcar o desligamento como intencional.
- [ ] `src/test/extension.test.ts` é substituído por um smoke test real: a extensão ativa e o comando `hamlAll.restartLintServer` (ou outro comando contribuído) está registrado em `vscode.commands.getCommands(true)`.
- [ ] `package.json`: `tags` e `recommendations` removidos; `keywords` mantido.
- [ ] `npm run compile` (inclui `eslint src`) passa sem warning de import não usado, e `npm test` passa.

### US-020: Limpar a gramática HAML (B20)

**Descrição:** Como usuário, quero highlight correto nos filtros que a extensão ainda não cobre e sem regras duplicadas se atropelando.

**Contexto:** `syntaxes/haml.json` tem `^(\s*):ruby` em 4 variações (linhas 22, 61, 212, 222, 262) e `^(\s*):plain$` duplicado (252, 302). `^(\s*)%script` (linha 51) inicia contexto JS na mesma linha, engolindo atributos `{src: ...}`. Os filtros `:erb`, `:escaped`, `:preserve`, `:cdata`, `:less` não têm highlight.

**Critérios de aceite:**

- [ ] Os padrões duplicados de `:ruby` e `:plain` são consolidados em um por filtro; o arquivo continua válido como JSON e a extensão carrega sem erro no Output > Log (Extension Host).
- [ ] `%script`/`%style` só iniciam o contexto embutido nas **linhas filhas** (indentação maior), de modo que `%script{src: "x.js"}` mantenha os atributos como Ruby/HAML.
- [ ] Filtros adicionados: `:erb` (embutindo `text.html.erb`), `:preserve`, `:escaped` e `:cdata` como `string.unquoted`, `:less` com o mesmo tratamento de `:css`.
- [ ] Verificação manual documentada no PR com um arquivo de exemplo em `tmp/` exercitando cada filtro e `%script{src: "x.js"}`, usando "Developer: Inspect Editor Tokens and Scopes" para confirmar os escopos; o arquivo de exemplo não é commitado.

### US-021: Corrigir a descrição do release no `AGENTS.md` (B20)

**Descrição:** Como agente ou contribuidor lendo o guia, quero que a descrição do release corresponda ao que o workflow faz.

**Contexto:** `AGENTS.md` diz que o release faz "package → publish → GitHub Release", mas `.github/workflows/release.yml` apenas empacota o `.vsix` e o anexa à Release, sem rodar `vsce publish`.

**Critérios de aceite:**

- [ ] A seção "Releasing" do `AGENTS.md` descreve o fluxo real (package → GitHub Release com o `.vsix` anexado) e registra explicitamente que a publicação no Marketplace é manual.
- [ ] `CONTRIBUTING.md` é verificado e corrigido se repetir a afirmação errada.
- [ ] Nenhuma mudança de comportamento no workflow (publicação automática é explicitamente fora de escopo, ver §5).

## 4. Requisitos funcionais

Quick fixes e diagnósticas:

- FR-1: `FixActionsProvider` deve considerar diagnósticas com `source` igual a `haml-lint` ou `RuboCop`, em qualquer severidade.
- FR-2: O sistema deve usar `diagnostic.code.value`, nunca `diagnostic.code`, ao comparar o nome de um cop.
- FR-3: Para uma ofensa do RuboCop, a ação de desabilitar deve inserir `-# haml-lint:disable RuboCop`.
- FR-4: `parseLintOffence` deve limitar a linha reportada ao intervalo válido do documento e nunca lançar por causa de uma ofensa fora do intervalo.
- FR-5: Quando a mensagem do RuboCop não contiver `Cop/Name:`, o código da diagnóstica deve ser `RuboCop`, nunca a string `"undefined"`.
- FR-6: A ação "Change to ... quotes" deve ser oferecida apenas quando a seleção for uma única string literal.

Partials, views e caminhos:

- FR-7: `extractPartialNameFromLine` deve retornar string vazia para qualquer linha que contenha `render` sem um alvo reconhecível, sem lançar.
- FR-8: Todo caminho relativo manipulado como string deve usar separador `/`, obtido por um único helper de normalização, em qualquer sistema operacional.
- FR-9: `CodeLensProvider` deve resolver o controller a partir do caminho relativo ao workspace folder, não por busca do primeiro `/app/` no caminho absoluto.
- FR-10: O `activeParameter` do signature help deve ser derivado da quantidade de vírgulas digitadas, limitado ao número de parâmetros da assinatura.
- FR-11: `createPartialFromSelection` deve aceitar nomes com `/`, recusar travessia de diretório, recusar sobrescrever um arquivo existente e só declarar como locals variáveis de instância reais.

Rails e rotas:

- FR-12: `Routes.execCmd` deve tratar o evento `error` do `spawn`, tratar stderr como log (não como falha) e rejeitar apenas em erro de spawn ou exit code diferente de zero.
- FR-13: O handler `close` de um processo de rotas não deve limpar a referência de um processo mais novo.
- FR-14: `Routes.load` deve capturar falhas de `execCmd`, preservar as rotas já carregadas e não produzir unhandled rejection.
- FR-15: `parseRawBlock` deve ignorar blocos incompletos (engine montada, redirect) em vez de lançar.
- FR-16: O comando do Rails deve vir de `hamlAll.railsCommand`, com `railsRoutes.railsCommand` como fallback deprecado, e ser usado tanto na detecção do projeto quanto no carregamento das rotas.

Servidor e formatação:

- FR-17: O interpretador Ruby usado para iniciar o servidor deve vir de `hamlAll.rubyCommand` (default `ruby`), e a falha `ENOENT` deve citar essa setting.
- FR-18: Com `hamlAll.useBundler: true`, o sistema não deve executar o probe `haml-lint --version` global nem exibir erro de "haml-lint não encontrado" derivado dele.
- FR-19: O timeout de autocorrect deve ser de 10 s, e o lint pendente deve ser cancelado antes de formatar.
- FR-20: Uma formatação que falha ou estoura o timeout deve notificar o usuário.
- FR-21: Com `hamlAll.lintEnabled: false`, a formatação não deve chamar o servidor.
- FR-22: O sistema deve reiniciar o servidor automaticamente (até 3 tentativas com backoff) quando ele morrer sem ter sido parado de propósito, e expor o comando `hamlAll.restartLintServer`.
- FR-23: O servidor Ruby deve encerrar quando seu stdin fechar (morte do extension host), quando stdin for um pipe.

Editor, watchers e higiene:

- FR-24: `onEnterRules` deve indentar apenas depois de blocos Ruby, tags sem conteúdo inline e filtros; `indentationRules.decreaseIndentPattern` deve cobrir `else/elsif/when/rescue/ensure/end`.
- FR-25: Os watchers devem ser ancorados no workspace folder via `RelativePattern`, e a invalidação do índice de assets deve ignorar diretórios de build sob `public/`.
- FR-26: `src/` não deve conter funções, tipos ou parâmetros exportados sem referência; `bin/test` e `bin/release` devem ser removidos.
- FR-27: A gramática não deve ter padrões duplicados para o mesmo filtro, e `%script`/`%style` devem embutir JS/CSS apenas nas linhas filhas.
- FR-28: Toda correção visível ao usuário deve ser registrada em `CHANGELOG.md` sob `## [Unreleased]`, sem bump de versão (conforme `AGENTS.md`).

## 5. Não-objetivos (fora de escopo)

- Itens de segurança S1-S5: já implementados; ver `tasks/prd-seguranca-workspace-trust.md`.
- Seção 4 do relatório (melhorias M1-M9), exceto o que está acoplado a um bug: o status bar item (M1), a leitura dinâmica de `useBundler`, `hamlAll.lintOnType`/`lintDebounceMs` (M2), a aposentadoria do formatter legado (M3), o índice de partials (M4), melhorias de rotas e completions (M5), `.haml-lint.yml` por diretório e multi-root (M6), registro de providers fora de projetos Rails (M7), injection grammars (M8) e as demais limpezas de M9 não incluídas em US-019.
- Seção 6 do relatório (features novas), incluindo "Fix all autocorrectable", range formatting, hover de cops, rename de partial, diagnóstico de partial não encontrado e publicação automática no Marketplace.
- Job `windows-latest` no CI. As correções de B9 são cobertas por testes de funções puras no job atual; adicionar a matriz de SO é decisão separada.
- Suporte multi-root (`workspaceFolders[0]` continua sendo a raiz assumida).
- Qualquer bump de versão em `package.json`/`package-lock.json`: o release é do mantenedor.

## 6. Considerações de design

- As mudanças de `haml-configuration.json` (US-008) e de `syntaxes/haml.json` (US-020) são as únicas sem teste automatizado possível no setup atual; ambas exigem verificação manual documentada no PR, com "Developer: Inspect Editor Tokens and Scopes" para os escopos.
- As mensagens ao usuário (timeout de formatação, servidor morto, html2haml ausente) devem dizer o que fazer, não apenas o que falhou, e sempre oferecer "Show Output" quando houver detalhe no output channel "Haml".
- Uma correção que melhore a descrição de uma setting (`linterExecutablePath`) precisa atualizar `package.json` **e** `README.md` juntos: hoje os dois prometem a mesma coisa errada.

## 7. Considerações técnicas

- **Onde registrar providers:** `ExtensionActivator.registerHamlProviders` / `registerRailsProviders` / `activateTrusted`. Tudo que roda ferramenta Ruby vive em `activateTrusted`; o comando de restart (US-014) também precisa respeitar o gate de trust.
- **Subscriptions:** todo watcher, provider e comando novo vai para `context.subscriptions` (ver `AGENTS.md`).
- **Testes TypeScript:** mocha sob `src/test/`, compilados por `tsc -p ./` para `out/` e executados por `vscode-test`. Espelhar o layout de `src/` (ex. `src/linter/parser.ts` → `src/test/linter/parser.test.ts`). Para evitar o servidor Ruby real, reutilizar o padrão de `src/test/server/fakeServer.ts` e a injeção de `spawn` já presente em `startRubyServer` (`src/server/processRunner.ts`).
- **Testes Ruby (US-014):** Minitest sob `test/`, rodados por `bundle exec rake`, nunca `ruby -Ilib:test test/**/*_test.rb`. `bundle exec rubocop` precisa ficar em 0 ofensas; não usar `# rubocop:disable` para escapar de `Metrics/*`, extrair helper.
- **Bundle:** o shipped code vem de `dist/extension.js` (esbuild). Caminhos de assets embarcados (`lib/`, `templates/`) resolvem por `getExtensionRoot()` (`src/utils/extensionRoot.ts`), nunca `path.join(__dirname, '..')`.
- **Log:** sempre no output channel "Haml"; `console.log` é proibido.
- **Ordem de execução sugerida** (dependências reais entre as stories):
  1. US-001, US-002, US-003 (independentes, alto impacto, destravam testes).
  2. US-004 → US-005 (US-005 mexe na mesma função que US-004; fazer na ordem evita conflito).
  3. US-006 → US-007 (ambas tocam `Helpers`/settings do servidor).
  4. US-009 → US-014 (o restart muda o ciclo de vida que o timeout da formatação observa).
  5. US-008, US-010, US-011, US-012, US-013, US-015 a US-021 (independentes entre si).

## 8. Métricas de sucesso

- Abrir um `.haml` com uma ofensa `SpaceBeforeScript` e uma `Style/StringLiterals` oferece, respectivamente, o fix específico e o "Autocorrect all occurrences": hoje nenhum dos dois aparece.
- Nenhuma das funções listadas em §5 de "lacunas de teste" do relatório (`FixActionsProvider`, `linter/parser`, `rails/router_parser`, `utils/file`, `PartialSignatureHelpProvider`, `CodeLensProvider`, `html2Haml`) permanece sem teste.
- Digitar `= render "foo"` + Enter não indenta; digitar `- items.each do |item|` + Enter indenta.
- `kill` no processo `ruby server.rb` faz o lint voltar sozinho em menos de ~20 s, sem reload da janela.
- Formatar um arquivo de 500+ linhas com RuboCop ativo aplica as correções, em vez de não fazer nada.
- `npm run compile`, `npm test`, `bundle exec rake` e `bundle exec rubocop` (0 ofensas) verdes ao fim de cada story.

## 9. Decisões registradas

Nenhuma questão em aberto. As quatro dúvidas levantadas na primeira versão deste PRD estão resolvidas abaixo; quem implementar segue estas decisões sem reabrir o debate.

### D1: `railsRoutes.railsCommand` fica, sem data de remoção (US-005)

A setting antiga continua declarada e continua sendo lida como fallback, com `deprecationMessage` apontando para `hamlAll.railsCommand`. **Não** haverá código de migração (nada de reescrever a configuração do usuário) nem remoção agendada neste PRD.

Motivo: remover a setting é breaking change, e breaking change pertence a um major, que é decisão do mantenedor no momento do release, não deste PRD. O custo de mantê-la é a linha de fallback em `Helpers.railsCommand()`; o custo de removê-la agora é quebrar silenciosamente quem já configurou `bundle exec rails`. Quando o próximo major for cortado, a remoção é um diff de 4 linhas e uma nota no CHANGELOG.

### D2: Reset do backoff só pelo comando manual (US-014)

3 tentativas com backoff 1 s / 4 s / 16 s. Esgotadas, o sistema para de tentar até o usuário rodar `HAML: Restart lint server`. Sem timer de "servidor estável por N minutos", sem reset automático.

Motivo: o reset por tempo exige estado extra (timestamp do último start bem-sucedido, um timer ou uma checagem a cada close) para resolver um cenário raro: um servidor que morre em intervalos maiores que a janela de reset. O caminho de escape já existe e é explícito: o comando. Se a telemetria informal (issues) mostrar gente rodando o comando repetidamente, aí vale o timer.

### D3: `ExtensionActivator.dispose` permanece (US-019)

Verificado: `src/extension.ts:29-33` implementa `deactivate()` chamando `activator.dispose()`, que executa `this.lintServer?.stop()` (`src/ExtensionActivator.ts:189-191`). O método está em uso e é o único ponto que mata o processo Ruby na desativação: **o relatório errou ao listá-lo como código morto** (seção M9).

Consequência prática: não há vazamento de servidor na desativação normal, e US-019 não mexe nele. O vazamento que US-014 resolve é outro: o extension host morrer sem chamar `deactivate()` (crash, `kill -9`), que é exatamente o caso do watchdog de stdin.

### D4: Notificação de timeout de formatação: uma por sessão, rearmada no sucesso (US-009)

`FormattingEditProvider` mantém um booleano `timeoutWarned`. A primeira falha/timeout notifica e marca o flag; as seguintes só vão para o output channel. A primeira formatação bem-sucedida limpa o flag.

Motivo: duas linhas de estado resolvem os dois extremos de uma vez. Sem o flag, `editor.formatOnSave` em um projeto com RuboCop pesado gera uma notificação por save, ruído que treina o usuário a ignorar avisos. Com flag permanente (sem rearmar), um problema transitório consome a única notificação da sessão e um problema real posterior passa calado. Rearmar no sucesso é o comportamento correto nas duas pontas pelo mesmo tamanho de código.
