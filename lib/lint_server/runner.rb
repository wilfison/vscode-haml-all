# frozen_string_literal: true

module LintServer
  # Adapter over HamlLint::Runner that lints an in-memory template (instead of a
  # file on disk) and captures autocorrect output without writing it back.
  #
  # WARNING: this relies on haml_lint internals (#load_applicable_config,
  # #extract_sources, #report and the #autocorrect_document contract, plus the
  # private HamlLint::Document#unstrip_frontmatter). It is verified against the
  # haml_lint version pinned in Gemfile.lock; revisit when bumping that gem.
  class Runner < HamlLint::Runner
    attr_accessor :document

    def run(template, file_path, options = {})
      @config = load_applicable_config(options)
      @sources = extract_sources(template, file_path)
      @linter_selector = HamlLint::LinterSelector.new(config, options)
      @fail_fast = options.fetch(:fail_fast, false)
      @cache = {}
      @autocorrect = options[:autocorrect]
      @autocorrect_only = options[:autocorrect_only]
      @autocorrect_stdout = options[:stdin] && options[:stderr]

      report(options)
    end

    def run_autocorrect(template, file_path, options = {})
      run(template, file_path, options.merge(autocorrect: :safe, autocorrect_only: true))

      # calls private #unstrip_frontmatter from document
      document.send(:unstrip_frontmatter, document.source)
    end

    private

    def extract_sources(template, file_path)
      [HamlLint::Source.new(io: StringIO.new(template), path: file_path)]
    end

    # override to prevent file writing when autocorrecting
    def autocorrect_document(document, linters)
      lint_arrays = []

      autocorrecting_linters = linters.select(&:supports_autocorrect?)
      lint_arrays << autocorrecting_linters.map do |linter|
        linter.run(document, autocorrect: @autocorrect)
      end

      # Instead, we will just set the document to the autocorrected version
      self.document = document

      lint_arrays
    end
  end
end
