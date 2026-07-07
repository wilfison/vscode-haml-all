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

    # haml-lint gained safe autocorrect for its own linters in 0.74.0.
    NATIVE_AUTOCORRECT_VERSION = Gem::Version.new("0.74.0")

    def self.list_cops
      {
        haml_lint: haml_lint_cops,
        version: HamlLint::VERSION,
        supports_native_autocorrect: supports_native_autocorrect?
      }
    end

    def self.supports_native_autocorrect?
      Gem::Version.new(HamlLint::VERSION) >= NATIVE_AUTOCORRECT_VERSION
    end

    def self.haml_lint_cops
      config = HamlLint::ConfigurationLoader.load_applicable_config
      config = config.hash["linters"]

      config.slice(*HAML_LINT_COPS)
    rescue StandardError => e
      { "error" => e.message }
    end
  end
end
