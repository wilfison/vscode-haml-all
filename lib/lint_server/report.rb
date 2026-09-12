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

    # Only honor a config_file that exists AND lives inside the server's working
    # directory (the workspace root the extension launched us in). A request
    # cannot change our cwd, so this stops a client from pointing us at an
    # arbitrary config elsewhere on disk: haml-lint/RuboCop configs can `require:`
    # Ruby, which would otherwise be arbitrary code execution. A path outside the
    # workspace is ignored, falling back to haml-lint's default config discovery.
    def self.safe_config_file(path)
      return nil unless path && File.exist?(path)

      root = Pathname.new(File.realpath(Dir.pwd))
      resolved = Pathname.new(File.realpath(path))
      return resolved.to_s if resolved.ascend.any?(root)

      nil
    rescue StandardError
      nil
    end

    # @param [Hash] options
    # @option options [String] :template The HAML template to lint.
    # @option options [String] :file_path The path to the file being linted.
    # @option options [String] :config_file The path to the HAML lint config file.
    # @return [Array<Hash>] An array of hashes containing linting results.
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

    # A lint carries no linter when haml-lint reports a HAML parse/syntax error
    # (and haml-lint's own reporter guards this with `offense.linter.name if
    # offense.linter`). Call #name unconditionally and a syntax error — exactly
    # when a diagnostic matters most — would raise NoMethodError and be turned
    # into a server error instead. Guard it and fall back to a "Syntax" label.
    #
    # `correctable` exists since haml_lint 0.76.0; older versions get nil so the
    # client simply offers no per-offense autocorrect.
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

    # @return String the autocorrected source code. An optional `linters` array
    #   (haml-lint linter class names, e.g. "SpaceBeforeScript" or "RuboCop")
    #   restricts the run to those linters; empty means all of them. `unsafe:
    #   true` also applies corrections haml-lint/RuboCop mark as unsafe
    #   (`--autocorrect-all`); the default is safe only.
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
