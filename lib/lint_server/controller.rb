module LintServer
  module Controller
    def self.call(server)
      client = server.accept
      request = {}

      begin
        request = JSON.parse(client.gets)
      rescue JSON::ParserError
        client.puts({ status: 'error', result: 'Invalid JSON' }.to_json)
        client.close
        return
      end

      response = build_response(request).to_json
      client.puts response
      client.close
    end

    def self.build_response(request)
      result = nil

      begin
        result = run_action(request)
        status = 'success'
      rescue => e
        result = "#{e.message}\n#{e.backtrace.join("\n")}"
        status = 'error'
      end

      { status: status, result: result }
    end

    def self.run_action(request)
      case request['action']
      when 'lint'
        LintServer::Report.lint(request)
      when 'list_cops'
        LintServer::Cops.list_cops
      else
        raise "Unknown action: #{request['action']}"
      end
    end
  end
end
