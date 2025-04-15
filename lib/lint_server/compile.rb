# frozen_string_literal: true

module LintServer
  # This module is responsible for compiling the HAML template.
  module Compile
    def self.call(request = {})
      template = request["template"]

      eval(Haml::Engine.new({}).call(template)) # rubocop:disable Security/Eval
    end
  end
end
