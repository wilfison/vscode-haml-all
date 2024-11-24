require 'json'

def rubocop_cops
  require 'rubocop'

  config_store = RuboCop::ConfigStore.new
  config = config_store.for('.').to_h

  cop_list = [
    'Style/StringLiterals',
    'Layout/SpaceInsideParens',
  ]

  config.select { |cop, _| cop_list.include?(cop) }
rescue StandardError
  {}
end

def haml_lint_cops
  require 'haml_lint'

  config = HamlLint::ConfigurationLoader.load_applicable_config
  config.hash
rescue StandardError
  {}
end

def list_cops
  {
    rubocop: rubocop_cops,
    haml_lint: haml_lint_cops['linters'],
  }
end

puts list_cops.to_json
