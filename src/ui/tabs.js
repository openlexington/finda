define(function(require, exports, module) {
  'use strict';
  var flight = require('flight');

  module.exports = flight.component(function sidebar() {
    this.onShowResults = function(event, opts) {
      if (!opts) { opts = {}; }

      if (!opts.dontClickTab) {
        this.$node.find('#results-tab').click();
      }
      this.$node.find('.survey-tabs').removeClass('survey-tabs');
    };

    this.setupClickHandlers = function() {
      this.$node.find('#results-tab').on('click', function() {
        this.trigger('uiShowResults', {dontClickTab: true});
      }.bind(this));

      this.$node.find('#about-tab').on('click', function() {
        this.trigger('uiShowAbout', {dontClickTab: false});
      }.bind(this));
    };

    this.after('initialize', function() {
      this.on(document, 'uiShowResults', this.onShowResults);
      this.setupClickHandlers();
    });
  });
});
