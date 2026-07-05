# frozen_string_literal: true

require "haml"

module LintServer
  # Renders a HAML template to HTML using haml's public Template API.
  #
  # Note: rendering HAML executes any Ruby embedded in the template. That is
  # inherent to HAML and acceptable here because the template is the user's own
  # file opened in their editor.
  module Compile
    def self.call(request = {})
      template = request["template"].to_s

      Haml::Template.new { template }.render
    end
  end
end
