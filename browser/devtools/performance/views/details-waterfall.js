/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const MARKER_DETAILS_WIDTH = 300;

/**
 * Waterfall view containing the timeline markers, controlled by DetailsView.
 */
let WaterfallView = Heritage.extend(DetailsSubview, {

  observedPrefs: [
    "hidden-markers"
  ],

  rerenderPrefs: [
    "hidden-markers"
  ],

  rangeChangeDebounceTime: 75, // ms

  /**
   * Sets up the view with event binding.
   */
  initialize: function () {
    DetailsSubview.initialize.call(this);

    // TODO bug 1167093 save the previously set width, and ensure minimum width
    $("#waterfall-details").setAttribute("width", MARKER_DETAILS_WIDTH);

    this.waterfall = new Waterfall($("#waterfall-breakdown"), $("#waterfall-view"));
    this.details = new MarkerDetails($("#waterfall-details"), $("#waterfall-view > splitter"));

    this._onMarkerSelected = this._onMarkerSelected.bind(this);
    this._onResize = this._onResize.bind(this);
    this._onViewSource = this._onViewSource.bind(this);

    this.waterfall.on("selected", this._onMarkerSelected);
    this.waterfall.on("unselected", this._onMarkerSelected);
    this.details.on("resize", this._onResize);
    this.details.on("view-source", this._onViewSource);

    let blueprint = PerformanceController.getTimelineBlueprint();
    this.waterfall.setBlueprint(blueprint);
    this.waterfall.recalculateBounds();
  },

  /**
   * Unbinds events.
   */
  destroy: function () {
    DetailsSubview.destroy.call(this);

    this.waterfall.off("selected", this._onMarkerSelected);
    this.waterfall.off("unselected", this._onMarkerSelected);
    this.details.off("resize", this._onResize);
    this.details.off("view-source", this._onViewSource);
  },

  /**
   * Method for handling all the set up for rendering a new waterfall.
   *
   * @param object interval [optional]
   *        The { startTime, endTime }, in milliseconds.
   */
  render: function(interval={}) {
    let recording = PerformanceController.getCurrentRecording();
    let startTime = interval.startTime || 0;
    let endTime = interval.endTime || recording.getDuration();
    let markers = recording.getMarkers();
    this.waterfall.setData({ markers, interval: { startTime, endTime } });
    this.emit(EVENTS.WATERFALL_RENDERED);
  },

  /**
   * Called when a marker is selected in the waterfall view,
   * updating the markers detail view.
   */
  _onMarkerSelected: function (event, marker) {
    let recording = PerformanceController.getCurrentRecording();
    // Race condition in tests due to lazy rendering of markers in the
    // waterfall? intermittent bug 1157523
    if (!recording) {
      return;
    }
    let frames = recording.getFrames();

    if (event === "selected") {
      this.details.render({ toolbox: gToolbox, marker, frames });
    }
    if (event === "unselected") {
      this.details.empty();
    }
  },

  /**
   * Called when the marker details view is resized.
   */
  _onResize: function () {
    this.waterfall.recalculateBounds();
    this.render();
  },

  /**
   * Called whenever an observed pref is changed.
   */
  _onObservedPrefChange: function(_, prefName) {
    let blueprint = PerformanceController.getTimelineBlueprint();
    this.waterfall.setBlueprint(blueprint);
  },

  /**
   * Called when MarkerDetails view emits an event to view source.
   */
  _onViewSource: function (_, file, line) {
    gToolbox.viewSourceInDebugger(file, line);
  },

  toString: () => "[object WaterfallView]"
});
