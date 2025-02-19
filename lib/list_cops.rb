require 'json'

RUBOCOP_COPS = [
  'Layout/SpaceInsideParens',
  'Layout/SpaceBeforeComma',
  'Layout/SpaceAfterColon',
  'Style/MethodCallWithArgsParentheses',
  'Style/StringLiterals',
].freeze

HAML_LINT_COPS = [
  'RuboCop',
  'ClassesBeforeIds',
  'FinalNewline',
  'HtmlAttributes',
  'LeadingCommentSpace',
  'SpaceBeforeScript',
  'TrailingEmptyLines',
  'TrailingWhitespace',
  'UnnecessaryStringOutput'
].freeze

def rubocop_cops
  require 'rubocop'

  config_store = RuboCop::ConfigStore.new
  config = config_store.for('.').to_h

  config.select { |cop, _| RUBOCOP_COPS.include?(cop) }
rescue StandardError => e
  { 'error' => e.message }
end

def haml_lint_cops
  require 'haml_lint'

  config = HamlLint::ConfigurationLoader.load_applicable_config
  config = config.hash['linters']

  config.select { |cop, _| HAML_LINT_COPS.include?(cop) }
rescue StandardError => e
  { 'error' => e.message }
end

def list_cops
  {
    rubocop: rubocop_cops,
    haml_lint: haml_lint_cops,
  }
end

# get working directory from the first parameter
working_dir = ARGV[0] || Dir.pwd
bundle_script = File.join(working_dir, 'bin/bundle')

if File.exist?(bundle_script)
  load bundle_script
end

puts list_cops.to_json
