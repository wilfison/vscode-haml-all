# PRD: Fix all + correção por ofensa via autocorrect do haml-lint (Feature 2)

Origem: `tmp/relatorio-analise.md`, seção 6, item 2 ("Quick fixes funcionando + Fix all haml-lint autocorrectable in file") e seção 7 (residual P1). Data: 2026-09-12, branch `main` @ `30f8ada`. Complementa o pedido adicional: oferecer a correção da **ofensa específica** quando o haml-lint informar que ela é autocorrigível.

## 1. Introdução / Visão geral

O servidor Ruby já expõe a ação `autocorrect` (`lib/lint_server/report.rb`, `LintServer::Runner#run_autocorrect`), e `FormattingEditProvider` já a usa para "Format Document" com timeout de 10 s, cancelamento do lint pendente e aviso único por sessão (B8). O que falta é expor a mesma capacidade em dois pontos onde o usuário espera encontrá-la:

1. **`Source Action` / `editor.codeActionsOnSave`.** Hoje só existe `editor.formatOnSave`. Quem usa outro formatter para HAML, ou quer "fix all" sem formatação, não tem como ligar `"source.fixAll.hamlLint": "explicit"` — o padrão que ESLint, RuboCop LSP e Ruby LSP seguem.
2. **Lâmpada na ofensa.** Os quick fixes voltaram a aparecer (B1), mas só para três cops reimplementados em TypeScript (`SpaceBeforeScript`, `Style/StringLiterals`, `Layout/SpaceInsideHashLiteralBraces`). O haml-lint ≥ 0.74 corrige nativamente 21 linters (`supports_autocorrect(true)` em `lib/haml_lint/linter/*.rb`) mais os cops safe do RuboCop, e desde a **0.76.0** informa por ofensa se ela é corrigível. Nenhuma dessas correções chega à lâmpada.

### Resultado da verificação pedida (`correctable` no JSON)

Verificado no gem instalado (`haml_lint-0.78.0`) e nas versões 0.72–0.78:

| Versão haml_lint | `HamlLint::Lint#correctable` | `HashReporter#map_offense` inclui `correctable` |
|---|---|---|
| ≤ 0.75.0 | não existe | não |
| ≥ 0.76.0 | sim (`attr_reader :correctable`, além de `corrected`) | sim |

Como o valor é calculado:

- **Linters do haml-lint:** `Linter#record_lint(..., correctable: supports_autocorrect?)` — flag por linter (`lib/haml_lint/linter.rb:218`). `HtmlAttributes` refina por nó (`correctable?(node)`).
- **RuboCop:** `Linter::RuboCop#record_lint(..., correctable: offense.correctable?)` — por ofensa (`lib/haml_lint/linter/rubocop.rb:285`). No RuboCop, `Offense#correctable?` é `status != :unsupported && status != :disabled`, ou seja, **"o cop suporta autocorrect"**, incluindo cops cujo autocorrect é *unsafe*. Como o servidor roda `autocorrect: :safe`, uma ofensa marcada `correctable: true` pode **não** ser corrigida (ver D4).

Confirmado em runtime (`bundle exec haml-lint --reporter json` na 0.78.0, arquivo com `=foo`, `%meta{:foo => "bar"}` e `%p.a#b x   `): todas as ofensas vieram com `correctable: true`, inclusive as do RuboCop (`Style/HashSyntax`, `Style/StringLiterals`) num lint **sem** `--autocorrect`. E `LintServer::Runner#run_autocorrect(..., included_linters: ["SpaceBeforeScript"])` devolveu `= foo` com o hash Ruby 1.8 e o espaço final intactos; um nome desconhecido lança `HamlLint::NoSuchLinter`.

O que o servidor da extensão faz hoje: `Report.lint_hash` monta o hash à mão (`location`, `severity`, `message`, `linter_name`) e **não repassa `correctable`**. O `JsonReporter` é instanciado mas só serve para o `HamlLint::Report`; o JSON que chega ao TypeScript é o de `lint_hash`. Logo, é preciso mudar o servidor (1 linha com guarda de versão) e o tipo `LinterOffense`.

Limitação estrutural confirmada: **o haml-lint não corrige uma única linha**. A menor granularidade da API é *por linter* — `HamlLint::LinterSelector` aceita `options[:included_linters]` (`lib/haml_lint/linter_selector.rb:33`) e o `LintServer::Runner#run` já passa `options` para ele. Para o linter `RuboCop`, a granularidade mínima é "todos os cops safe do RuboCop": `rubocop_options` só constrói `--except` a partir de `ignored_cops` (`lib/haml_lint/linter/rubocop.rb:319-360`); não há `--only`. Ver D3 e §9.

## 2. Objetivos

- `"source.fixAll.hamlLint": "explicit"` (ou `"source.fixAll"`) em `editor.codeActionsOnSave` aplica o autocorrect safe do haml-lint ao salvar, e o menu `Source Action...` oferece "Fix all auto-correctable haml-lint offenses".
- Toda ofensa que o haml-lint marcar como `correctable` e que não tenha um quick fix TypeScript próprio recebe uma ação na lâmpada que roda o autocorrect **restrito ao linter daquela ofensa**.
- Nada muda para quem só usa `editor.formatOnSave`: o resultado do fix-all é idêntico ao do format (mesmo caminho de código).
- Com haml_lint < 0.76 (sem `correctable`), a extensão continua funcionando exatamente como hoje — sem ação nova na lâmpada e sem erro.
- Cada peça de lógica nova deixa um teste que falha se ela regredir (Mocha e Minitest).

## 3. User Stories

### US-001: Servidor repassa `correctable` e aceita `linters` no autocorrect

**Descrição:** Como extensão, preciso saber por ofensa se o haml-lint consegue corrigi-la, e preciso pedir um autocorrect limitado a um linter, para oferecer a correção certa na lâmpada.

**Contexto:** `Report.lint_hash` (`lib/lint_server/report.rb:63-70`) monta o hash manualmente. `Report.autocorrect` (linha 75) chama `Runner#run_autocorrect(template, file_path, config_file:, reporter:)`; `Runner#run` repassa `options` para `HamlLint::LinterSelector.new(config, options)`, que honra `:included_linters`. `Cops.list_cops` já reporta `version` e `supports_native_autocorrect`.

**Critérios de aceite:**

- [ ] `lint_hash` inclui `correctable: lint.correctable` quando `lint.respond_to?(:correctable)`; caso contrário a chave fica `nil` (haml_lint < 0.76). Nunca `NoMethodError`.
- [ ] A requisição `autocorrect` aceita a chave opcional `linters` (array de strings). `Report.autocorrect` passa `included_linters: Array(request["linters"]).grep(String)` para `run_autocorrect`; quando vazio, comportamento atual (todos os linters).
- [ ] Um nome de linter desconhecido faz o haml-lint lançar (`NoSuchLinter`); isso vira resposta `{ status: "error" }` pelo `Dispatcher` sem derrubar o servidor — comportamento já existente, apenas confirmado por teste.
- [ ] `test/lib/lint_server/report_test.rb`: o `Struct` `Lint` ganha `correctable`; teste de que `lint_hash` propaga `true`/`false`; teste de que um lint sem o método (Struct antigo) produz `correctable: nil`.
- [ ] `test/lib/lint_server/runner_test.rb`: `run_autocorrect` com `included_linters: ["SpaceBeforeScript"]` sobre `"=foo\n%meta{:foo => 'bar'}"` corrige `=foo` → `= foo` e **deixa** `%meta{:foo => 'bar'}` intacto (RuboCop não rodou).
- [ ] `test/lib/lint_server/dispatcher_test.rb` (ou `report_test.rb`): `autocorrect` com `linters: ["NaoExiste"]` retorna `status: "error"`.
- [ ] `bundle exec rake` e `bundle exec rubocop` (0 ofensas) passam.

### US-002: `correctable` chega ao `DiagnosticFull`

**Descrição:** Como `FixActionsProvider`, preciso ler `diagnostic.correctable` para decidir se ofereço a ação de autocorrect.

**Contexto:** `LinterOffense` em `src/types.d.ts:8-15`; `DiagnosticFull` e `parseLintOffence` em `src/linter/parser.ts`. A deduplicação por `line:message` em `Linter.parse` (`src/linter/index.ts`) não muda.

**Critérios de aceite:**

- [ ] `LinterOffense` ganha `correctable?: boolean | null`.
- [ ] `DiagnosticFull` ganha `correctable: boolean` (`offense.correctable === true`; `null`/`undefined`/`false` → `false`).
- [ ] `src/test/linter/parser.test.ts`: ofensa com `correctable: true` → `diagnostic.correctable === true`; com `false`, `null` e sem a chave → `false`.
- [ ] `src/server/index.ts#autocorrect` ganha o parâmetro opcional `linters?: string[]`, enviado como `linters` só quando não vazio; `src/test/server/index.test.ts` confirma que a chave chega no request (via `fakeServer.ts`) e que é omitida quando não informada.
- [ ] `npm run compile` e `npm test` passam.

### US-003: `source.fixAll.hamlLint`

**Descrição:** Como usuário, quero ligar `"source.fixAll.hamlLint": "explicit"` em `editor.codeActionsOnSave` (ou usar `Source Action... > Fix all`) para aplicar o autocorrect do haml-lint sem depender de `editor.formatOnSave`.

**Contexto:** `FormattingEditProvider` (`src/providers/FormattingEditProvider.ts`) já implementa o caminho completo: gate `lintEnabled`, `cancelPendingLint()`, `lintServer.autocorrect` com `TIMEOUTS.autocorrectMs`, fallback do formatter legado, aviso único por sessão e `TextEdit.replace(fullRange, ...)`. É registrado em `ExtensionActivator.activateTrusted`.

**Critérios de aceite:**

- [ ] O provider de fix-all é registrado em `activateTrusted` com `providedCodeActionKinds: [CodeActionKind.SourceFixAll.append('hamlLint')]` e o mesmo `HAML_SELECTOR`, dentro de `context.subscriptions` (D1: `FormattingEditProvider` passa a implementar também `CodeActionProvider`, reutilizando a lógica extraída para um método `computeEdits(document, token)`).
- [ ] `provideCodeActions` retorna `[]` quando `context.only` é `undefined` ou não intersecta `source.fixAll` — a ação **não** aparece na lâmpada, só em `Source Action...` e no on-save.
- [ ] Quando solicitada, retorna **uma** `CodeAction` com título `Fix all auto-correctable haml-lint offenses`, `kind = source.fixAll.hamlLint`, **sem** `edit` (resolução preguiçosa).
- [ ] `resolveCodeAction` calcula o edit pelo mesmo caminho do format: mesmo timeout, mesmo `cancelPendingLint`, mesmo fallback legado, mesmo aviso único. Texto igual → `edit` vazio. Falha/timeout → `edit` ausente e aviso (uma vez por sessão, rearmado no sucesso, como hoje).
- [ ] `resolveCodeAction` respeita `token.isCancellationRequested` após a resposta do servidor: se cancelado (VS Code cancela ao estourar `editor.codeActionsOnSaveTimeout`), não seta `edit` nem emite aviso — o cancelamento não é falha.
- [ ] `src/test/providers/FormattingEditProvider.test.ts`: (a) `only = undefined` → `[]`; (b) `only = CodeActionKind.SourceFixAll` → 1 ação, sem `edit`; (c) `only = source.fixAll.hamlLint` → 1 ação; (d) resolve com servidor devolvendo texto diferente → `edit` com replace do documento inteiro; (e) servidor devolvendo `null` → sem `edit`, 1 aviso; (f) token já cancelado → sem `edit`, 0 avisos; (g) `lintEnabled: false` → `provideCodeActions` retorna `[]` e o servidor não é chamado.
- [ ] `README.md`: nova subseção em "Formatting" mostrando `"editor.codeActionsOnSave": { "source.fixAll.hamlLint": "explicit" }`, avisando que (1) com `editor.formatOnSave` também ligado o autocorrect roda duas vezes por save (a segunda não muda nada, mas custa uma ida ao servidor) e (2) arquivos grandes com RuboCop podem exigir aumentar `editor.codeActionsOnSaveTimeout` (default 750 ms).
- [ ] `CHANGELOG.md` `## [Unreleased]` → `### Added`.
- [ ] `npm run compile` e `npm test` passam.

### US-004: Ação na lâmpada para ofensa `correctable`

**Descrição:** Como usuário com uma ofensa que o haml-lint sabe corrigir (`TrailingWhitespace`, `ClassesBeforeIds`, `UnnecessaryStringOutput`, um cop safe do RuboCop...), quero clicar na lâmpada e corrigi-la, em vez de formatar o arquivo inteiro.

**Contexto:** `FixActionsProvider` (`src/providers/FixActionsProvider.ts`) é construído sem dependências em `EventSubscriber.subscribeToEvents` (`src/EventSubscriber.ts:115`), que tem acesso a `this.linter`, ao `lintServer` (parâmetro do construtor) e a `cancelPendingLint()`. `createLintAction` já decide entre `hamlLintFixes`/`rubocopFix` (locais, por linha) e o "Disable ...".

**Critérios de aceite:**

- [ ] `FixActionsProvider` recebe no construtor uma função `autocorrect(document, linters: string[]) => Promise<string | null>` (fornecida por `EventSubscriber`, que a monta com `linter.configFilePath`, `cancelPendingLint` e `lintServer.autocorrect`). O construtor sem argumento continua válido para os testes existentes (default: `async () => null`).
- [ ] Em `createLintAction`, quando `diagnostic.correctable === true` **e** não há fix local para a regra (D2), é adicionada uma `CodeAction` `QuickFix` sem `edit`, com `diagnostics = [diagnostic]` e título:
  - `source === 'haml-lint'` → ``Fix all `<Cop>` offenses in this file (haml-lint autocorrect)`` com `linters = [<Cop>]`;
  - `source === 'RuboCop'` → `Fix all RuboCop offenses in this file (haml-lint autocorrect)` com `linters = ['RuboCop']` (D3).
- [ ] A ação é inserida **antes** do "Disable ..." correspondente.
- [ ] `resolveCodeAction` chama `autocorrect(document, linters)`; texto diferente → `edit` = replace do documento inteiro; texto igual → sem `edit` e `window.showInformationMessage('haml-lint could not safely autocorrect <Cop>. See the "Haml" output for details.')` (D4); `null` → sem `edit` (o aviso de falha já é responsabilidade do caminho de autocorrect, que loga no output channel).
- [ ] `diagnostic.correctable` `false`/ausente → nenhuma ação nova (comportamento idêntico ao atual, o que cobre haml_lint < 0.76).
- [ ] `src/test/providers/FixActionsProvider.test.ts`: (a) `TrailingWhitespace` com `correctable: true` → títulos `['Fix all \`TrailingWhitespace\` offenses in this file (haml-lint autocorrect)', 'Disable \`TrailingWhitespace\` for this entire file']`; (b) mesma ofensa com `correctable: false` → só o disable; (c) `SpaceBeforeScript` com `correctable: true` → `['Fix SpaceBeforeScript', 'Disable ...']` (fix local vence, sem duplicata); (d) RuboCop `Layout/TrailingWhitespace` correctable → título "Fix all RuboCop offenses..." e `resolveCodeAction` chama o fake com `['RuboCop']`; (e) resolve com fake devolvendo texto novo → `edit` full-range; (f) fake devolvendo o mesmo texto → sem `edit`.
- [ ] O helper `diagnostic(...)` do teste ganha um parâmetro `correctable` (default `false`).
- [ ] `CHANGELOG.md` `## [Unreleased]` → `### Added`, e `README.md` (seção de formatação) informam que a ação por ofensa usa o suporte a autocorreção do haml-lint, disponível a partir da 0.76.0, e que em versões anteriores a lâmpada continua como hoje. Sem fixar versão mínima (D5).
- [ ] `npm run compile` e `npm test` passam.

## 4. Requisitos funcionais

Servidor Ruby:

- FR-1: A resposta de `lint` deve incluir `correctable` por ofensa (`true`/`false`), ou `null` quando o haml_lint instalado não expõe o atributo.
- FR-2: A requisição `autocorrect` deve aceitar `linters: string[]` opcional e restringir a correção a esses linters via `included_linters`; ausente ou vazio → todos.
- FR-3: O `autocorrect` deve continuar em modo `:safe`, sem escrita em disco, independentemente de `linters`.

Cliente TypeScript:

- FR-4: `LintServer.autocorrect` deve aceitar `linters?: string[]` e só enviar a chave quando houver itens.
- FR-5: `DiagnosticFull.correctable` deve ser `true` somente quando o servidor reportar `correctable: true`.
- FR-6: Deve existir um `CodeActionProvider` de kind `source.fixAll.hamlLint`, registrado apenas em workspace confiável (dentro de `activateTrusted`), que não devolve nada quando `context.only` não pede `source.fixAll`.
- FR-7: O edit do fix-all deve ser calculado em `resolveCodeAction`, pelo mesmo caminho de `provideDocumentFormattingEdits` (timeout, cancelamento do lint pendente, formatter legado, aviso único por sessão).
- FR-8: Um `CancellationToken` cancelado deve resultar em nenhuma edição e nenhuma notificação.
- FR-9: Para uma diagnóstica com `correctable === true` sem fix local, `FixActionsProvider` deve oferecer um `QuickFix` que roda o autocorrect restrito ao linter da ofensa (`[<Cop>]` para haml-lint, `['RuboCop']` para RuboCop).
- FR-10: Quando o autocorrect restrito não alterar o texto, o usuário deve ser informado de que o haml-lint não conseguiu corrigir com segurança aquela ofensa.
- FR-11: Com `hamlAll.lintEnabled: false`, nem o fix-all nem a ação por ofensa devem chamar o servidor.
- FR-12: Mudanças visíveis ao usuário vão para `CHANGELOG.md` sob `## [Unreleased]`; sem bump de versão (`AGENTS.md`).

## 5. Não-objetivos (fora de escopo)

- **Correção de uma única linha.** O haml-lint não expõe isso; recortar o diff da saída por linha é frágil (`FinalNewline`, `TrailingEmptyLines`, `MultilineScript` mudam a contagem de linhas). A granularidade entregue é *por linter*.
- **Correção de um único cop do RuboCop.** Exigiria `--only`, que o `HamlLint::Linter::RuboCop` não repassa; a alternativa (injetar todos os outros cops em `ignored_cops`) é hack sobre config. Ver §9.
- **Autocorrect unsafe** (`:all`). Continua `:safe`; ofensas só corrigíveis em modo unsafe recebem a mensagem de FR-10.
- **Novo comando** `HAML: Fix all...` na paleta. O menu nativo `Source Action...` já lista ações `source.fixAll`.
- **Nova setting** para ligar/desligar o fix-all. O controle é `editor.codeActionsOnSave`, como em todas as extensões que seguem esse padrão.
- **Marcar visualmente** a ofensa como corrigível (sufixo `[Correctable]` na mensagem, tag). A lâmpada já é o sinal.
- Range formatting (feature 3 do relatório), hover em cops (feature 4), aposentadoria do formatter legado (M3).
- Bump de versão em `package.json`/`package-lock.json`.

## 6. Considerações de design

- Títulos das ações dizem o escopo real ("all ... offenses in this file"), para que o usuário não espere correção de uma linha só e encontre o arquivo inteiro alterado.
- A ação por ofensa fica **antes** do "Disable ..." e **não duplica** um fix local existente; o fix local é instantâneo e por linha, logo é sempre a melhor opção quando existe.
- A ação de fix-all não aparece na lâmpada (padrão do VS Code para `source.*`): quem quer usá-la manualmente usa `Source Action...`.
- Mensagens seguem a convenção já usada: dizem o que fazer e apontam para o output "Haml" quando houver detalhe.

## 7. Considerações técnicas

- **Reuso, não duplicação.** O único caminho de autocorrect de documento é o de `FormattingEditProvider`; o fix-all o reutiliza via extração de um método interno (D1). `FixActionsProvider` recebe uma função, não o `LintServer` — mantém o provider testável sem servidor e sem `vscode.workspace.getConfiguration`.
- **`resolveCodeAction`** existe desde o VS Code 1.48; `engines.vscode` é `^1.103.0`. O on-save chama `provideCodeActions` com `only = source.fixAll` e depois `resolveCodeAction`, cancelando pelo token ao estourar `editor.codeActionsOnSaveTimeout`. A extensão não cancela a requisição no servidor (o transporte não suporta); ela só descarta a resposta.
- **Servidor single-threaded:** o `cancelPendingLint()` antes de qualquer autocorrect continua obrigatório (B8). O aviso único por sessão (`timeoutWarned`) é compartilhado entre format e fix-all, já que vivem na mesma instância.
- **`included_linters` usa nomes de classe** (`SpaceBeforeScript`, `RuboCop`), exatamente o que `lint.linter.name` devolve e o que a extensão já guarda em `code.value` para ofensas haml-lint. Para RuboCop, `code.value` é o cop (`Style/StringLiterals`) — por isso o `linters` enviado é derivado do `source`, não de `code.value`.
- **Versões:** `correctable` ≥ 0.76.0; `included_linters` existe há muito (LinterSelector) e `supports_autocorrect` ≥ 0.74.0 (já detectado por `supports_native_autocorrect`). Não é necessário novo flag em `list_cops`: a ausência de `correctable` no JSON já desliga a feature por ofensa.
- **Trust:** `EventSubscriber` e `FormattingEditProvider` só existem após `activateTrusted`; nada novo precisa de gate próprio.
- **Testes Ruby:** Minitest via `bundle exec rake`; `bundle exec rubocop` em 0 ofensas, sem `# rubocop:disable` para `Metrics/*` (extrair helper).
- **Testes TS:** Mocha sob `src/test/`, espelhando `src/`. Reutilizar `fakeLintServer`/`countWarnings` de `FormattingEditProvider.test.ts` e `fakeServer.ts`.
- **Ordem sugerida:** US-001 → US-002 → US-003 e US-004 (as duas últimas independentes entre si). US-003 pode ser entregue sozinha se o `correctable` atrasar; ela não depende dele.

## 8. Métricas de sucesso

- Com `"source.fixAll.hamlLint": "explicit"` e `editor.formatOnSave: false`, salvar um `.haml` com `=foo` e `%p{:a => 1}` produz `= foo` e `%p{a: 1}`.
- `Source Action...` num `.haml` lista "Fix all auto-correctable haml-lint offenses"; a lâmpada numa linha sem ofensa **não** a lista.
- Numa linha com `TrailingWhitespace` (haml_lint ≥ 0.76), a lâmpada oferece a correção; após aplicá-la, o próximo lint não reporta mais o cop em nenhuma linha do arquivo.
- Com haml_lint 0.75 instalado, `npm test` e o uso manual não mudam em nada (nenhuma ação nova, nenhum erro no output).
- `npm run compile`, `npm test`, `bundle exec rake` e `bundle exec rubocop` verdes ao fim de cada story.

## 9. Decisões registradas e questões em aberto

### D1 — Fix-all vive em `FormattingEditProvider`

`FormattingEditProvider` passa a implementar `DocumentFormattingEditProvider` **e** `CodeActionProvider`, com a lógica de "texto → edit" extraída para um método privado usado pelos dois. Motivo: é o menor diff que evita duplicar timeout, cancelamento, fallback legado e o aviso único — e o estado `timeoutWarned` precisa ser um só. Se o arquivo crescer além do confortável, separar em `FixAllProvider` recebendo a mesma função é uma refatoração de 20 linhas.

### D2 — Fix local tem precedência sobre o autocorrect do servidor

Quando `hamlLintFixes`/`rubocopFix` devolvem uma ação para a regra, a ação de autocorrect por linter **não** é oferecida. Motivo: o fix local é síncrono, por linha e sem ida ao servidor; oferecer as duas é ruído. Quando M3 (aposentar o formatter legado) for feito, os fixes locais podem ser reavaliados um a um.

### D3 — Ofensa RuboCop → "Fix all RuboCop offenses in this file"

O haml-lint não expõe `--only`. A ação corrige todos os cops safe do RuboCop no arquivo e o título diz isso. Alternativa descartada: montar `ignored_cops` com todos os cops menos o alvo — depende da lista de cops carregada, muda com plugins (`rubocop-rails` etc.) e converte uma chamada de 1 linha num módulo. Reabrir se surgir demanda concreta.

### D4 — Quick fix por ofensa roda autocorrect `:all`; texto inalterado = aviso informativo

Revisado pelo mantenedor (2026-09-12): clicar na lâmpada de uma ofensa específica é um pedido explícito, então a ação por ofensa envia `unsafe: true` e o servidor roda `autocorrect: :all` (`--autocorrect-all` no RuboCop; libera os linters `autocorrect_safe(false)` do haml-lint, como `UnnecessaryStringOutput`). Format Document e `source.fixAll.hamlLint` continuam `:safe`. Quando mesmo assim o resultado é igual ao original (cop desabilitado no `.haml-lint.yml`, ou o autocorrect não cobre aquele código), a extensão informa que não foi possível corrigir e registra o motivo no output "Haml".

### D5 — Sem versão mínima fixada; só documentação

Decisão do mantenedor (2026-09-12): a extensão **não** passa a exigir `haml_lint >= 0.76`. `README.md` e `CHANGELOG.md` apenas informam que a correção por ofensa depende do suporte a autocorreção do haml-lint (`correctable`, disponível a partir da 0.76.0) e que, em versões anteriores, a lâmpada segue como hoje. Nenhuma checagem de versão nova em `Cops.list_cops`, nenhum aviso ao usuário: a ausência do campo desliga a feature silenciosamente.

### Questões em aberto

Nenhuma.
