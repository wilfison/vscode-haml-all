require 'socket'
require 'json'

use_bundle = ARGV.include?('--use-bundler')

if use_bundle
  begin
    require 'bundler/setup'
    Bundler.require(:default)
  rescue LoadError
    puts "Bundler not found. Please install it with `gem install bundler`."
    exit 1
  rescue Bundler::GemfileNotFound
    puts "Gemfile not found. Please create a Gemfile with the required gems."
    use_bundle = false
  end
end

begin
  require 'haml_lint'
rescue LoadError
  if use_bundle
    puts "HAML Lint not found. Please add it to your Gemfile and run `bundle install`."
  else
    puts "HAML Lint not found. Please install it with `gem install haml-lint`."
  end
end

PORT = 7654
server = TCPServer.new('127.0.0.1', PORT)

puts "HAML Lint server running on port #{PORT}..."

loop do
  client = server.accept
  request = {}

  begin
    request = JSON.parse(client.gets)
  rescue JSON::ParserError
    client.puts({ status: 'error', result: 'Invalid JSON' }.to_json)
    client.close
    next
  end

  file_path = request['file_path']
  options = request['options'] || {}
  config_file = options['config_file'] if options['config_file'] && File.exist?(options['config_file'])

  result = nil
  log = HamlLint::Logger.new($stderr)

  begin
    runner = HamlLint::Runner.new
    report = runner.run(
      files: [file_path],
      config_file: config_file,
      reporter: HamlLint::Reporter::JsonReporter.new(log),
    )

    result = report.lints.map do |lint|
      {
        location: { line: lint.line },
        severity: lint.severity,
        message: lint.message,
        linter_name: lint.linter.name
      }
    end
    status = 'success'
  rescue => e
    result = "#{e.message}\n#{e.backtrace.join("\n")}"
    status = 'error'
  end

  response = { status: status, result: result }.to_json
  client.puts response
  client.close
end
