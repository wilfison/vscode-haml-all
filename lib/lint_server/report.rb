# frozen_string_literal: true

module LintServer
  module Report
    def self.options_from_request(request)
      template = request["template"]
      file_path = request["file_path"]
      config_file = safe_config_file(request["config_file"])

      {
        template: template,
        file_path: file_path,
        config_file: config_file,
        reporter: json_reporter
      }
    end

    # Only honor a config inside the workspace root: a config's `require:` runs Ruby,
    # so an arbitrary path elsewhere on disk would be code execution. Outside: nil.
    def self.safe_config_file(path)
      return nil unless path && File.exist?(path)

      root = Pathname.new(File.realpath(Dir.pwd))
      resolved = Pathname.new(File.realpath(path))
      return resolved.to_s if resolved.ascend.any?(root)

      nil
    rescue StandardError
      nil
    end

    def self.lint(request = {})
      options = options_from_request(request)

      runner = LintServer::Runner.new
      report = runner.run(
        options[:template],
        options[:file_path],
        config_file: options[:config_file],
        reporter: options[:reporter]
      )

      report.lints.map { |lint| lint_hash(lint) }
    end

    # A parse error carries no linter, so #name unguarded would raise exactly when the
    # diagnostic matters most. `correctable` is nil before haml_lint 0.76.0.
    def self.lint_hash(lint)
      {
        location: { line: lint.line },
        severity: lint.severity,
        message: lint.message,
        linter_name: lint.linter&.name || "Syntax",
        correctable: correctable_value(lint)
      }
    end

    def self.correctable_value(lint)
      lint.respond_to?(:correctable) ? lint.correctable : nil
    end

    # Returns the autocorrected source. `linters` (haml-lint class names) restricts the
    # run, empty means all; `unsafe: true` is `--autocorrect-all`, default safe only.
    def self.autocorrect(request = {})
      options = options_from_request(request)
      linters = Array(request["linters"]).grep(String)

      runner = LintServer::Runner.new
      runner.run_autocorrect(
        options[:template],
        options[:file_path],
        config_file: options[:config_file],
        reporter: options[:reporter],
        included_linters: linters,
        autocorrect: request["unsafe"] == true ? :all : :safe
      )
    end

    def self.json_reporter
      HamlLint::Reporter::JsonReporter.new(HamlLint::Logger.new($stderr))
    end
  end
end
