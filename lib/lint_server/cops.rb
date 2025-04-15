# frozen_string_literal: true

module LintServer
  module Cops
    HAML_LINT_COPS = %w[
      RuboCop
      ClassesBeforeIds
      FinalNewline
      HtmlAttributes
      LeadingCommentSpace
      SpaceBeforeScript
      StrictLocals
      TrailingEmptyLines
      TrailingWhitespace
      UnnecessaryStringOutput
    ].freeze

    def self.list_cops
      {
        haml_lint: haml_lint_cops
      }
    end

    def self.haml_lint_cops
      config = HamlLint::ConfigurationLoader.load_applicable_config
      config = config.hash["linters"]

      config.select { |cop, _| HAML_LINT_COPS.include?(cop) }
    rescue StandardError => e
      { "error" => e.message }
    end
  end
end
