# frozen_string_literal: true

module LintServer
  module Report
    def self.options_from_request(request)
      template = request["template"]
      file_path = request["file_path"]
      config_file = request["config_file"] if request["config_file"] && File.exist?(request["config_file"])

      {
        template: template,
        file_path: file_path,
        config_file: config_file,
        reporter: json_reporter
      }
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

      report.lints.map do |lint|
        {
          location: { line: lint.line },
          severity: lint.severity,
          message: lint.message,
          linter_name: lint.linter.name
        }
      end
    end

    # @return String the autocorrected source code
    def self.autocorrect(request = {})
      options = options_from_request(request)

      runner = LintServer::Runner.new
      runner.run_autocorrect(
        options[:template],
        options[:file_path],
        config_file: options[:config_file],
        reporter: options[:reporter]
      )
    end

    def self.json_reporter
      HamlLint::Reporter::JsonReporter.new(HamlLint::Logger.new($stderr))
    end
  end
end
