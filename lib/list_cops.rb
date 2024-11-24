require 'rubocop'
require 'haml_lint'
require 'json'

def rubocop_cops
  config_store = RuboCop::ConfigStore.new
  config = config_store.for('.').to_h

  cop_list = [
    'Style/StringLiterals',
  ]

  config.select { |cop, _| cop_list.include?(cop) }
end

def haml_lint_cops
  config = HamlLint::ConfigurationLoader.load_applicable_config
  config.hash
end

def list_cops
  {
    rubocop: rubocop_cops,
    haml_lint: haml_lint_cops['linters'],
  }
end

puts list_cops.to_json
