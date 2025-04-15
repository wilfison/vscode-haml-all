# frozen_string_literal: true

module LintServer
  module Cops
    RUBOCOP_COPS = [
      "Layout/SpaceInsideParens",
      "Layout/SpaceBeforeComma",
      "Layout/SpaceAfterColon",
      "Style/MethodCallWithArgsParentheses",
      "Style/StringLiterals"
    ].freeze

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
        rubocop: rubocop_cops,
        haml_lint: haml_lint_cops
      }
    end

    def self.rubocop_cops
      require "rubocop"

      config_store = RuboCop::ConfigStore.new
      config = config_store.for(".").to_h

      config.select { |cop, _| RUBOCOP_COPS.include?(cop) }
    rescue StandardError => e
      { "error" => e.message }
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
