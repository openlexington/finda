define(function(require, exports, module) {
  'use strict';
  // compile all the templates
  var flight = require('flight');
  var Handlebars = require('handlebars');
  var _ = require('lodash');
  var $ = require('jquery');
  var welcomeTemplate = require('text!templates/welcome.html');
  var inputTemplate = require('text!templates/input.html');
  var formTemplate = require('text!templates/form.html');
  var facetTemplate = require('text!templates/facet.html');
  var facetControlsTemplate = require('text!templates/facetControls.html');
  var extraResourcesTemplate = require('text!templates/extraResources.html');
  var aboutTemplate = require('text!templates/about.html');

  var templates = {
    welcome: Handlebars.compile(welcomeTemplate),
    input: Handlebars.compile(inputTemplate),
    form: Handlebars.compile(formTemplate),
    facet: Handlebars.compile(facetTemplate),
    facetControls: Handlebars.compile(facetControlsTemplate),
    extraResources: Handlebars.compile(extraResourcesTemplate),
    about: Handlebars.compile(aboutTemplate)
  };

  module.exports = flight.component(function () {
    this.configureFacets = function(ev, config) {
      this.facetConfig = config.facets;
    };

    // -1 is start with intro question that is not a facet
    this.facetOffset = -1;

    this.meetsFacetDependency = function(facetData, key, dependency) {
      return _.find(facetData, function(facets) {
        return _.find(facets, function(facet) {
          return facet.value === dependency && facet.selected;
        });
      });
    };

    this.getFacetConfig = function(key, attr) {
      if (this.facetConfig[key]) {
        return this.facetConfig[key][attr];
      }
    };

    this.displayFacets = function(ev, facetData) {
      // cache facet data so that you can call it internally instead of waiting
      //   for event from data facet
      if (facetData) {
        this.facetData = facetData;
      } else {
        facetData = this.facetData;
      }

      this.noSelectionsAvailable = false;

      // show first question if you're looking for a treatment facility
      if (this.facetOffset === -1) {
        this.$node.html(templates.welcome());
        this.on('.js-next-prev', 'click', this.nextPrevHandler);
        this.on('.js-no-treatment', 'click', this.showNoTreatment);
        this.on('.js-not-sure-treatment', 'click', this.showNoTreatment);
        this.on('.js-about-app', 'click', this.showAbout);
        return;
      }

      var facets = _.keys(facetData);
      var key = facets[this.facetOffset];
      if (!this.showAllFacets) {
        if (this.facetOffset >= facets.length) {
          this.$node.find('.js-offer-results[data-offer-results=true]').click();
          return;
        }

        // does the facet have a dependency?
        if (key) {
          var dependency = this.getFacetConfig(key, 'dependency');
          if (dependency) {
            if (!this.meetsFacetDependency(facetData, key, dependency)) {
              this.setFacetOffset(this.facetOffset + 1);
              return;
            }
          }
        }

        var newFacetData = {};
        newFacetData[key] = facetData[key];
        facetData = newFacetData;
      }

      var facet = _.chain(facetData).map(
          _.bind(function(values, key) {
            // only one facet available that has no facilities
            if (values.length === 1 && values[0].count === 0) {
              this.noSelectionsAvailable = true;
            }
            var hasSelected = _.some(values, 'selected');
            var configKey = this.showAllFacets ? 'title' : 'survey_title';
            // render a template for each facet
            return templates.facet({
              title: this.getFacetConfig(key, configKey),
              key: key,
              // render the form for each value of the facet
              form: templates.form({
                key: key,
                has_selected: hasSelected,
                inputs: _.chain(values).filter('count').map(templates.input).
                                        value()
              })
            });
          }, this)).value().join('');

      var previousOffset;
      if (typeof this.facetHistory === 'object') {
        previousOffset = this.facetHistory[this.facetHistory.length - 1] || -1;
      } else {
        previousOffset = -1;
      }
      this.$node.html(
        facet +
        templates.facetControls({
          showResults: this.showAllFacets,
          facetOffset: this.facetOffset + 1,
          previousFacetOffset: previousOffset
        })
      );

      this.on('.js-next-prev', 'click', this.nextPrevHandler);
      this.on('.js-offer-results', 'click', this.showResultsHandler);

      if (this.noSelectionsAvailable === true) {
        // click button to advance to the next facet.
        // NOTE(chaserx): I couldn't find a way to use `facetOffset` without
        //    creating infinite loop.
        this.$node.find('button.btn-next').trigger('click');
        this.facetHistory.pop();
        this.noSelectionsAvailable = false;
        return;
      }
    };

    this.showResultsHandler = function(ev) {
      // can be true or false
      var offerResults = $(ev.target).data('offerResults');
      this.showAllFacets = offerResults;
      if (this.showAllFacets) {
        this.showResults();
        $(document).trigger('uiShowResults', {});
      } else {
        $('#facets').removeClass('control-sidebar');
        $('#facets').addClass('control-survey');
        $(document).trigger('uiHideResults', {});
      }
      this.displayFacets();
    };

    this.showResults = function() {
      $('#facets').addClass('control-sidebar');
      $('#facets').removeClass('control-survey');
    };

    this.nextPrevHandler = function(ev) {
      if (typeof this.facetHistory === 'undefined') {
        this.facetHistory = [];
      }
      var clickedEl = $(ev.target);
      var offset = parseInt(clickedEl.data('nextFacetOffset'), 10);
      if (clickedEl.is('.previous')) {
        var facet = _.keys(this.facetData)[offset];
        $(document).trigger('uiClearFacets', {facet: facet});
        this.setFacetOffset(this.facetHistory.pop());
      } else {
        var lastItem = this.facetHistory[this.facetHistory.length - 1];
        if (lastItem !== this.facetOffset) {
          this.facetHistory.push(this.facetOffset);
        }
        this.setFacetOffset(offset);
      }
    };

    this.setFacetOffset = function(offset) {
      this.facetOffset = offset;
      this.displayFacets();
    };

    this.clearFacets = function(ev) {
      ev.preventDefault();
      var facet = $(ev.target).data('facet');
      $(document).trigger('uiClearFacets', {facet: facet});
    };

    this.selectFacet = function(ev) {
      var $form = $(ev.target).parents('form'),
          facet = $form.data('facet'),
          selected = _.map($form.serializeArray(),
                           'name');
      window.setTimeout(function() {
        $(document).trigger('uiFilterFacet', {
          facet: facet,
          selected: selected
        });
      }, 0);
    };

    this.showNoTreatment = function() {
      this.$node.html(templates.extraResources());
    };

    this.showAbout = function() {
      this.$node.html(templates.about());
    };

    // defaultAttrs is now deprecated in favor of 'attributes', but our
    //    version of flight still uses this.
    this.defaultAttrs({
      clearFacetsSelector : ".clear-facets"
    });

    this.after('initialize', function() {
      this.on('change', this.selectFacet);
      this.on(document, 'config', this.configureFacets);
      this.on(document, 'dataFacets', this.displayFacets);
      this.on(document, 'uiShowResults', this.showResults);
      this.on(document, 'uiShowAbout', this.showAbout);
      this.on(document, 'uiFacetChangeRequest', function(ev, facet) {
        var input = $('input[name=' + facet.name + ']');
        input.prop('checked', true);
        input.trigger('change');
      });
      this.on('click', { clearFacetsSelector : this.clearFacets });
    });
  });
});
