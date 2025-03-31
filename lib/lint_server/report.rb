module LintServer
  module Report
    def self.lint(request = {})
      file_path = request['file_path']
      config_file = request['config_file'] if request['config_file'] && File.exist?(request['config_file'])

      runner = HamlLint::Runner.new
      report = runner.run(
        files: [file_path],
        config_file: config_file,
        reporter: HamlLint::Reporter::JsonReporter.new(HamlLint::Logger.new($stderr)),
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
  end
end
