module LintServer
  module Report
    class HamlLintRunner < HamlLint::Runner
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

      private

      def extract_sources(template, file_path)
        [HamlLint::Source.new(io: StringIO.new(template), path: file_path)]
      end
    end

    def self.lint(request = {})
      template = request['template']
      file_path = request['file_path']
      config_file = request['config_file'] if request['config_file'] && File.exist?(request['config_file'])

      runner = HamlLintRunner.new
      report = runner.run(
        template,
        file_path,
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
