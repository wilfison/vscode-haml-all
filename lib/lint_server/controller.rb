# frozen_string_literal: true

module LintServer
  module Controller
    def self.call(server)
      client = server.accept
      request = {}

      begin
        request = JSON.parse(client.gets)
      rescue JSON::ParserError
        send_response(client, { status: "error", result: "Invalid JSON" })
        return
      end

      response = build_response(request).to_json
      send_response(client, response)
    end

    def self.send_response(client, response)
      client.puts response.to_json
      client.close
    end

    def self.build_response(request)
      result = nil

      begin
        result = run_action(request)
        status = "success"
      rescue StandardError => e
        result = "#{e.message}\n#{e.backtrace.join("\n")}"
        status = "error"
      end

      { status: status, result: result }
    end

    def self.run_action(request)
      case request["action"]
      when "lint"
        LintServer::Report.lint(request)
      when "autocorrect"
        LintServer::Report.autocorrect(request)
      when "list_cops"
        LintServer::Cops.list_cops
      when "compile"
        LintServer::Compile.call(request)
      else
        raise "Unknown action: #{request['action']}"
      end
    end
  end
end
