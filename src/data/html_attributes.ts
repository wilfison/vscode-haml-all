// Common HTML data attributes
export const HTML_DATA_ATTRIBUTES = [
  {
    name: 'data-action',
    description: 'Specifies the action to be performed when an event occurs',
  },
  {
    name: 'data-target',
    description: 'Specifies the target element for an action',
  },
  {
    name: 'data-toggle',
    description: 'Specifies what to toggle (commonly used with Bootstrap)',
  },
  {
    name: 'data-dismiss',
    description: 'Specifies what to dismiss (commonly used with modals)',
  },
  {
    name: 'data-placement',
    description: 'Specifies the placement of tooltips or popovers',
  },
  {
    name: 'data-trigger',
    description: 'Specifies what triggers an event',
  },
  {
    name: 'data-delay',
    description: 'Specifies a delay before an action is performed',
  },
  {
    name: 'data-animation',
    description: 'Specifies whether to use animation',
  },
  {
    name: 'data-container',
    description: 'Specifies the container for the element',
  },
  {
    name: 'data-backdrop',
    description: 'Specifies whether to show a backdrop for modals',
  },
  {
    name: 'data-keyboard',
    description: 'Specifies whether to close modal on escape key',
  },
  {
    name: 'data-show',
    description: 'Specifies whether to show the modal on initialization',
  },
  {
    name: 'data-focus',
    description: 'Specifies whether to focus on the modal when opened',
  },
  {
    name: 'data-content',
    description: 'Specifies the content for popovers',
  },
  {
    name: 'data-title',
    description: 'Specifies the title for tooltips or popovers',
  },
  {
    name: 'data-original-title',
    description: 'Stores the original title attribute value',
  },
  {
    name: 'data-html',
    description: 'Specifies whether to allow HTML in tooltips',
  },
  {
    name: 'data-selector',
    description: 'Specifies a CSS selector for delegation',
  },
  {
    name: 'data-template',
    description: 'Specifies a custom template for the element',
  },
  {
    name: 'data-viewport',
    description: 'Specifies the viewport for positioning',
  },
];

// Rails UJS data attributes
export const RAILS_UJS_DATA_ATTRIBUTES = [
  {
    name: 'data-confirm',
    description: 'Shows a confirmation dialog before submitting',
  },
  {
    name: 'data-method',
    description: 'Specifies the HTTP method for links (get, post, put, patch, delete)',
  },
  {
    name: 'data-remote',
    description: 'Submits the form or link via AJAX',
  },
  {
    name: 'data-disable-with',
    description: 'Disables the element and shows alternative text during submission',
  },
  {
    name: 'data-params',
    description: 'Additional parameters to send with the request',
  },
  {
    name: 'data-type',
    description: 'Specifies the response type expected from the server',
  },
  {
    name: 'data-url',
    description: 'Specifies the URL for AJAX requests',
  },
];

// Turbo Rails data attributes
export const TURBO_DATA_ATTRIBUTES = [
  {
    name: 'data-turbo',
    description: 'Controls Turbo behavior (true/false)',
  },
  {
    name: 'data-turbo-track',
    description: 'Tracks elements for reload detection (reload)',
  },
  {
    name: 'data-turbo-action',
    description: 'Specifies the Turbo action (replace, advance)',
  },
  {
    name: 'data-turbo-cache',
    description: 'Controls page caching behavior (true/false)',
  },
  {
    name: 'data-turbo-eval',
    description: 'Controls script evaluation (true/false)',
  },
  {
    name: 'data-turbo-method',
    description: 'Specifies HTTP method for Turbo requests',
  },
  {
    name: 'data-turbo-confirm',
    description: 'Shows confirmation dialog for Turbo requests',
  },
  {
    name: 'data-turbo-stream',
    description: 'Enables Turbo Stream responses',
  },
  {
    name: 'data-turbo-frame',
    description: 'Specifies the target Turbo Frame',
  },
  {
    name: 'data-turbo-prefetch',
    description: 'Enables link prefetching (true/false)',
  },
  {
    name: 'data-turbo-permanent',
    description: 'Preserves element across page visits',
  },
  {
    name: 'data-turbo-temporary',
    description: 'Removes element on page navigation',
  },
  {
    name: 'data-turbo-submits-with',
    description: 'Alternative text during form submission',
  },
];

// Stimulus data attributes
export const STIMULUS_DATA_ATTRIBUTES = [
  {
    name: 'data-controller',
    description: 'Connects a Stimulus controller to the element',
  },
  {
    name: 'data-action',
    description: 'Defines event handlers for Stimulus controllers',
  },
  {
    name: 'data-target',
    description: 'Marks element as a target for Stimulus controllers',
  },
];
