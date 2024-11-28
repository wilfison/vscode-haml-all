require 'json'

RUBOCOP_COPS = [
  'Style/StringLiterals',
  'Layout/SpaceInsideParens',
  'Layout/SpaceBeforeComma',
].freeze

HAML_LINT_COPS = [
  'ClassesBeforeIds',
  'FinalNewline',
  'LeadingCommentSpace',
  'SpaceBeforeScript',
  'TrailingEmptyLines',
  'TrailingWhitespace'
].freeze

def rubocop_cops
  require 'rubocop'

  config_store = RuboCop::ConfigStore.new
  config = config_store.for('.').to_h

  config.select { |cop, _| RUBOCOP_COPS.include?(cop) }
rescue StandardError
  {}
end

def haml_lint_cops
  require 'haml_lint'

  config = HamlLint::ConfigurationLoader.load_applicable_config
  config = config.hash['linters']

  config.select { |cop, _| HAML_LINT_COPS.include?(cop) }
rescue StandardError
  {}
end

def list_cops
  {
    rubocop: rubocop_cops,
    haml_lint: haml_lint_cops,
  }
end

puts list_cops.to_json
